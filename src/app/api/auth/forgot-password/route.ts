import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { emailActionUrl, hashEmailToken, issueEmailToken } from "@/lib/email-tokens";
import { hasEmailProvider, passwordResetEmail, sendEmail } from "@/lib/email";
import { isSameOrigin } from "@/lib/request-origin";
import { EmailToken } from "@/models/EmailToken";
import { User } from "@/models/User";

const schema = z.object({ email: z.email().max(254) });
const generic = { message: "If that account exists, a reset link will be sent shortly." };

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (!hasEmailProvider()) return NextResponse.json({ error: "Email delivery is not configured." }, { status: 503 });
  try {
    await connectDB();
    const user = await User.findOne({ email: parsed.data.email.toLowerCase(), emailVerifiedAt: { $ne: null }, status: "active" });
    if (!user) return NextResponse.json(generic);
    if (await EmailToken.exists({ userId: user._id, kind: "reset", createdAt: { $gt: new Date(Date.now() - 60_000) } })) return NextResponse.json(generic);
    const token = await issueEmailToken(user._id, "reset", 30);
    const template = passwordResetEmail(user.name, emailActionUrl("/reset-password", token));
    await sendEmail({ to: user.email, category: "password_reset", eventKey: `reset:${user.id}:${hashEmailToken(token).slice(0, 16)}`, ...template }).catch(error => console.error("Password reset delivery failed", error));
    return NextResponse.json(generic);
  } catch (error) { console.error("Password reset request unavailable", error); return NextResponse.json(generic); }
}
