import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Public liveness only: do not expose database, provider, credential, or deployment details here.
export function GET() {
  return NextResponse.json(
    { status: "ok", service: "enrivea-signal", time: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
