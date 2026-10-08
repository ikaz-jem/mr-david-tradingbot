import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { workspaceActor } from "@/lib/workspace-access";
import { isSameOrigin } from "@/lib/request-origin";
import { AdminAuditEvent } from "@/models/AdminAuditEvent";
import { Signal } from "@/models/Signal";
import { User } from "@/models/User";

export const runtime = "nodejs";
const schema = z.object({ reason: z.string().trim().min(12).max(300) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const actor = await workspaceActor();
  if (!actor?.can("signals:update") || actor.organizationKind !== "platform") return NextResponse.json({ error: "Signal moderation permission required." }, { status: 403 });
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid signal." }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Give a moderation reason of at least 12 characters." }, { status: 400 });
  try {
    await connectDB();
    const signal = await Signal.findById(id).select("userId status").lean();
    if (!signal) return NextResponse.json({ error: "Signal not found." }, { status: 404 });
    const owner = await User.findById(signal.userId).select("isDemo").lean();
    if (!owner || Boolean(owner.isDemo) !== actor.isDemo) return NextResponse.json({ error: "Signal unavailable to this admin account." }, { status: 404 });
    if (signal.status === "invalidated") return NextResponse.json({ ok: true, unchanged: true });
    if (!['watch', 'triggered'].includes(signal.status)) return NextResponse.json({ error: "Only active signals can be invalidated. Historical outcomes stay unchanged." }, { status: 409 });
    const audit = await AdminAuditEvent.create({ actorId: actor.id, targetUserId: signal.userId, targetType: "signal", targetId: id, action: "invalidate_signal", before: signal.status, after: "invalidated", reason: parsed.data.reason });
    let applied = false;
    try {
      const updated = await Signal.updateOne({ _id: signal._id, status: signal.status }, { $set: { status: "invalidated", moderationReason: parsed.data.reason, moderatedAt: new Date(), moderatedBy: actor.id } });
      if (updated.modifiedCount !== 1) {
        await AdminAuditEvent.updateOne({ _id: audit._id }, { $set: { status: "failed" } });
        return NextResponse.json({ error: "Signal changed concurrently. Refresh and try again." }, { status: 409 });
      }
      applied = true;
      await AdminAuditEvent.updateOne({ _id: audit._id }, { $set: { status: "applied" } });
      return NextResponse.json({ ok: true });
    } catch (error) {
      if (!applied) await AdminAuditEvent.updateOne({ _id: audit._id }, { $set: { status: "failed" } }).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    console.error("Signal moderation failed", error);
    return NextResponse.json({ error: "Moderation failed. Check the audit trail before retrying." }, { status: 503 });
  }
}
