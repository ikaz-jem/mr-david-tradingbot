import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { deleteHelpImage } from "@/lib/help-r2";
import { HelpAsset } from "@/models/HelpAsset";
import { schedulerAuthorized } from "@/lib/scheduler-policy";
import { runScheduledJob } from "@/lib/scheduled-job";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(request: Request) {
  if (!schedulerAuthorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const result = await runScheduledJob("help-assets", cleanup, request.headers.get("x-scheduler-recovery") === "true");
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Image cleanup needs retry." }, { status: 503 }); }
}
async function cleanup() {
  await connectDB();
  const pending = await HelpAsset.find({ $or: [{ status: "deletion_pending" }, { status: "upload_pending", createdAt: { $lt: new Date(Date.now() - 10 * 60_000) } }] }).sort({ createdAt: 1 }).limit(100);
  let cleaned = 0;
  for (const asset of pending) { try { await deleteHelpImage(asset.key, asset.key.startsWith("help/demo/")); await asset.deleteOne(); cleaned++; } catch { /* Retain record for next scheduled retry. */ } }
  return { attempted: pending.length, cleaned };
}
