import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { paystackTestKey, paystackTestRequest, verifyPaystackSignature } from "@/lib/paystack";
import { PaystackCheckout } from "@/models/PaystackCheckout";
import { PaystackWebhookEvent } from "@/models/PaystackWebhookEvent";
import { User } from "@/models/User";

export const runtime = "nodejs";
type PaystackTransaction = { id: number; domain: string; status: string; reference: string; amount: number; currency: string; customer?: { email?: string } };

export async function POST(request: Request) {
  const key = paystackTestKey();
  if (!key) return NextResponse.json({ error: "Paystack sandbox is disabled." }, { status: 503 });
  if (Number(request.headers.get("content-length") ?? 0) > 100_000) return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  const raw = await request.text();
  if (raw.length > 100_000) return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  if (!verifyPaystackSignature(raw, request.headers.get("x-paystack-signature"), key)) return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  let event: { event?: string; data?: { reference?: string } };
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid payload." }, { status: 400 }); }
  if (typeof event.event !== "string") return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  const reference = typeof event.data?.reference === "string" ? event.data.reference : null;
  const eventHash = createHash("sha256").update(raw).digest("hex");
  try {
    await connectDB();
    let outcome: "recorded" | "verified_test" | "ignored" | "review" = "recorded";
    if (event.event === "charge.success" && reference) {
      const checkout = await PaystackCheckout.findOne({ reference });
      if (!checkout) outcome = "review";
      else {
        const transaction = await paystackTestRequest<PaystackTransaction>(`transaction/verify/${encodeURIComponent(reference)}`);
        const user = await User.findById(checkout.userId).select("email").lean();
        if (transaction.domain === "test" && transaction.status === "success" && transaction.reference === reference && transaction.amount === checkout.expectedAmount && transaction.currency === checkout.currency && transaction.customer?.email?.toLowerCase() === user?.email && Number.isSafeInteger(transaction.id)) {
          await PaystackCheckout.updateOne({ _id: checkout._id, status: { $in: ["initializing", "pending", "paid_test"] } }, { $set: { status: "paid_test", verifiedAt: new Date(), providerTransactionId: String(transaction.id) } });
          outcome = "verified_test";
        } else {
          await PaystackCheckout.updateOne({ _id: checkout._id }, { $set: { status: "review" } });
          outcome = "review";
        }
      }
    } else if (!reference || !["subscription.create", "invoice.update", "invoice.payment_failed", "subscription.disable", "subscription.not_renew"].includes(event.event)) outcome = "ignored";
    await PaystackWebhookEvent.updateOne({ eventHash }, { $setOnInsert: { eventHash, type: event.event, reference, outcome } }, { upsert: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Paystack sandbox webhook processing failed", error);
    return NextResponse.json({ error: "Webhook processing unavailable." }, { status: 503 });
  }
}
