import mongoose from "mongoose";
import { CreditEntry } from "@/models/CreditEntry";
import { User } from "@/models/User";

export async function ensureWelcomeCredits(userId: string) {
  const sourceKey = `welcome:${userId}`;
  await CreditEntry.updateOne({ sourceKey }, { $setOnInsert: { userId: new mongoose.Types.ObjectId(userId), amount: 5, kind: "welcome", sourceKey, note: "Welcome analyses" } }, { upsert: true });
}

export async function getCreditBalance(userId: string) {
  await ensureWelcomeCredits(userId);
  const user = await User.findById(userId).select("creditBalance").lean();
  return user?.creditBalance ?? 0;
}
