import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { workspaceActor } from "@/lib/workspace-access";
import { isSameOrigin } from "@/lib/request-origin";
import { isShowcaseAccount } from "@/lib/demo-policy";
import { AdminAuditEvent } from "@/models/AdminAuditEvent";
import { User } from "@/models/User";
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
  if (!actor || actor.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const { id } = await params;
  if (!mongoose.isObjectIdOrHexString(id)) return NextResponse.json({ error: "Invalid account." }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid change and provide a reason of at least 12 characters." }, { status: 400 });
  const target = await User.findById(id).select("name role status isDemo countryCode authVersion email").lean();
  if (!target || (actor.isDemo && !target.isDemo)) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (target.role === "admin" || ((id === actor.id || (target.isDemo && isShowcaseAccount(target.email))) && parsed.data.action !== "set_name")) return NextResponse.json({ error: "This protected account cannot be changed here. Use a sample customer to demonstrate access controls." }, { status: 403 });
  const action = parsed.data.action;
  const field = action === "set_name" ? "name" : action === "set_role" ? "role" : action === "set_status" ? "status" : action === "set_country" ? "countryCode" : "authVersion";
  const before = String(target[field] ?? "unset");
  const after = action === "revoke_sessions" ? String(target.authVersion + 1) : parsed.data.value;
  if (before === after) return NextResponse.json({ ok: true, unchanged: true });
  const audit = await AdminAuditEvent.create({ actorId: actor.id, targetUserId: target._id, targetType: "user", targetId: id, action, before, after, reason: parsed.data.reason });
  let applied = false;
  try {
    const result = await User.updateOne({ _id: target._id, authVersion: target.authVersion, role: target.role, status: target.status }, {
      ...(action === "revoke_sessions" ? {} : { $set: { [field]: after } }), ...(action === "set_name" ? {} : { $inc: { authVersion: 1 } }),
    });
    if (result.modifiedCount !== 1) {
      await AdminAuditEvent.updateOne({ _id: audit._id }, { $set: { status: "failed" } });
      return NextResponse.json({ error: "Account changed concurrently. Refresh and retry." }, { status: 409 });
    }
    applied = true;
    await AdminAuditEvent.updateOne({ _id: audit._id }, { $set: { status: "applied" } });
    await notifyUser({ userId: id, kind: "account", title: action === "revoke_sessions" ? "Sessions revoked" : "Account access updated", body: action === "revoke_sessions" ? "Your existing sign-ins have been revoked. Please sign in again." : "Your account permissions have changed. Contact support if you need help.", href: "/dashboard/support", sourceKey: "access:" + audit.id }).catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch {
    if (!applied) await AdminAuditEvent.updateOne({ _id: audit._id }, { $set: { status: "failed" } }).catch(() => undefined);
    return NextResponse.json({ error: "Check the audit history before retrying this change." }, { status: 503 });
  }
}
