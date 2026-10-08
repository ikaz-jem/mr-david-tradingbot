import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { BillingPurchase } from "@/models/BillingPurchase";
import { verifyNowSignature } from "@/lib/payment-policy";
import { purchaseGateway, verifyPayment } from "@/lib/payment-verification";

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 100000) return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  let event;
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid event." }, { status: 400 }); }
  if (typeof event?.order_id !== "string" || !/^enrivea-[a-f0-9]{32}$/.test(event.order_id)) return NextResponse.json({ ok: true, ignored: true });
  try {
    await connectDB();
    const purchase = await BillingPurchase.findOne({ reference: event.order_id, provider: "nowpayments" }).lean();
    if (!purchase) return NextResponse.json({ ok: true, ignored: true });
    const gateway = await purchaseGateway(purchase);
    if (gateway.mode === "demo" || !verifyNowSignature(event, request.headers.get("x-nowpayments-sig"), gateway.webhookSecret)) return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
    if (!purchase.providerPaymentId) return NextResponse.json({ error: "Payment initialization pending. Retry." }, { status: 503 });
    if (String(event.payment_id) !== purchase.providerPaymentId) return NextResponse.json({ error: "Payment identifier mismatch." }, { status: 400 });
    return NextResponse.json({ ok: true, status: await verifyPayment(purchase.reference) });
  } catch { return NextResponse.json({ error: "Payment verification needs retry." }, { status: 503 }); }
}
