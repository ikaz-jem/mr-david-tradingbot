import "server-only";
import { randomUUID } from "node:crypto";
import { connectDB } from "@/lib/db";
import { ScheduledJob } from "@/models/ScheduledJob";
import { scheduledJobs, type ScheduledJobKey } from "@/lib/scheduler-policy";
import { AuthorizationAuditLog } from "@/models/AuthorizationAuditLog";

// Trusted workers only. Leases prevent overlapping cron invocations and are
// recoverable after a process crash. Provider payloads are never stored here.
export async function runScheduledJob<T>(key: ScheduledJobKey, work: () => Promise<T>, recovery = false) {
  await connectDB();
  await ScheduledJob.init();
  await ScheduledJob.updateOne({ key }, { $setOnInsert: { key } }, { upsert: true }).catch(error => {
    if (error?.code !== 11000) throw error;
  });
  const leaseId = randomUUID();
  const now = Date.now();
  const staleAfterMs = scheduledJobs.find(job => job.key === key)!.staleAfterMs;
  const cooldown = key === "trade-tracking" ? 60_000 : key === "help-assets" ? 24 * 60 * 60_000 : 5 * 60_000;
  const eligibility = recovery ? [
    { $or: [{ lastSucceededAt: null }, { lastSucceededAt: { $lte: new Date(now - staleAfterMs) } }] },
    { $or: [{ lastStartedAt: null }, { lastStartedAt: { $lte: new Date(now - 5 * 60_000) } }] },
  ] : [{ $or: [{ lastRecoveryAt: null }, { lastRecoveryAt: { $lte: new Date(now - cooldown) } }] }];
  const claim = await ScheduledJob.findOneAndUpdate(
    { key, $and: [{ $or: [{ leaseUntil: null }, { leaseUntil: { $lte: new Date(now) } }] }, ...eligibility] },
    { $set: { status: "running", leaseId, leaseUntil: new Date(now + 6 * 60_000), lastStartedAt: new Date(now), ...(recovery ? { lastRecoveryAt: new Date(now) } : {}) } },
    { returnDocument: "after" },
  );
  if (!claim) return { skipped: true, reason: "healthy_running_or_cooldown" };
  try {
    if (recovery) await AuthorizationAuditLog.create({ action: "scheduler:recover", resource: "scheduler", targetType: "ScheduledJob", targetId: key, outcome: "success", requestId: leaseId, reason: "Trusted backup scheduler claimed overdue job" });
    const result = await work();
    await ScheduledJob.updateOne({ key, leaseId }, { $set: { status: "completed", lastSucceededAt: new Date(), lastFinishedAt: new Date(), leaseUntil: null, leaseId: null, failures: 0 } });
    return result;
  } catch (error) {
    await ScheduledJob.updateOne({ key, leaseId }, { $set: { status: "failed", lastFinishedAt: new Date(), leaseUntil: null, leaseId: null }, $inc: { failures: 1 } }).catch(() => undefined);
    throw error;
  }
}
