import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runApprovalDiscovery } from "@/lib/approval-engine";
import { workspaceActor } from "@/lib/workspace-access";
import { isSameOrigin } from "@/lib/request-origin";
import { canAccessLiveApprovalScanner } from "@/lib/approval-access-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function validCronSecret(request: Request) {
  const configured = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!configured || !supplied) return false;
  const expected = Buffer.from(configured);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function authorized(request: Request) {
  if (validCronSecret(request)) return true;
  if (request.method !== "POST" || !isSameOrigin(request)) return false;
  const actor = await workspaceActor();
  return canAccessLiveApprovalScanner(actor, true);
}

async function run(request: Request) {
  if (!await authorized(request)) return NextResponse.json({ error: "Scheduler authorization required." }, { status: 401 });
  try {
    const result = await runApprovalDiscovery();
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Approval discovery failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Approval discovery failed." }, { status: 503 });
  }
}

export const GET = run;
export const POST = run;
