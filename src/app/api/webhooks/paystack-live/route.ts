import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { BillingPurchase } from "@/models/BillingPurchase";
import { verifyPaystackSignature } from "@/lib/paystack";
import { purchaseGateway, verifyPayment } from "@/lib/payment-verification";

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 100000) return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  let event;
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid event." }, { status: 400 }); }
  const reference = event?.data?.reference;
  if (typeof reference !== "string" || !/^enrivea-[a-f0-9]{32}$/.test(reference)) return NextResponse.json({ ok: true, ignored: true });
  try {
    await connectDB();
    const purchase = await BillingPurchase.findOne({ reference }).lean();
    if (!purchase || purchase.provider === "nowpayments") return NextResponse.json({ ok: true, ignored: true });
    const gateway = await purchaseGateway(purchase);
    if (gateway.mode === "demo" || !verifyPaystackSignature(raw, request.headers.get("x-paystack-signature"), gateway.key)) return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
    if (event.event !== "charge.success") return NextResponse.json({ ok: true, ignored: true });
    return NextResponse.json({ ok: true, status: await verifyPayment(reference) });
  } catch { return NextResponse.json({ error: "Payment verification needs retry." }, { status: 503 }); }
}
