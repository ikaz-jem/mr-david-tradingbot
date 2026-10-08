import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { workspaceActor } from "@/lib/workspace-access";
import { isSameOrigin } from "@/lib/request-origin";
import { isShowcaseAccount } from "@/lib/demo-policy";
import { connectDB } from "@/lib/db";
import { AdminAuditEvent } from "@/models/AdminAuditEvent";
import { User } from "@/models/User";
import { UserSession } from "@/models/UserSession";
import { UserRole } from "@/models/UserRole";
import { UserPermission } from "@/models/UserPermission";
import { Organization } from "@/models/Organization";
import { AccessRole } from "@/models/AccessRole";
import { notifyUser } from "@/lib/notifications";

const reason = z.string().trim().min(12).max(300);
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set_name"), value: z.string().trim().min(2).max(100), reason }),
  z.object({ action: z.literal("set_role"), value: z.enum(["user", "staff"]), reason }),
  z.object({ action: z.literal("set_status"), value: z.enum(["active", "suspended", "banned"]), reason }),
  z.object({ action: z.literal("set_country"), value: z.string().regex(/^[A-Z]{2}$/), reason }),
  z.object({ action: z.literal("revoke_sessions"), reason }),
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const actor = await workspaceActor();
  if (!actor?.can("users:update") || actor.organizationKind !== "platform") return NextResponse.json({ error: "User update permission required." }, { status: 403 });
  const { id } = await params;
  if (!mongoose.isObjectIdOrHexString(id)) return NextResponse.json({ error: "Invalid account." }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid change and provide a reason of at least 12 characters." }, { status: 400 });
  const input = parsed.data;
  const target = await User.findById(id).select("name role status isDemo countryCode authVersion email organizationId").lean();
  if (!target || Boolean(target.isDemo) !== actor.isDemo) return NextResponse.json({ error: "Account not found in this workspace." }, { status: 404 });
  if (target.role === "admin" || id === actor.id || (target.isDemo && isShowcaseAccount(target.email))) return NextResponse.json({ error: "Protected administrator and showcase sign-ins cannot be changed here." }, { status: 403 });
  if ((target.role === "staff" && !actor.can("staff:update")) || (input.action === "set_role" && !actor.can("roles:assign"))) return NextResponse.json({ error: "Staff or role-assignment permission required." }, { status: 403 });
  if (target.status === "closed" || target.status === "deactivated") return NextResponse.json({ error: "Closed and deactivated accounts require a separate recovery process." }, { status: 409 });

  const action = input.action;
  const field = action === "set_name" ? "name" : action === "set_role" ? "role" : action === "set_status" ? "status" : action === "set_country" ? "countryCode" : "authVersion";
  const before = String(target[field] ?? "unset");
  const after = action === "revoke_sessions" ? String(target.authVersion + 1) : input.value;
  if (before === after) return NextResponse.json({ ok: true, unchanged: true });
  const db = await connectDB();
  let destination: { organizationId: mongoose.Types.ObjectId; roleId: mongoose.Types.ObjectId } | null = null;
  if (action === "set_role") {
    if (input.value === "staff") {
      const platformOrg = await Organization.findOne({ _id: actor.organizationId, kind: "platform", isDemo: actor.isDemo, status: "active" }).select("_id").lean();
      const staffRole = platformOrg && await AccessRole.findOne({ organizationId: platformOrg._id, slug: "staff", status: "active" }).select("_id").lean();
      if (!platformOrg || !staffRole) return NextResponse.json({ error: "Platform staff role is not configured." }, { status: 503 });
      destination = { organizationId: platformOrg._id, roleId: staffRole._id };
    } else {
      const organization = await Organization.findOneAndUpdate(
        { slug: `account-${id}`, isDemo: actor.isDemo },
        { $setOnInsert: { name: `${target.name}'s workspace`, slug: `account-${id}`, kind: "customer", isDemo: actor.isDemo, createdBy: target._id } },
        { upsert: true, returnDocument: "after" },
      );
      if (!organization || organization.status !== "active") return NextResponse.json({ error: "Customer workspace is unavailable." }, { status: 503 });
      const customerRole = await AccessRole.findOneAndUpdate(
        { organizationId: organization._id, slug: "customer" },
        { $setOnInsert: { organizationId: organization._id, slug: "customer", name: "Customer", description: "Standard customer workspace access.", system: true, createdBy: target._id } },
        { upsert: true, returnDocument: "after" },
      );
      if (!customerRole || customerRole.status !== "active") return NextResponse.json({ error: "Customer role is unavailable." }, { status: 503 });
      destination = { organizationId: organization._id, roleId: customerRole._id };
    }
  }

  try {
    const outcome = await db.connection.transaction(async session => {
      const update = action === "revoke_sessions"
        ? { $inc: { authVersion: 1 } }
        : { $set: { [field]: after, ...(destination ? { organizationId: destination.organizationId } : {}) }, ...(action === "set_name" ? {} : { $inc: { authVersion: 1 } }) };
      const result = await User.updateOne({ _id: target._id, isDemo: actor.isDemo ? true : { $ne: true }, authVersion: target.authVersion, role: target.role, status: target.status }, update, { session });
      if (result.modifiedCount !== 1) return "conflict";
      if (destination) {
        await UserRole.deleteMany({ userId: target._id }, { session });
        await UserPermission.deleteMany({ userId: target._id }, { session });
        await UserRole.create([{ organizationId: destination.organizationId, userId: target._id, roleId: destination.roleId, assignedBy: new mongoose.Types.ObjectId(actor.id) }], { session });
      }
      if (action !== "set_name") await UserSession.updateMany({ userId: target._id, status: "active" }, { $set: { status: "revoked", revokedAt: new Date() } }, { session });
      await AdminAuditEvent.create([{ actorId: new mongoose.Types.ObjectId(actor.id), targetUserId: target._id, targetType: "user", targetId: id, action, before, after: String(after), reason: input.reason, status: "applied" }], { session });
      return "applied";
    });
    if (outcome === "conflict") return NextResponse.json({ error: "Account changed concurrently. Refresh and retry." }, { status: 409 });
    await notifyUser({ userId: id, kind: "account", title: action === "revoke_sessions" ? "Sessions revoked" : "Account access updated", body: action === "revoke_sessions" ? "Your existing sign-ins have been revoked. Please sign in again." : "Your account details or permissions have changed. Contact support if you need help.", href: "/dashboard/support", sourceKey: `access:${id}:${Date.now()}` }).catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Account management change failed", { action, targetId: id, error });
    return NextResponse.json({ error: "Unable to apply this change. No account update was committed." }, { status: 503 });
  }
}
