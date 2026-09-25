import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { isSameOrigin } from "@/lib/request-origin";
import { AdminAuditEvent } from "@/models/AdminAuditEvent";
import { User } from "@/models/User";

export const runtime = "nodejs";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set_role"), value: z.enum(["user", "staff"]), reason: z.string().trim().min(8).max(300) }),
  z.object({ action: z.literal("set_status"), value: z.enum(["active", "suspended"]), reason: z.string().trim().min(8).max(300) }),
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid account." }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid change and provide a reason of at least 8 characters." }, { status: 400 });
  try {
    await connectDB();
    const actor = await User.findById(session.user.id).select("role status isDemo").lean();
    if (!actor || actor.role !== "admin" || actor.status !== "active") return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    if (session.user.id === id) return NextResponse.json({ error: "You cannot change your own access." }, { status: 403 });
    const target = await User.findById(id).select("role status isDemo").lean();
    if (!target) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    if (target.role === "admin") return NextResponse.json({ error: "Admin account changes require a separate privileged workflow." }, { status: 403 });
    if (actor.isDemo && !target.isDemo) return NextResponse.json({ error: "Demo admins can manage only demo accounts." }, { status: 403 });
    const field = parsed.data.action === "set_role" ? "role" : "status";
    const before = target[field];
    if (before === parsed.data.value) return NextResponse.json({ ok: true, unchanged: true });
    const audit = await AdminAuditEvent.create({ actorId: actor._id, targetUserId: target._id, targetType: "user", targetId: id, action: parsed.data.action, before, after: parsed.data.value, reason: parsed.data.reason });
    let applied = false;
    try {
      const result = await User.updateOne({ _id: target._id, role: target.role, status: target.status }, { $set: { [field]: parsed.data.value }, $inc: { authVersion: 1 } });
      if (result.modifiedCount !== 1) {
        await AdminAuditEvent.updateOne({ _id: audit._id }, { $set: { status: "failed" } });
        return NextResponse.json({ error: "Account changed concurrently. Refresh and try again." }, { status: 409 });
      }
      applied = true;
      await AdminAuditEvent.updateOne({ _id: audit._id }, { $set: { status: "applied" } });
      return NextResponse.json({ ok: true });
    } catch (error) {
      if (!applied) await AdminAuditEvent.updateOne({ _id: audit._id }, { $set: { status: "failed" } }).catch(recordError => console.error("Admin audit update failed", recordError));
      throw error;
    }
  } catch (error) {
    console.error("Admin access change failed", error);
    return NextResponse.json({ error: "Access change is unavailable. Check the audit trail before retrying." }, { status: 503 });
  }
}
