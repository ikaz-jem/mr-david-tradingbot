import "server-only";
import { connectDB } from "@/lib/db";
import { SecurityAttempt } from "@/models/SecurityAttempt";

export async function consumeAdminMutationLimit(actorId: string, action: string, limit = 20, windowMs = 60_000) {
  await connectDB();
  const bucket = Math.floor(Date.now() / windowMs);
  const safeAction = action.replaceAll(/[^a-z0-9:_-]/gi, "-").slice(0, 80);
  const key = `admin-mutation:${safeAction}:${actorId}:${bucket}`;
  const row = await SecurityAttempt.findOneAndUpdate(
    { key },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * windowMs) } },
    { upsert: true, returnDocument: "after" },
  );
  return (row?.count ?? 0) <= limit;
}
