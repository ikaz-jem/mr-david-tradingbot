import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { isSameOrigin } from "@/lib/request-origin";
import { AdminAuditEvent } from "@/models/AdminAuditEvent";
import { Signal } from "@/models/Signal";
import { User } from "@/models/User";

export const runtime = "nodejs";
const schema = z.object({ reason: z.string().trim().min(12).max(300) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid signal." }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Give a moderation reason of at least 12 characters." }, { status: 400 });
  try {
    await connectDB();
    const actor = await User.findById(session.user.id).select("role status isDemo").lean();
    if (!actor || actor.role !== "admin" || actor.status !== "active") return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    const signal = await Signal.findById(id).select("userId status").lean();
    if (!signal) return NextResponse.json({ error: "Signal not found." }, { status: 404 });
    if (signal.status === "invalidated") return NextResponse.json({ ok: true, unchanged: true });
    if (!['watch', 'triggered'].includes(signal.status)) return NextResponse.json({ error: "Only active signals can be invalidated. Historical outcomes stay unchanged." }, { status: 409 });
    const owner = await User.findById(signal.userId).select("isDemo").lean();
    if (actor.isDemo && !owner?.isDemo) return NextResponse.json({ error: "Demo admins can moderate only demo signals." }, { status: 403 });
    const audit = await AdminAuditEvent.create({ actorId: actor._id, targetUserId: signal.userId, targetType: "signal", targetId: id, action: "invalidate_signal", before: signal.status, after: "invalidated", reason: parsed.data.reason });
    let applied = false;
    try {
      const updated = await Signal.updateOne({ _id: signal._id, status: signal.status }, { $set: { status: "invalidated", moderationReason: parsed.data.reason, moderatedAt: new Date(), moderatedBy: actor._id } });
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
