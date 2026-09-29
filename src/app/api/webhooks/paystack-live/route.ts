import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { paystackSettlementConfig } from "@/lib/billing-catalog";
import { ensureProductAccount } from "@/lib/credits";
import { connectDB } from "@/lib/db";
import { notifyUser } from "@/lib/notifications";
import { paystackLiveRequest } from "@/lib/paystack-live";
import { verifyPaystackSignature } from "@/lib/paystack";
import { BillingPurchase } from "@/models/BillingPurchase";
import { CreditEntry } from "@/models/CreditEntry";
import { ProductAccount } from "@/models/ProductAccount";
import { User } from "@/models/User";
import { addCalendarMonth } from "@/lib/billing-period";

export const runtime = "nodejs";
type VerifiedTransaction = { id: number; domain: string; status: string; reference: string; amount: number; currency: string; customer?: { email?: string } };

export async function POST(request: Request) {
  const config = paystackSettlementConfig();
  if (!config) return NextResponse.json({ error: "Live billing disabled." }, { status: 503 });
  if (Number(request.headers.get("content-length") ?? 0) > 100_000) return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  const raw = await request.text();
  if (raw.length > 100_000) return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  if (!verifyPaystackSignature(raw, request.headers.get("x-paystack-signature"), config.key)) return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  let event: { event?: string; data?: { reference?: string } };
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid event." }, { status: 400 }); }
  if (event.event !== "charge.success" || typeof event.data?.reference !== "string") return NextResponse.json({ ok: true, ignored: true });
  const reference = event.data.reference;
  if (!/^enrivea-[a-f0-9]{32}$/.test(reference)) return NextResponse.json({ ok: true, ignored: true });
  try {
    const db = await connectDB();
    const purchase = await BillingPurchase.findOne({ reference }).lean();
    if (!purchase) return NextResponse.json({ ok: true, ignored: true });
    if (purchase.status === "paid") return NextResponse.json({ ok: true, duplicate: true });
    const transaction = await paystackLiveRequest<VerifiedTransaction>(`transaction/verify/${encodeURIComponent(reference)}`);
    const user = await User.findById(purchase.userId).select("email status").lean();
    const verified = transaction.domain === "live" && transaction.status === "success" && transaction.reference === reference && transaction.amount === purchase.expectedAmount && transaction.currency === purchase.currency && transaction.customer?.email?.toLowerCase() === user?.email && user?.status === "active";
    if (!verified) {
      await BillingPurchase.updateOne({ _id: purchase._id, status: { $ne: "paid" } }, { $set: { status: "review" } });
      return NextResponse.json({ ok: true, review: true });
    }
    await ensureProductAccount(String(purchase.userId), purchase.productId);
    const paidAt = new Date();
    const fulfilled = await db.connection.transaction(async mongoSession => {
      const claimed = await BillingPurchase.findOneAndUpdate({ _id: purchase._id, status: { $in: ["initializing", "pending", "review", "failed"] } }, { $set: { status: "paid", verifiedAt: paidAt, providerTransactionId: Number.isSafeInteger(transaction.id) ? String(transaction.id) : null } }, { session: mongoSession });
      if (!claimed) return false;
      const wallet = await ProductAccount.findOne({ userId: purchase.userId, productId: purchase.productId }).session(mongoSession);
      if (!wallet) throw new Error("Product wallet missing");
      if (purchase.kind === "monthly") {
        const periodStart = wallet.currentPeriodEnd && wallet.currentPeriodEnd > paidAt ? wallet.currentPeriodEnd : paidAt;
        wallet.planId = purchase.itemId;
        wallet.subscriptionStatus = "active";
        wallet.currentPeriodStart = periodStart;
        wallet.currentPeriodEnd = addCalendarMonth(periodStart);
      }
      wallet.creditBalance += purchase.credits;
      wallet.lastPaymentReference = reference;
      await wallet.save({ session: mongoSession });
      await CreditEntry.create([{ userId: purchase.userId, productId: purchase.productId, amount: purchase.credits, kind: "purchase", sourceKey: `paystack:${reference}`, note: purchase.kind === "monthly" ? `${purchase.itemId} monthly allowance` : `${purchase.itemId} credit top-up` }], { session: mongoSession });
      return true;
    });
    if (!fulfilled) return NextResponse.json({ ok: true, duplicate: true });
    await notifyUser({ userId: String(purchase.userId), kind: "billing", title: purchase.kind === "monthly" ? "Monthly access active" : "Credits added", body: `${purchase.credits} credits were added to your Trade research balance.`, href: "/dashboard/credits", sourceKey: `billing:${createHash("sha256").update(reference).digest("hex")}` }).catch(error => console.error("Billing notification failed", error));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Live billing fulfillment failed", error);
    return NextResponse.json({ error: "Payment processing needs retry or manual review." }, { status: 503 });
  }
}
