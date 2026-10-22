import "server-only";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Order } from "@/models/Order";
import { AutopilotExecution } from "@/models/AutopilotExecution";
import { AutopilotProfile } from "@/models/AutopilotProfile";
import { ExchangeConnection } from "@/models/ExchangeConnection";
import { UserSession } from "@/models/UserSession";
import { EmailToken } from "@/models/EmailToken";
import { AuthorizationAuditLog } from "@/models/AuthorizationAuditLog";

export class AccountClosureConflict extends Error {}
export async function closeOwnedAccount(userId: string, authVersion: number, request: Request) {
  const db = await connectDB();
  await db.connection.transaction(async session => {
    const user = await User.findOneAndUpdate({ _id: userId, status: "active", isDemo: false, authVersion }, { $set: { status: "closed", closedAt: new Date() }, $inc: { authVersion: 1, executionRevision: 1 } }, { session, returnDocument: "after" });
    if (!user) throw new AccountClosureConflict("Account changed while closing. Sign in again and retry.");
    const order = await Order.exists({ userId, $or: [{ status: { $in: ["intent", "submitted", "unknown", "partial", "protection_failed"] } }, { market: "futures", status: "filled", trackingStatus: { $ne: "closed" } }, { positionGuardKey: { $exists: true } }] }).session(session);
    const execution = await AutopilotExecution.exists({ userId, status: { $in: ["submitting", "submitted", "filled", "partial", "protection_failed"] } }).session(session);
    if (order || execution) throw new AccountClosureConflict("Close and reconcile your open trades before closing this account. Stop Autopilot and contact support if a trade needs review.");
    await AutopilotProfile.updateOne({ userId }, { $set: { status: "emergency_stopped", emergencyStoppedAt: new Date(), lastDecision: "Account closed by owner" }, $inc: { revision: 1 } }, { session });
    await ExchangeConnection.deleteMany({ userId }).session(session);
    await UserSession.updateMany({ userId, status: "active" }, { $set: { status: "revoked", revokedAt: new Date() } }, { session });
    await EmailToken.deleteMany({ userId }).session(session);
    await AuthorizationAuditLog.create([{ organizationId: user.organizationId, actorId: user._id, action: "account.closed", resource: "users", targetType: "User", targetId: userId, outcome: "success", reason: "Owner confirmed account closure with password", ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "", userAgent: (request.headers.get("user-agent") ?? "").slice(0, 500) }], { session });
  });
}
