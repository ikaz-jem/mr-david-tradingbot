import { NextResponse } from "next/server";
import { schedulerAuthorized } from "@/lib/scheduler-policy";
import { operationalHealth } from "@/lib/operational-health";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only monitoring probe. Never accepts a public/demo session as authority.
export async function GET(request: Request) {
  if (!schedulerAuthorized(request)) return NextResponse.json({ error: "Monitoring authorization required." }, { status: 401 });
  try {
    const health = await operationalHealth();
    return NextResponse.json(health, { status: health.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ ok: false, error: "Database or worker health is unavailable." }, { status: 503 }); }
}
