import "server-only";
import { randomUUID } from "node:crypto";
import { connectDB } from "@/lib/db";
import { AccountDelivery } from "@/models/AccountDelivery";
import { notifyUser } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";

// Jobs are inserted in the same transaction as the account change. Recipient
// and template are snapshots so a retry has the identical provider payload.
export async function deliverAccountEvents(sourceKey?: string, limit = 10) {
  await connectDB();
  const summary = { attempted: 0, delivered: 0, attention: 0 };
  const deadline = Date.now() + 45_000;
  while (summary.attempted < limit && Date.now() < deadline) {
    const leaseId = randomUUID();
    const job = await AccountDelivery.findOneAndUpdate({
      ...(sourceKey ? { sourceKey } : {}), status: "pending", nextAttemptAt: { $lte: new Date() },
      $or: [{ leaseUntil: null }, { leaseUntil: { $lte: new Date() } }],
    }, { $set: { leaseId, leaseUntil: new Date(Date.now() + 5 * 60_000) }, $inc: { attempts: 1 } }, { sort: { nextAttemptAt: 1 }, returnDocument: "after" });
    if (!job) break;
    summary.attempted++;
    const filter = { _id: job._id, leaseId };
    // Resend retains idempotency keys for 24 hours. Never retry an ambiguous
    // send beyond that window and risk sending a second receipt.
    if (job.firstAttemptAt && Date.now() - job.firstAttemptAt.getTime() >= 23 * 60 * 60_000) {
      await AccountDelivery.updateOne(filter, { $set: { status: "attention", leaseId: null, leaseUntil: null } });
      summary.attention++; continue;
    }
    if (!job.firstAttemptAt) await AccountDelivery.updateOne(filter, { $set: { firstAttemptAt: new Date() } });
    try {
      if (!job.inboxDoneAt) {
        await notifyUser({ userId: String(job.userId), sourceKey: job.sourceKey, kind: job.kind, title: job.title, body: job.body, href: job.href });
        await AccountDelivery.updateOne(filter, { $set: { inboxDoneAt: new Date() } });
      }
      if (!job.emailDoneAt && job.email && !job.isDemo) {
        const { to, subject, html, text } = job.email;
        if (!to || !subject || !html || !text) throw new Error("Incomplete email snapshot");
        await sendEmail({ to, subject, html, text, category: job.kind, eventKey: job.sourceKey });
        await AccountDelivery.updateOne(filter, { $set: { emailDoneAt: new Date() } });
      }
      await AccountDelivery.updateOne(filter, { $set: { status: "delivered", leaseUntil: null, leaseId: null } });
      summary.delivered++;
    } catch {
      const exhausted = job.attempts >= 12;
      await AccountDelivery.updateOne(filter, { $set: { status: exhausted ? "attention" : "pending", nextAttemptAt: new Date(Date.now() + Math.min(60, 2 ** Math.min(job.attempts, 6)) * 60_000), leaseUntil: null, leaseId: null } });
      if (exhausted) summary.attention++;
    }
  }
  return summary;
}
