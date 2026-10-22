import { NextResponse } from "next/server";
import { runAutopilotWorker } from "@/lib/autopilot-engine";
import { schedulerAuthorized } from "@/lib/scheduler-policy";
import { runScheduledJob } from "@/lib/scheduled-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function run(request: Request) {
  if (!schedulerAuthorized(request)) return NextResponse.json({ error: "Scheduler authorization required." }, { status: 401 });
  try { return NextResponse.json({ ok: true, ...await runScheduledJob("autopilot", runAutopilotWorker, request.headers.get("x-scheduler-recovery") === "true") }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { console.error("Autopilot worker failed", error); return NextResponse.json({ error: "Autopilot worker failed." }, { status: 503 }); }
}
export const GET = run;
export const POST = run;
