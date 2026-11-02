import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { schedulerAuthorized } from "@/lib/scheduler-policy";
import { deliverPendingPush } from "@/lib/push-delivery";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  if (!schedulerAuthorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  await connectDB();
  return NextResponse.json(await deliverPendingPush(), { headers: { "Cache-Control": "no-store" } });
}
