import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { deleteHelpImage } from "@/lib/help-r2";
import { HelpAsset } from "@/models/HelpAsset";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16 || request.headers.get("authorization") !== "Bearer " + secret) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  await connectDB();
  const pending = await HelpAsset.find({ $or: [{ status: "deletion_pending" }, { status: "upload_pending", createdAt: { $lt: new Date(Date.now() - 10 * 60_000) } }] }).sort({ createdAt: 1 }).limit(100);
  let cleaned = 0;
  for (const asset of pending) { try { await deleteHelpImage(asset.key, asset.key.startsWith("help/demo/")); await asset.deleteOne(); cleaned++; } catch { /* Retain record for next scheduled retry. */ } }
  return NextResponse.json({ attempted: pending.length, cleaned });
}
