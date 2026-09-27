import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { isSameOrigin } from "@/lib/request-origin";
import { AdminAuditEvent } from "@/models/AdminAuditEvent";
import { PlatformConfig } from "@/models/PlatformConfig";
import { User } from "@/models/User";
import { getPlatformConfig } from "@/lib/platform-config";

export const runtime = "nodejs";
const schema = z.object({
  field: z.enum(["registrationOpen", "scansOpen", "exchangeConnectionsOpen", "paperReconciliationOpen", "contactIntakeOpen", "allowedScanSymbols", "announcement"]),
  value: z.union([z.boolean(), z.string().trim().max(180), z.array(z.enum(["BTCUSDT", "ETHUSDT", "SOLUSDT"])).min(1).max(3)]),
  reason: z.string().trim().min(8).max(300),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid control and a reason of at least 8 characters." }, { status: 400 });
  const { field, reason } = parsed.data;
  const value = field === "allowedScanSymbols" && Array.isArray(parsed.data.value) ? [...new Set(parsed.data.value)].sort() : parsed.data.value;
  if ((field === "announcement" && typeof value !== "string") || (field === "allowedScanSymbols" && (!Array.isArray(value) || value.length === 0)) || (!["announcement", "allowedScanSymbols"].includes(field) && typeof value !== "boolean")) return NextResponse.json({ error: "Invalid value for this setting." }, { status: 400 });
  try {
    await connectDB();
    const actor = await User.findById(session.user.id).select("role status").lean();
    if (!actor || actor.role !== "admin" || actor.status !== "active") return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    await PlatformConfig.updateOne({ key: "global" }, { $setOnInsert: { key: "global" } }, { upsert: true });
    const current = await PlatformConfig.findOne({ key: "global" }).lean();
    if (!current) throw new Error("Platform configuration missing");
    const normalized = await getPlatformConfig();
    const before = normalized[field];
    if (JSON.stringify(before) === JSON.stringify(value)) return NextResponse.json({ ok: true, unchanged: true, config: normalized });
    const audit = await AdminAuditEvent.create({ actorId: actor._id, targetType: "platform", targetId: "global", action: `set_${field}`, before: JSON.stringify(before), after: JSON.stringify(value), reason });
    let applied = false;
    try {
      const updated = await PlatformConfig.updateOne({ _id: current._id, updatedAt: current.updatedAt }, { $set: { [field]: value } });
      if (updated.modifiedCount !== 1) {
        await AdminAuditEvent.updateOne({ _id: audit._id }, { $set: { status: "failed" } });
        return NextResponse.json({ error: "This control changed concurrently. Refresh and try again." }, { status: 409 });
      }
      applied = true;
      await AdminAuditEvent.updateOne({ _id: audit._id }, { $set: { status: "applied" } });
      return NextResponse.json({ ok: true, config: await getPlatformConfig() });
    } catch (error) {
      if (!applied) await AdminAuditEvent.updateOne({ _id: audit._id }, { $set: { status: "failed" } }).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    console.error("Platform control change failed", error);
    return NextResponse.json({ error: "Control change failed. Check the audit trail before retrying." }, { status: 503 });
  }
}
