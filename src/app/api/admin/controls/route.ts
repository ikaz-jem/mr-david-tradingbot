import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { workspaceActor } from "@/lib/workspace-access";
import { isSameOrigin } from "@/lib/request-origin";
import { AdminAuditEvent } from "@/models/AdminAuditEvent";
import { PlatformConfig } from "@/models/PlatformConfig";
import { getPlatformConfig } from "@/lib/platform-config";
import { platformConfigKey } from "@/lib/platform-scope";
import { scanIntervals, scanSymbols } from "@/lib/scan-markets";
import { getEnabledStrategies } from "@/lib/strategy-catalog";

export const runtime = "nodejs";
const creditPackInput = z.object({ id: z.string().regex(/^[a-z][a-z0-9_-]{1,39}$/), label: z.string().trim().min(3).max(80), credits: z.number().int().min(1).max(100000), priceMinor: z.number().int().min(1).max(100000000), enabled: z.boolean() });
const schema = z.object({
  field: z.enum(["registrationOpen", "scansOpen", "approvalDiscoveryOpen", "autopilotOpen", "exchangeConnectionsOpen", "billingOpen", "supportOpen", "paperReconciliationOpen", "contactIntakeOpen", "maintenanceMode", "maintenanceMessage", "registrationPausedMessage", "scansPausedMessage", "approvalPausedMessage", "autopilotPausedMessage", "exchangeConnectionsPausedMessage", "billingPausedMessage", "supportPausedMessage", "paperReconciliationPausedMessage", "contactIntakePausedMessage", "activationOpen", "activationPriceMinor", "activationCredits", "creditPacks", "allowedScanSymbols", "approvalScanSymbols", "approvalScanIntervals", "approvalScanStrategySlugs", "approvalScanMaxCombinations", "approvalScanCadenceMinutes", "announcement"]),
  value: z.union([
    z.boolean(), z.string().trim().max(240), z.number().int().min(1).max(100000000),
    z.array(z.enum(scanSymbols)).min(1).max(scanSymbols.length),
    z.array(z.enum(scanIntervals)).min(1).max(scanIntervals.length),
    z.array(z.string().regex(/^[a-z][a-z0-9-]{1,39}$/)).min(1).max(20),
    z.array(creditPackInput).max(10),
  ]),
  reason: z.string().trim().min(8).max(300),
});

export async function GET() {
  const actor = await workspaceActor();
  if (actor?.organizationKind !== "platform" || !actor.can("settings:read")) return NextResponse.json({ error: "Platform settings permission required." }, { status: 403 });
  await connectDB();
  return NextResponse.json({ config: await getPlatformConfig(Boolean(actor.isDemo)) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const actor = await workspaceActor();
  if (actor?.organizationKind !== "platform" || !actor.can("settings:update")) return NextResponse.json({ error: "Platform settings permission required." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid control and a reason of at least 8 characters." }, { status: 400 });
  const { field, reason } = parsed.data;
  const listFields = ["allowedScanSymbols", "approvalScanSymbols", "approvalScanIntervals", "approvalScanStrategySlugs"];
  const value = listFields.includes(field) && Array.isArray(parsed.data.value) ? [...new Set(parsed.data.value as string[])].sort() : parsed.data.value;
  const booleanFields = ["registrationOpen", "scansOpen", "approvalDiscoveryOpen", "autopilotOpen", "exchangeConnectionsOpen", "billingOpen", "supportOpen", "paperReconciliationOpen", "contactIntakeOpen", "maintenanceMode", "activationOpen"];
  const messageFields = ["maintenanceMessage", "registrationPausedMessage", "scansPausedMessage", "approvalPausedMessage", "autopilotPausedMessage", "exchangeConnectionsPausedMessage", "billingPausedMessage", "supportPausedMessage", "paperReconciliationPausedMessage", "contactIntakePausedMessage"];
  const numericFields = ["activationPriceMinor", "activationCredits", "approvalScanMaxCombinations", "approvalScanCadenceMinutes"];
  if ((field === "announcement" && typeof value !== "string") || (messageFields.includes(field) && (typeof value !== "string" || value.trim().length < 8)) || (listFields.includes(field) && (!Array.isArray(value) || value.length === 0 || typeof value[0] !== "string")) || (field === "creditPacks" && (!Array.isArray(value) || value.some(item => typeof item !== "object" || item === null))) || (booleanFields.includes(field) && typeof value !== "boolean") || (numericFields.includes(field) && typeof value !== "number")) return NextResponse.json({ error: "Invalid value for this setting." }, { status: 400 });
  if (field === "creditPacks" && Array.isArray(value)) {
    const ids = value.map(pack => typeof pack === "object" && pack && "id" in pack ? String(pack.id) : "");
    if (new Set(ids).size !== ids.length) return NextResponse.json({ error: "Every credit pack needs a unique ID." }, { status: 400 });
  }
  try {
    await connectDB();
    const key = platformConfigKey(actor.isDemo);
    await PlatformConfig.updateOne({ key }, { $setOnInsert: { key } }, { upsert: true });
    const current = await PlatformConfig.findOne({ key }).lean();
    if (!current) throw new Error("Platform configuration missing");
    const normalized = await getPlatformConfig(Boolean(actor.isDemo));
    if (field === "approvalScanSymbols" && Array.isArray(value) && value.some(symbol => !normalized.allowedScanSymbols.includes(String(symbol)))) return NextResponse.json({ error: "Approval Desk pairs must also be enabled under Research markets." }, { status: 400 });
    if (field === "approvalScanStrategySlugs" && Array.isArray(value)) {
      const enabled = await getEnabledStrategies(Boolean(actor.isDemo), "approval-desk");
      if (value.some(slug => !enabled.some(strategy => strategy.slug === slug))) return NextResponse.json({ error: "Approval Desk pool contains a disabled or unassigned strategy." }, { status: 400 });
    }
    if (field === "approvalScanCadenceMinutes" && (typeof value !== "number" || ![5, 10, 15, 30, 60].includes(value))) return NextResponse.json({ error: "Choose a supported scan cadence." }, { status: 400 });
    if (field === "approvalScanMaxCombinations" && (typeof value !== "number" || value < 1 || value > 500)) return NextResponse.json({ error: "Maximum combinations must be between 1 and 500." }, { status: 400 });
    const before = normalized[field];
    if (JSON.stringify(before) === JSON.stringify(value)) return NextResponse.json({ ok: true, unchanged: true, config: normalized });
    const audit = await AdminAuditEvent.create({ actorId: actor.id, targetType: "platform", targetId: key, action: `set_${field}`, before: JSON.stringify(before), after: JSON.stringify(value), reason });
    let applied = false;
    try {
      const updated = await PlatformConfig.updateOne({ _id: current._id, updatedAt: current.updatedAt }, { $set: { [field]: value } });
      if (updated.modifiedCount !== 1) {
        await AdminAuditEvent.updateOne({ _id: audit._id }, { $set: { status: "failed" } });
        return NextResponse.json({ error: "This control changed concurrently. Refresh and try again." }, { status: 409 });
      }
      applied = true;
      await AdminAuditEvent.updateOne({ _id: audit._id }, { $set: { status: "applied" } });
      revalidatePath("/");
      revalidatePath("/pricing");
      revalidatePath("/dashboard");
      revalidatePath("/dashboard/credits");
      revalidatePath("/dashboard/signals");
      revalidatePath("/admin");
      revalidatePath("/admin/controls");
      revalidatePath("/admin/controls/operations");
      revalidatePath("/admin/controls/markets");
      revalidatePath("/admin/controls/approval-scanner");
      revalidatePath("/admin/controls/announcements");
      revalidatePath("/admin/controls/activation");
      return NextResponse.json({ ok: true, config: await getPlatformConfig(Boolean(actor.isDemo)) });
    } catch (error) {
      if (!applied) await AdminAuditEvent.updateOne({ _id: audit._id }, { $set: { status: "failed" } }).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    console.error("Platform control change failed", error);
    return NextResponse.json({ error: "Control change failed. Check the audit trail before retrying." }, { status: 503 });
  }
}
