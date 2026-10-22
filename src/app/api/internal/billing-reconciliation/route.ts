import { NextResponse } from "next/server";
import { schedulerAuthorized } from "@/lib/scheduler-policy";
import { runScheduledJob } from "@/lib/scheduled-job";
import { runBillingReconciliation } from "@/lib/billing-reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) {
  if (!schedulerAuthorized(request)) return NextResponse.json({ error: "Scheduler authorization required." }, { status: 401 });
  try { return NextResponse.json({ ok: true, ...await runScheduledJob("billing-reconciliation", runBillingReconciliation, request.headers.get("x-scheduler-recovery") === "true") }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "Payment recovery needs retry." }, { status: 503 }); }
}
