import "server-only";
import { HelpSearchBucket } from "@/models/HelpSearchBucket";
export async function allowHelpMutation(actorId: string) {
  const minute = Math.floor(Date.now() / 60_000);
  const key = "help-mutation:" + actorId + ":" + minute;
  let bucket;
  try { bucket = await HelpSearchBucket.findOneAndUpdate({ key }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((minute + 2) * 60_000) } }, { upsert: true, returnDocument: "after" }).lean(); }
  catch (error) { if ((error as { code?: number }).code !== 11000) throw error; bucket = await HelpSearchBucket.findOneAndUpdate({ key }, { $inc: { count: 1 } }, { returnDocument: "after" }).lean(); }
  return Boolean(bucket && bucket.count <= 30);
}
