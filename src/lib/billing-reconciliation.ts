import "server-only";
import { randomUUID } from "node:crypto";
import { connectDB } from "@/lib/db";
import { BillingPurchase } from "@/models/BillingPurchase";
import { verifyPayment } from "@/lib/payment-verification";
import { deliverAccountEvents } from "@/lib/account-delivery";

// Recovery for missed webhooks, independent of browser presence. Verification
// uses the original reference and never initializes another provider payment.
export async function runBillingReconciliation() {
  await connectDB();
  const summary = { checked: 0, paid: 0, review: 0, failedChecks: 0 };
  const deadline = Date.now() + 160_000;
  while (summary.checked < 20 && Date.now() < deadline) {
    const leaseId = randomUUID();
    const purchase = await BillingPurchase.findOneAndUpdate({
      mode: { $in: ["live", "test"] }, status: { $in: ["initializing", "pending", "review"] },
      createdAt: { $lte: new Date(Date.now() - 60_000) },
      $and: [
        { $or: [{ nextReconcileAt: null }, { nextReconcileAt: { $lte: new Date() } }] },
        { $or: [{ reconcileLeaseUntil: null }, { reconcileLeaseUntil: { $lte: new Date() } }] },
      ],
    }, { $set: { reconcileLeaseId: leaseId, reconcileLeaseUntil: new Date(Date.now() + 5 * 60_000), lastCheckedAt: new Date() }, $inc: { reconciliationAttempts: 1 } }, { sort: { nextReconcileAt: 1, createdAt: 1 }, returnDocument: "after" });
    if (!purchase) break;
    summary.checked++;
    const filter = { _id: purchase._id, reconcileLeaseId: leaseId };
    try {
      if (purchase.provider === "nowpayments" && !purchase.providerPaymentId) throw new Error("Initialization needs provider investigation");
      const result = await verifyPayment(purchase.reference);
      if (result === "paid" || result === "duplicate") summary.paid++;
      if (result === "review") summary.review++;
      await BillingPurchase.updateOne(filter, { $set: { reconciliationError: "" } });
    } catch {
      summary.failedChecks++;
      await BillingPurchase.updateOne({ ...filter, status: { $ne: "paid" } }, { $set: { reconciliationError: "Provider verification needs retry or administrator review." } });
    }
    // Old/unrecoverable purchases stay visible for review. Late signed webhooks
    // can still settle them, but they must not monopolize the polling queue.
    const old = Date.now() - purchase.createdAt.getTime() > 7 * 86_400_000;
    const missingId = purchase.provider === "nowpayments" && !purchase.providerPaymentId;
    if (old || missingId) {
      await BillingPurchase.updateOne({ ...filter, status: { $in: ["initializing", "pending", "review"] } }, { $set: { status: "review", checkoutLock: null } });
    }
    const wait = old || missingId ? 24 * 60 * 60_000 : Math.min(60, Math.max(5, 2 ** Math.min(purchase.reconciliationAttempts, 6))) * 60_000;
    await BillingPurchase.updateOne(filter, { $set: { nextReconcileAt: new Date(Date.now() + wait), reconcileLeaseUntil: null, reconcileLeaseId: null } });
  }
  return { ...summary, receipts: await deliverAccountEvents() };
}
