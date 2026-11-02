import { compare } from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { demoLoginEnabled, getOrCreateDemoUser } from "@/lib/demo";
import { resolveEffectivePermissions, writeSecurityAudit } from "@/lib/access-control";
import { mobileSessionMaxAge, mobileTokenHash } from "@/lib/mobile-auth";
import { mobileCustomerLoginAllowed } from "@/lib/mobile-route-policy";
import { MobileSession } from "@/models/MobileSession";
import { SecurityAttempt } from "@/models/SecurityAttempt";
import { UserSession } from "@/models/UserSession";
import { User } from "@/models/User";

export const runtime = "nodejs";
const input = z.object({ email: z.email().max(254).optional(), password: z.string().max(128).optional(), demo: z.boolean().optional(), deviceLabel: z.string().max(100).optional() });

export async function POST(request: Request) {
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (!parsed.data.demo && (!parsed.data.email || !parsed.data.password))) return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  await connectDB();
  const email = parsed.data.email?.trim().toLowerCase() ?? "demo-user";
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const bucket = Math.floor(Date.now() / (15 * 60_000));
  const key = `mobile-login:${createHash("sha256").update(email).digest("hex")}:${bucket}`;
  const attempts = await SecurityAttempt.findOne({ key }).lean();
  if ((attempts?.count ?? 0) >= 10) return NextResponse.json({ error: "Too many sign-in attempts. Try again later." }, { status: 429 });
  const demo = parsed.data.demo && demoLoginEnabled() ? await getOrCreateDemoUser("user") : null;
  const user = demo ? await User.findById(demo.id).select("+passwordHash") : await User.findOne({ email, status: "active", isDemo: false }).select("+passwordHash");
  const valid = Boolean(user?.emailVerifiedAt && (demo || (parsed.data.password && await compare(parsed.data.password, user.passwordHash))));
  if (!valid || !user) {
    await SecurityAttempt.updateOne({ key }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * 15 * 60_000) } }, { upsert: true });
    await writeSecurityAudit({ action: "authentication.mobile_login", resource: "sessions", targetType: "user", outcome: "denied", reason: "Credentials were rejected", request }).catch(() => undefined);
    return NextResponse.json({ error: "Email or password is incorrect, or the account is unavailable." }, { status: 401 });
  }
  if (!mobileCustomerLoginAllowed(user.role)) {
    await writeSecurityAudit({ action: "authentication.mobile_login", resource: "sessions", targetType: "user", targetId: String(user._id), outcome: "denied", reason: "Customer mobile app does not accept platform accounts", request }).catch(() => undefined);
    return NextResponse.json({ error: "This is an admin or staff account. Use the Enrivea web dashboard; the mobile app is for customer accounts." }, { status: 403 });
  }
  const access = await resolveEffectivePermissions(String(user._id));
  if (!access || access.organizationKind !== "customer") return NextResponse.json({ error: "This account cannot access the customer app." }, { status: 403 });
  await MobileSession.init();
  await SecurityAttempt.deleteOne({ key });
  const token = randomBytes(32).toString("base64url");
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + mobileSessionMaxAge * 1000);
  await UserSession.create({ organizationId: access.organizationId, userId: user._id, sessionId, status: "active", lastSeenAt: new Date(), expiresAt, ip, userAgent: request.headers.get("user-agent") ?? "" });
  try {
    await MobileSession.create({ userId: user._id, tokenHash: mobileTokenHash(token), sessionId, authVersion: user.authVersion, status: "active", expiresAt, deviceLabel: parsed.data.deviceLabel ?? "Mobile app" });
  } catch (error) {
    await UserSession.updateOne({ sessionId }, { $set: { status: "revoked", revokedAt: new Date() } });
    throw error;
  }
  await User.updateOne({ _id: user._id }, { $set: { lastActivityAt: new Date() } });
  await writeSecurityAudit({ actor: access, action: "authentication.mobile_login", resource: "sessions", targetType: "session", targetId: sessionId, outcome: "success", reason: "Mobile credentials accepted", request }).catch(() => undefined);
  return NextResponse.json({ token, expiresAt: expiresAt.toISOString(), user: { id: String(user._id), name: user.name, email: user.email, isDemo: user.isDemo, mustChangePassword: user.mustChangePassword } }, { headers: { "Cache-Control": "no-store" } });
}
