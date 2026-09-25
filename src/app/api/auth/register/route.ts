import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { CreditEntry } from "@/models/CreditEntry";
import { emailActionUrl, hashEmailToken, issueEmailToken } from "@/lib/email-tokens";
import { hasEmailProvider, sendEmail, verificationEmail } from "@/lib/email";
import { isSameOrigin } from "@/lib/request-origin";
import { getPlatformConfig } from "@/lib/platform-config";

const schema = z.object({ name: z.string().trim().min(2).max(100), email: z.email().max(254), password: z.string().min(12).max(128) });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (process.env.NODE_ENV === "production" && !hasEmailProvider()) return NextResponse.json({ error: "Account creation is temporarily unavailable." }, { status: 503 });
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Enter a name, valid email, and password of at least 12 characters." }, { status: 400 });
    await connectDB();
    if (!(await getPlatformConfig()).registrationOpen) return NextResponse.json({ error: "New registrations are temporarily paused." }, { status: 503 });
    const email = parsed.data.email.toLowerCase();
    if (await User.exists({ email })) return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    const passwordHash = await hash(parsed.data.password, 12);
    const verificationRequired = hasEmailProvider();
    const user = await User.create({ name: parsed.data.name, email, passwordHash, emailVerifiedAt: verificationRequired ? null : new Date() });
    try {
      await CreditEntry.updateOne({ sourceKey: `welcome:${user.id}` }, { $setOnInsert: { userId: user._id, amount: 5, kind: "welcome", sourceKey: `welcome:${user.id}`, note: "Welcome analyses" } }, { upsert: true });
    } catch (creditError) {
      // A successful registration stays usable; the idempotent welcome grant can be retried.
      console.error("Welcome grant pending", creditError);
    }
    if (verificationRequired) {
      const token = await issueEmailToken(user._id, "verify", 24 * 60);
      const template = verificationEmail(user.name, emailActionUrl("/verify-email", token));
      try { await sendEmail({ to: user.email, category: "verify", eventKey: `verify:${user.id}:${hashEmailToken(token).slice(0, 16)}`, ...template }); }
      catch (emailError) { console.error("Verification email failed", emailError); return NextResponse.json({ error: "Account created, but email delivery failed. Use the resend verification page." }, { status: 503 }); }
    }
    return NextResponse.json({ ok: true, verificationRequired }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === 11000) return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    console.error("Registration failed", error);
    return NextResponse.json({ error: "Registration is unavailable right now. Please try again." }, { status: 500 });
  }
}
