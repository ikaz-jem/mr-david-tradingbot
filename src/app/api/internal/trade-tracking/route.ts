import { NextResponse } from "next/server";
import { runTradeTracking } from "@/lib/trade-tracking";
import { schedulerAuthorized } from "@/lib/scheduler-policy";
import { runScheduledJob } from "@/lib/scheduled-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!schedulerAuthorized(request)) return NextResponse.json({ error: "Scheduler authorization required." }, { status: 401 });
  try { return NextResponse.json({ ok: true, ...await runScheduledJob("trade-tracking", runTradeTracking, request.headers.get("x-scheduler-recovery") === "true") }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { console.error("Trade tracking worker failed", error); return NextResponse.json({ error: "Trade tracking worker failed." }, { status: 503 }); }
}
