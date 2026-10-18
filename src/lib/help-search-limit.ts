import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { HelpSearchBucket } from "@/models/HelpSearchBucket";
export async function allowHelpSearch() {
  const requestHeaders = await headers();
  const identity = (requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown") + "|" + (requestHeaders.get("user-agent") || "unknown");
  const minute = Math.floor(Date.now() / 60_000);
  const secret = process.env.HELP_FEEDBACK_SALT || process.env.NEXTAUTH_SECRET || "help-search";
  const key = createHash("sha256").update(secret + identity + minute).digest("hex");
  let bucket;
  try { bucket = await HelpSearchBucket.findOneAndUpdate({ key }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((minute + 2) * 60_000) } }, { upsert: true, returnDocument: "after" }).lean(); }
  catch (error) { if ((error as { code?: number }).code !== 11000) throw error; bucket = await HelpSearchBucket.findOneAndUpdate({ key }, { $inc: { count: 1 } }, { returnDocument: "after" }).lean(); }
  return Boolean(bucket && bucket.count <= 60);
}
