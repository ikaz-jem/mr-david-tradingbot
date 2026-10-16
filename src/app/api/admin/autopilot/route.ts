import { NextResponse } from "next/server";
import { workspaceActor } from "@/lib/workspace-access";
import { isSameOrigin } from "@/lib/request-origin";
import { consumeAdminMutationLimit } from "@/lib/admin-mutation-limit";
import { writeSecurityAudit } from "@/lib/access-control";
import { runAutopilotWorker } from "@/lib/autopilot-engine";
import { getPlatformConfig } from "@/lib/platform-config";
import { getProductCatalog } from "@/lib/product-catalog";
import { AutopilotExecution } from "@/models/AutopilotExecution";
import { AutopilotJob } from "@/models/AutopilotJob";
import { AutopilotProfile } from "@/models/AutopilotProfile";

export const runtime = "nodejs";
export const maxDuration = 300;

async function snapshot(isDemo: boolean) {
  if (isDemo) return { demo: true, canRun: false, job: null, profiles: { running: 0, paused: 0, stopped: 0 }, executions: { day: 0, attention: 0 }, productEnabled: false, operationsOpen: false, certified: false, cronConfigured: false };
  const day = new Date(Date.now() - 86_400_000);
  const [job, running, paused, stopped, executions, attention, products, controls] = await Promise.all([
    AutopilotJob.findOne({ key: "autopilot:live" }).lean(),
    AutopilotProfile.countDocuments({ status: "running" }),
    AutopilotProfile.countDocuments({ status: "paused" }),
    AutopilotProfile.countDocuments({ status: "emergency_stopped" }),
    AutopilotExecution.countDocuments({ createdAt: { $gte: day } }),
    AutopilotExecution.countDocuments({ status: { $in: ["protection_failed", "submitted"] }, protectionStatus: { $ne: "active" } }),
    getProductCatalog(false), getPlatformConfig(false),
  ]);
  return { demo: false, job, profiles: { running, paused, stopped }, executions: { day: executions, attention }, productEnabled: Boolean(products.find(item => item.slug === "autopilot")?.enabled), operationsOpen: !controls.maintenanceMode && controls.autopilotOpen && controls.exchangeConnectionsOpen, certified: process.env.EXCHANGE_EXECUTION_CERTIFIED === "true", cronConfigured: Boolean(process.env.CRON_SECRET && process.env.CRON_SECRET.length >= 16) };
}

export async function GET() {
  try {
    const actor = await workspaceActor();
    if (actor?.organizationKind !== "platform" || !actor.can("settings:read")) return NextResponse.json({ error: "Autopilot operations read permission required." }, { status: 403 });
    return NextResponse.json({ ...(await snapshot(actor.isDemo)), canRun: !actor.isDemo && actor.can("settings:update") }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Autopilot operations status failed", error);
    return NextResponse.json({ error: "Autopilot status is temporarily unavailable. Check database connectivity and retry." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const actor = await workspaceActor();
  if (actor?.organizationKind !== "platform" || actor.isDemo || !actor.can("settings:update")) return NextResponse.json({ error: "Live Autopilot management permission required." }, { status: 403 });
  if (!await consumeAdminMutationLimit(actor.id, "autopilot:run", 5, 60_000)) return NextResponse.json({ error: "Too many worker requests. Wait one minute and retry." }, { status: 429 });
  try {
    const result = await runAutopilotWorker();
    await writeSecurityAudit({ actor, action: "autopilot.worker.run", resource: "settings", targetType: "AutopilotJob", targetId: "autopilot:live", newValue: result, outcome: "success", reason: "Administrator requested a guarded Autopilot cycle", request });
    return NextResponse.json({ ok: true, result, ...(await snapshot(false)), canRun: true });
  } catch (error) {
    await writeSecurityAudit({ actor, action: "autopilot.worker.run", resource: "settings", targetType: "AutopilotJob", targetId: "autopilot:live", outcome: "failed", reason: error instanceof Error ? error.message : "Worker failed", request }).catch(() => undefined);
    return NextResponse.json({ error: "Autopilot worker failed. Review the latest job status." }, { status: 503 });
  }
}
