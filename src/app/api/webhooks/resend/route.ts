import { Resend } from "resend";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { EmailDelivery } from "@/models/EmailDelivery";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!process.env.RESEND_WEBHOOK_SECRET) return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!id || !timestamp || !signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  const resend = new Resend(process.env.RESEND_API_KEY);
  let event: ReturnType<typeof resend.webhooks.verify>;
  try { event = resend.webhooks.verify({ payload: await request.text(), headers: { id, timestamp, signature }, webhookSecret: process.env.RESEND_WEBHOOK_SECRET }); }
  catch { return NextResponse.json({ error: "Invalid webhook." }, { status: 400 }); }
  if (!["email.delivered", "email.bounced", "email.complained", "email.failed", "email.suppressed"].includes(event.type) || !("email_id" in event.data)) return NextResponse.json({ ok: true });
  const status = event.type === "email.delivered" ? "delivered" : event.type === "email.bounced" ? "bounced" : event.type === "email.complained" ? "complained" : "failed";
  try {
    await connectDB();
    await EmailDelivery.updateOne({ providerId: event.data.email_id }, { $set: { status } });
    return NextResponse.json({ ok: true });
  } catch (error) { console.error("Resend webhook processing failed", error); return NextResponse.json({ error: "Webhook processing unavailable." }, { status: 503 }); }
}
