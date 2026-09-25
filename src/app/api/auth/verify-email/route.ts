import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { hashEmailToken } from "@/lib/email-tokens";
import { sendEmail, welcomeEmail } from "@/lib/email";
import { isSameOrigin } from "@/lib/request-origin";
import { EmailToken } from "@/models/EmailToken";
import { User } from "@/models/User";

const schema = z.object({ token: z.string().min(32).max(128) });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid verification link." }, { status: 400 });
  try {
    await connectDB();
    const token = await EmailToken.findOneAndDelete({ tokenHash: hashEmailToken(parsed.data.token), kind: "verify", expiresAt: { $gt: new Date() } });
    if (!token) return NextResponse.json({ error: "This link is invalid or expired. Request a new one." }, { status: 400 });
    const user = await User.findByIdAndUpdate(token.userId, { $set: { emailVerifiedAt: new Date() } }, { new: true });
    if (!user) return NextResponse.json({ error: "Account unavailable." }, { status: 404 });
    const template = welcomeEmail(user.name);
    await sendEmail({ to: user.email, category: "welcome", eventKey: `welcome:${user.id}`, ...template }).catch(error => console.error("Welcome email pending", error));
    return NextResponse.json({ ok: true });
  } catch (error) { console.error("Email verification failed", error); return NextResponse.json({ error: "Verification is unavailable right now." }, { status: 503 }); }
}
