import "server-only";
import { randomBytes } from "node:crypto";
import { compare } from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { EmailToken } from "@/models/EmailToken";
import { AccountDelivery } from "@/models/AccountDelivery";
import { AuthorizationAuditLog } from "@/models/AuthorizationAuditLog";
import { emailActionUrl, hashEmailToken } from "@/lib/email-tokens";
import { accountEventEmail, hasEmailProvider, sendEmail } from "@/lib/email";
import { deliverAccountEvents } from "@/lib/account-delivery";

export class EmailChangeError extends Error {}

export async function requestEmailChange(userId: string, newEmail: string, password: string, request: Request) {
  const db = await connectDB();
  const user = await User.findOne({ _id: userId, status: "active", isDemo: false, emailVerifiedAt: { $ne: null } }).select("+passwordHash").lean();
  if (!user || !await compare(password, user.passwordHash)) throw new EmailChangeError("Current password is incorrect or this account cannot change its email.");
  if (newEmail === user.email) throw new EmailChangeError("Choose a different email address.");
  if (await User.exists({ email: newEmail })) throw new EmailChangeError("This email address cannot be used. Choose another address or contact support.");
  if (!await hasEmailProvider()) throw new EmailChangeError("Email delivery is unavailable. Please try again later.");
  const token = randomBytes(32).toString("base64url"), tokenHash = hashEmailToken(token);
  await db.connection.transaction(async session => {
    const changed = await User.updateOne({ _id: user._id, status: "active", authVersion: user.authVersion, email: user.email, passwordHash: user.passwordHash }, { $set: { pendingEmailChangeHash: tokenHash } }, { session });
    if (!changed.modifiedCount) throw new EmailChangeError("Your account changed. Sign in again and retry.");
    await EmailToken.deleteMany({ userId, kind: "email_change" }).session(session);
    await EmailToken.create([{ userId, kind: "email_change", tokenHash, newEmail, oldEmail: user.email, authVersion: user.authVersion, expiresAt: new Date(Date.now() + 30 * 60_000) }], { session });
    await AuthorizationAuditLog.create([{ organizationId: user.organizationId, actorId: user._id, action: "account.email_change.requested", resource: "users", targetType: "User", targetId: userId, outcome: "success", reason: "Owner verified password and requested an email change", ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "", userAgent: (request.headers.get("user-agent") ?? "").slice(0, 500) }], { session });
  });
  const url = emailActionUrl("/verify-email-change", token);
  await sendEmail({ to: newEmail, category: "account", eventKey: `email-change:${tokenHash}`, ...accountEventEmail(user.name, "Confirm your new email", "Confirm this address as your new sign-in email. The link expires in 30 minutes. Your current email remains active until you confirm.", url) });
}

// The random single-use token is the capability; it is bound to the owner,
// previous verified email, and auth version. GET requests never consume it.
export async function completeEmailChange(rawToken: string) {
  const db = await connectDB();
  await AccountDelivery.init();
  const tokenHash = hashEmailToken(rawToken);
  const result = await db.connection.transaction(async session => {
    const token = await EmailToken.findOne({ tokenHash, kind: "email_change", expiresAt: { $gt: new Date() } }).session(session);
    if (!token?.newEmail || !token.oldEmail || token.authVersion === null) throw new EmailChangeError("This link is invalid, expired, or already used. Request a new change from settings.");
    const user = await User.findOneAndUpdate({ _id: token.userId, status: "active", isDemo: false, email: token.oldEmail, authVersion: token.authVersion, pendingEmailChangeHash: tokenHash }, { $set: { email: token.newEmail, emailVerifiedAt: new Date(), pendingEmailChangeHash: null }, $inc: { authVersion: 1 } }, { session, returnDocument: "after" });
    if (!user) throw new EmailChangeError("Your account changed after this request. Request a new email change from settings.");
    await EmailToken.deleteMany({ userId: token.userId }).session(session);
    const title = "Sign-in email changed", body = "Your sign-in email was changed and all existing sessions were signed out. Contact support immediately if you did not make this change.";
    await AccountDelivery.create([{ sourceKey: `email-changed:${tokenHash}`, userId: user._id, isDemo: false, kind: "account", title, body, href: "/dashboard/settings", email: { to: token.oldEmail, ...accountEventEmail(user.name, title, body) } }], { session });
    await AuthorizationAuditLog.create([{ organizationId: user.organizationId, actorId: user._id, action: "account.email_change.confirmed", resource: "users", targetType: "User", targetId: String(user._id), outcome: "success", reason: "Owner confirmed single-use email change token", previousValue: { email: token.oldEmail }, newValue: { email: user.email } }], { session });
    return { sourceKey: `email-changed:${tokenHash}` };
  });
  await deliverAccountEvents(result.sourceKey, 1).catch(() => undefined);
}
