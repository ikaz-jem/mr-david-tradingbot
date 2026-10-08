import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { workspaceActor } from "@/lib/workspace-access";
import { notifyUser } from "@/lib/notifications";
import { isSameOrigin } from "@/lib/request-origin";
import { AdminAuditEvent } from "@/models/AdminAuditEvent";
import { User } from "@/models/User";

const schema = z.object({ targetEmail: z.email().max(254), title: z.string().trim().min(4).max(120), body: z.string().trim().min(12).max(500), reason: z.string().trim().min(12).max(300) });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const actor = await workspaceActor();
  if (!actor?.can("notifications:create") || actor.organizationKind !== "platform") return NextResponse.json({ error: "Notification permission required." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid account email, title, message, and audit reason." }, { status: 400 });
  try {
    await connectDB();
    const target = await User.findOne({ email: parsed.data.targetEmail.toLowerCase(), status: "active", isDemo: actor.isDemo }).select("_id isDemo").lean();
    if (!target) return NextResponse.json({ error: "Recipient unavailable to this admin account." }, { status: 404 });
    const audit = await AdminAuditEvent.create({ actorId: actor.id, targetUserId: target._id, targetType: "user", targetId: String(target._id), action: "send_notification", before: "none", after: parsed.data.title, reason: parsed.data.reason });
    try {
      await notifyUser({ userId: String(target._id), kind: "system", title: parsed.data.title, body: parsed.data.body, href: "/dashboard/notifications", sourceKey: `admin-notification:${audit.id}` });
      await AdminAuditEvent.updateOne({ _id: audit._id }, { $set: { status: "applied" } });
      return NextResponse.json({ ok: true });
    } catch (error) {
      await AdminAuditEvent.updateOne({ _id: audit._id }, { $set: { status: "failed" } }).catch(() => undefined);
      throw error;
    }
  } catch (error) { console.error("Admin notification failed", error); return NextResponse.json({ error: "Notification was not sent. Check the audit trail before retrying." }, { status: 503 }); }
}
