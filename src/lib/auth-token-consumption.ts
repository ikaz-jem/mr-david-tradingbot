import "server-only";
import { connectDB } from "@/lib/db";
import { EmailToken } from "@/models/EmailToken";
import { User } from "@/models/User";
import { AuthorizationAuditLog } from "@/models/AuthorizationAuditLog";

// Consuming the single-use token and changing the account must commit together.
export async function consumeAuthToken(tokenHash: string, purpose: "verify" | "reset", passwordHash?: string) {
  const db = await connectDB();
  return db.connection.transaction(async session => {
    const token = await EmailToken.findOneAndDelete({ tokenHash, kind: purpose === "verify" ? "verify" : { $in: ["reset", "invite"] }, expiresAt: { $gt: new Date() } }).session(session);
    if (!token) return null;
    const invited = token.kind === "invite";
    if (purpose === "reset" && !passwordHash) throw new Error("Password hash required");
    const user = await User.findOneAndUpdate({ _id: token.userId, isDemo: false, status: invited ? "invited" : "active" }, purpose === "verify" ? { $set: { emailVerifiedAt: new Date() } } : { $set: { passwordHash, pendingEmailChangeHash: null, lastPasswordChangedAt: new Date(), mustChangePassword: false, ...(invited ? { status: "active", emailVerifiedAt: new Date() } : {}) }, $inc: { authVersion: 1 } }, { session, returnDocument: "after" });
    if (!user) return null;
    if (purpose === "reset") await EmailToken.deleteMany({ userId: user._id, kind: { $in: ["reset", "invite", "email_change"] } }).session(session);
    await AuthorizationAuditLog.create([{ organizationId: user.organizationId, actorId: user._id, action: purpose === "verify" ? "authentication.email_verified" : "authentication.password_reset", resource: "users", targetType: "User", targetId: String(user._id), outcome: "success", reason: "Single-use email token confirmed" }], { session });
    return user;
  });
}
