import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runAutopilotWorker } from "@/lib/autopilot-engine";
import { workspaceActor } from "@/lib/workspace-access";
import { isSameOrigin } from "@/lib/request-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function cronAuthorized(request: Request) {
  const configured = process.env.CRON_SECRET; const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!configured || !supplied) return false;
  const expected = Buffer.from(configured); const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
async function authorized(request: Request) {
  if (cronAuthorized(request)) return true;
  if (request.method !== "POST" || !isSameOrigin(request)) return false;
  const actor = await workspaceActor(); return Boolean(actor?.can("orders:update"));
}
async function run(request: Request) {
  if (!await authorized(request)) return NextResponse.json({ error: "Scheduler authorization required." }, { status: 401 });
  try { return NextResponse.json({ ok: true, ...await runAutopilotWorker() }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { console.error("Autopilot worker failed", error); return NextResponse.json({ error: "Autopilot worker failed." }, { status: 503 }); }
}
export const GET = run;
export const POST = run;
