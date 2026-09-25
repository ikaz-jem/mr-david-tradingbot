import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { isSameOrigin } from "@/lib/request-origin";
import { AdminAuditEvent } from "@/models/AdminAuditEvent";
import { PlatformConfig } from "@/models/PlatformConfig";
import { User } from "@/models/User";

export const runtime = "nodejs";
const schema = z.object({
  field: z.enum(["registrationOpen", "scansOpen", "announcement"]),
  value: z.union([z.boolean(), z.string().trim().max(180)]),
  reason: z.string().trim().min(8).max(300),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (parsed.data.field === "announcement" ? typeof parsed.data.value !== "string" : typeof parsed.data.value !== "boolean")) return NextResponse.json({ error: "Enter a valid control and a reason of at least 8 characters." }, { status: 400 });
  try {
    await connectDB();
    const actor = await User.findById(session.user.id).select("role status").lean();
    if (!actor || actor.role !== "admin" || actor.status !== "active") return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    await PlatformConfig.updateOne({ key: "global" }, { $setOnInsert: { key: "global" } }, { upsert: true });
    const current = await PlatformConfig.findOne({ key: "global" }).lean();
    if (!current) throw new Error("Platform configuration missing");
    const { field, value, reason } = parsed.data;
    const before = current[field];
    if (before === value) return NextResponse.json({ ok: true, unchanged: true });
    const audit = await AdminAuditEvent.create({ actorId: actor._id, targetType: "platform", targetId: "global", action: `set_${field}`, before: String(before), after: String(value), reason });
    let applied = false;
    try {
      const updated = await PlatformConfig.updateOne({ _id: current._id, [field]: before }, { $set: { [field]: value } });
      if (updated.modifiedCount !== 1) {
        await AdminAuditEvent.updateOne({ _id: audit._id }, { $set: { status: "failed" } });
        return NextResponse.json({ error: "This control changed concurrently. Refresh and try again." }, { status: 409 });
      }
      applied = true;
      await AdminAuditEvent.updateOne({ _id: audit._id }, { $set: { status: "applied" } });
      return NextResponse.json({ ok: true });
    } catch (error) {
      if (!applied) await AdminAuditEvent.updateOne({ _id: audit._id }, { $set: { status: "failed" } }).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    console.error("Platform control change failed", error);
    return NextResponse.json({ error: "Control change failed. Check the audit trail before retrying." }, { status: 503 });
  }
}
