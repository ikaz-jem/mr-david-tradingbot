import "server-only";
import { connectDB } from "@/lib/db";
import { ScheduledJob } from "@/models/ScheduledJob";
import { AccountDelivery } from "@/models/AccountDelivery";
import { BillingPurchase } from "@/models/BillingPurchase";
import { scheduledJobs, jobHealth } from "@/lib/scheduler-policy";

export async function operationalHealth() {
  const db = await connectDB();
  await db.connection.db!.command({ ping: 1 });
  const [rows, receiptAttention, pendingReceipts, overduePayments] = await Promise.all([
    ScheduledJob.find().lean(),
    AccountDelivery.countDocuments({ isDemo: false, status: "attention" }),
    AccountDelivery.countDocuments({ isDemo: false, status: "pending", createdAt: { $lt: new Date(Date.now() - 15 * 60_000) } }),
    BillingPurchase.countDocuments({ isDemo: false, mode: "live", status: { $in: ["pending", "initializing"] }, createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60_000) } }),
  ]);
  const jobs = scheduledJobs.map(job => {
    const row = rows.find(item => item.key === job.key);
    return { key: job.key, label: job.label, health: jobHealth(row, job.staleAfterMs), lastSucceededAt: row?.lastSucceededAt?.toISOString() ?? null, failures: row?.failures ?? 0 };
  });
  return { ok: jobs.every(job => job.health === "healthy") && receiptAttention === 0 && pendingReceipts === 0 && overduePayments === 0, jobs, receiptAttention, pendingReceipts, overduePayments };
}
