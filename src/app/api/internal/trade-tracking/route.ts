import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runTradeTracking } from "@/lib/trade-tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const configured = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!configured || !supplied) return NextResponse.json({ error: "Scheduler authorization required." }, { status: 401 });
  const expected = Buffer.from(configured), actual = Buffer.from(supplied);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return NextResponse.json({ error: "Scheduler authorization required." }, { status: 401 });
  try { return NextResponse.json({ ok: true, ...await runTradeTracking() }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { console.error("Trade tracking worker failed", error); return NextResponse.json({ error: "Trade tracking worker failed." }, { status: 503 }); }
}
