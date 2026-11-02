import "server-only";
import { createHash } from "node:crypto";
import { encode } from "next-auth/jwt";
import { connectDB } from "@/lib/db";
import { demoLoginEnabled } from "@/lib/demo";
import { resolveEffectivePermissions } from "@/lib/access-control";
import { MobileSession } from "@/models/MobileSession";
import { UserSession } from "@/models/UserSession";
import { User } from "@/models/User";

export const mobileSessionMaxAge = 7 * 24 * 60 * 60;
export const mobileTokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function mobileActor(request: Request) {
  const match = /^Bearer ([A-Za-z0-9_-]{40,100})$/.exec(request.headers.get("authorization") ?? "");
  if (!match) return null;
  await connectDB();
  const session = await MobileSession.findOne({ tokenHash: mobileTokenHash(match[1]), status: "active", expiresAt: { $gt: new Date() } }).select("+tokenHash");
  if (!session) return null;
  const [user, tracked] = await Promise.all([
    User.findOne({ _id: session.userId, status: "active", role: "user" }).select("_id name email role authVersion isDemo mustChangePassword emailVerifiedAt organizationId").lean(),
    UserSession.findOne({ sessionId: session.sessionId, status: "active", expiresAt: { $gt: new Date() } }).lean(),
  ]);
  if (!user?.emailVerifiedAt || user.authVersion !== session.authVersion || !tracked || (user.isDemo && !demoLoginEnabled())) return null;
  const access = await resolveEffectivePermissions(String(user._id));
  if (!access || access.organizationKind !== "customer") return null;
  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60_000) {
    await MobileSession.updateOne({ _id: session._id }, { $set: { lastSeenAt: new Date() } });
    await UserSession.updateOne({ sessionId: session.sessionId }, { $set: { lastSeenAt: new Date() } });
  }
  return { user, access, mobileSession: session };
}

export async function mobileCookie(actor: NonNullable<Awaited<ReturnType<typeof mobileActor>>>) {
  if (!process.env.NEXTAUTH_SECRET) throw new Error("NEXTAUTH_SECRET is required for mobile sessions");
  const { user, access, mobileSession } = actor;
  const value = await encode({ secret: process.env.NEXTAUTH_SECRET, maxAge: mobileSessionMaxAge, token: {
    sub: String(user._id), name: user.name, email: user.email, role: user.role,
    authVersion: user.authVersion, isDemo: user.isDemo, mustChangePassword: user.mustChangePassword,
    sessionId: mobileSession.sessionId, organizationId: access.organizationId,
    permissions: access.permissions, permissionsCheckedAt: Date.now(),
  } });
  return `next-auth.session-token=${value}; __Secure-next-auth.session-token=${value}`;
}
