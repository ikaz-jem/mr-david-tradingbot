import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { hashEmailToken } from "@/lib/email-tokens";
import { passwordChangedEmail, sendEmail } from "@/lib/email";
import { isSameOrigin } from "@/lib/request-origin";
import { EmailToken } from "@/models/EmailToken";
import { User } from "@/models/User";

const schema = z.object({ token: z.string().min(32).max(128), password: z.string().min(12).max(128) });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Use a valid link and a password of at least 12 characters." }, { status: 400 });
  try {
    await connectDB();
    const tokenHash = hashEmailToken(parsed.data.token);
    if (!await EmailToken.exists({ tokenHash, kind: "reset", expiresAt: { $gt: new Date() } })) return NextResponse.json({ error: "This link is invalid or expired. Request a new one." }, { status: 400 });
    const passwordHash = await hash(parsed.data.password, 12);
    const token = await EmailToken.findOneAndDelete({ tokenHash, kind: "reset", expiresAt: { $gt: new Date() } });
    if (!token) return NextResponse.json({ error: "This link has already been used." }, { status: 400 });
    const user = await User.findByIdAndUpdate(token.userId, { $set: { passwordHash }, $inc: { authVersion: 1 } }, { new: true });
    if (!user) return NextResponse.json({ error: "Account unavailable." }, { status: 404 });
    await EmailToken.deleteMany({ userId: user._id, kind: "reset" });
    const template = passwordChangedEmail(user.name);
    await sendEmail({ to: user.email, category: "password_changed", eventKey: `password_changed:${user.id}:${user.authVersion}`, ...template }).catch(error => console.error("Password change notice failed", error));
    return NextResponse.json({ ok: true });
  } catch (error) { console.error("Password reset failed", error); return NextResponse.json({ error: "Password reset is unavailable right now." }, { status: 503 }); }
}
