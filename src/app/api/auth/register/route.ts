import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { referralSponsor } from "@/lib/affiliates";
import { AffiliateAccount } from "@/models/Affiliate";
import { hash } from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { emailActionUrl, hashEmailToken, issueEmailToken } from "@/lib/email-tokens";
import { hasEmailProvider, sendEmail, verificationEmail } from "@/lib/email";
import { isSameOrigin } from "@/lib/request-origin";
import { getPlatformConfig } from "@/lib/platform-config";

const schema = z.object({ name: z.string().trim().min(2).max(100), email: z.email().max(254), password: z.string().min(12).max(128) });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Enter a name, valid email, and password of at least 12 characters." }, { status: 400 });
    const db = await connectDB();
    const platform = await getPlatformConfig();
    if (platform.maintenanceMode) return NextResponse.json({ error: platform.maintenanceMessage }, { status: 503 });
    if (!platform.registrationOpen) return NextResponse.json({ error: platform.registrationPausedMessage }, { status: 503 });
    const verificationRequired = await hasEmailProvider();
    if (process.env.NODE_ENV === "production" && !verificationRequired) return NextResponse.json({ error: "Account creation is temporarily unavailable." }, { status: 503 });
    const email = parsed.data.email.toLowerCase();
    if (await User.exists({ email })) return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    const passwordHash = await hash(parsed.data.password, 12);
    const sponsorId = await referralSponsor((await cookies()).get("enrivea-referral")?.value);
    await AffiliateAccount.init();
    const user = await db.connection.transaction(async session => {
      const [created] = await User.create([{ name: parsed.data.name, email, passwordHash, creditBalance: 0, activatedAt: null, emailVerifiedAt: verificationRequired ? null : new Date() }], { session });
      await AffiliateAccount.create([{ userId: created._id, sponsorId, isDemo: false, code: randomBytes(12).toString("hex") }], { session });
      return created;
    });
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
