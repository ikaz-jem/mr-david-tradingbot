import { NextResponse } from "next/server";
import { workspaceActor } from "@/lib/workspace-access";
import { isSameOrigin } from "@/lib/request-origin";
import { runApprovalDiscovery } from "@/lib/approval-engine";
import { getProductCatalog } from "@/lib/product-catalog";
import { getPlatformConfig } from "@/lib/platform-config";
import { ApprovalScanJob } from "@/models/ApprovalScanJob";
import { AuthorizationAuditLog } from "@/models/AuthorizationAuditLog";
import { canAccessLiveApprovalScanner } from "@/lib/approval-access-policy";
import { getServiceConfigStatus } from "@/lib/service-config";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET() {
  const actor = await workspaceActor();
  if (actor?.organizationKind !== "platform" || !actor.can("settings:read")) return NextResponse.json({ error: "Scanner read permission required." }, { status: 403 });
  if (actor.isDemo) return NextResponse.json({ demo: true, canRun: false, job: null });
  const [job, catalog, config, service] = await Promise.all([ApprovalScanJob.findOne({ key: "approval-discovery:live" }).select("status startedAt completedAt leaseUntil combinations opportunitiesCreated eligibleUsers lastError outcomes").lean(), getProductCatalog(false), getPlatformConfig(false), getServiceConfigStatus(false)]);
  const aiReady = service.openaiApiKey && Boolean(service.openaiModel) && Boolean(service.openaiVerifiedAt) && !service.openaiLastError;
  const cronConfigured = Boolean(process.env.CRON_SECRET && process.env.CRON_SECRET.length >= 16 && !process.env.CRON_SECRET.startsWith("replace-"));
  return NextResponse.json({ demo: false, canRun: actor.can("settings:update"), cronConfigured, aiReady, aiError: service.openaiLastError, productEnabled: Boolean(catalog.find(item => item.slug === "approval-desk")?.enabled), operationsOpen: !config.maintenanceMode && config.scansOpen && config.approvalDiscoveryOpen, job }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const actor = await workspaceActor();
  if (!actor || !canAccessLiveApprovalScanner(actor, true)) return NextResponse.json({ error: "Live scanner management permission required." }, { status: 403 });
  const audit = { actorId: actor.id, organizationId: actor.organizationId, action: "approval:discovery", resource: "settings", targetType: "ApprovalScanJob", targetId: "approval-discovery:live", userAgent: request.headers.get("user-agent") ?? "" };
  try {
    const result = await runApprovalDiscovery();
    await AuthorizationAuditLog.create({ ...audit, outcome: "success", reason: "Administrator requested shared discovery", metadata: result });
    return NextResponse.json({ ok: true, ...result });
  }
  catch (error) {
    await AuthorizationAuditLog.create({ ...audit, outcome: "failed", reason: "Shared discovery failed; inspect scanner status" });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Discovery failed." }, { status: 503 });
  }
}
