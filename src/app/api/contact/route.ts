import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { escapeEmailHtml, hasEmailProvider, sendEmail } from "@/lib/email";
import { isSameOrigin } from "@/lib/request-origin";
import { ContactThrottle } from "@/models/ContactThrottle";

const schema = z.object({ name: z.string().trim().min(2).max(100), email: z.email().max(254), topic: z.enum(["Product question", "Account help", "Partnership", "Other"]), message: z.string().trim().min(20).max(3000), website: z.string().max(100).optional() });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the form and include a message of at least 20 characters." }, { status: 400 });
  if (parsed.data.website) return NextResponse.json({ ok: true });
  if (!hasEmailProvider() || !process.env.RESEND_SUPPORT_EMAIL) return NextResponse.json({ error: "The contact form is unavailable. Email contact@enrivea.com directly." }, { status: 503 });
  const normalizedEmail = parsed.data.email.toLowerCase();
  const bucket = Math.floor(Date.now() / 600_000);
  const key = createHmac("sha256", process.env.NEXTAUTH_SECRET!).update(`contact:${normalizedEmail}:${bucket}`).digest("hex");
  try {
    await connectDB();
    await ContactThrottle.create({ key, expiresAt: new Date((bucket + 1) * 600_000 + 60_000) });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === 11000) return NextResponse.json({ error: "Please wait a few minutes before sending another message." }, { status: 429 });
    console.error("Contact throttle unavailable", error);
    return NextResponse.json({ error: "The contact form is unavailable right now." }, { status: 503 });
  }
  const safeName = escapeEmailHtml(parsed.data.name);
  const safeEmail = escapeEmailHtml(normalizedEmail);
  const safeMessage = escapeEmailHtml(parsed.data.message).replace(/\n/g, "<br>");
  try {
    await sendEmail({ to: process.env.RESEND_SUPPORT_EMAIL!, category: "contact", eventKey: `contact:${key}`, subject: `Enrivea Signal: ${parsed.data.topic}`, html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h1>New contact message</h1><p><b>Name:</b> ${safeName}<br><b>Email:</b> ${safeEmail}<br><b>Topic:</b> ${escapeEmailHtml(parsed.data.topic)}</p><p>${safeMessage}</p></div>`, text: `${parsed.data.topic}\nFrom: ${parsed.data.name} <${normalizedEmail}>\n\n${parsed.data.message}`, replyTo: normalizedEmail });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await ContactThrottle.deleteOne({ key }).catch(cleanupError => console.error("Contact throttle cleanup failed", cleanupError));
    console.error("Contact delivery failed", error);
    return NextResponse.json({ error: "Your message was not sent. Please email contact@enrivea.com directly." }, { status: 503 });
  }
}
