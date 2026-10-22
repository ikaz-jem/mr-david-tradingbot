import { NextResponse } from "next/server";
import { runApprovalDiscovery } from "@/lib/approval-engine";
import { schedulerAuthorized } from "@/lib/scheduler-policy";
import { runScheduledJob } from "@/lib/scheduled-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function run(request: Request) {
  if (!schedulerAuthorized(request)) return NextResponse.json({ error: "Scheduler authorization required." }, { status: 401 });
  try {
    const result = await runScheduledJob("approval-scan", runApprovalDiscovery, request.headers.get("x-scheduler-recovery") === "true");
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Approval discovery failed", error);
    return NextResponse.json({ error: "Approval discovery failed. Check the worker logs." }, { status: 503 });
  }
}

export const GET = run;
export const POST = run;
