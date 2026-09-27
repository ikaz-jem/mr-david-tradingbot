import mongoose from "mongoose";
import { CreditEntry } from "@/models/CreditEntry";
import { User } from "@/models/User";
import { ProductAccount } from "@/models/ProductAccount";

export const SIGNALS_PRODUCT_ID = "signals";

export async function ensureProductAccount(userId: string, productId = SIGNALS_PRODUCT_ID) {
  const owner = await User.findById(userId).select("creditBalance").lean();
  if (!owner) throw new Error("Account unavailable");
  await ProductAccount.updateOne({ userId, productId }, { $setOnInsert: { userId, productId, creditBalance: productId === SIGNALS_PRODUCT_ID ? owner.creditBalance : 0 } }, { upsert: true });
  return ProductAccount.findOne({ userId, productId });
}

export function productAccessActive(account: { subscriptionStatus: string; currentPeriodEnd?: Date | null }) {
  // Existing welcome credits remain usable until a paid subscription starts. Once a
  // subscription has existed, expiry blocks usage even if top-up credits remain.
  return account.subscriptionStatus === "none" || (account.subscriptionStatus === "active" && Boolean(account.currentPeriodEnd && account.currentPeriodEnd > new Date()));
}

export async function ensureWelcomeCredits(userId: string) {
  const sourceKey = `welcome:${userId}`;
  await CreditEntry.updateOne({ sourceKey }, { $setOnInsert: { userId: new mongoose.Types.ObjectId(userId), amount: 5, kind: "welcome", sourceKey, note: "Welcome analyses" } }, { upsert: true });
}

export async function getCreditBalance(userId: string) {
  await ensureWelcomeCredits(userId);
  const account = await ensureProductAccount(userId);
  return account?.creditBalance ?? 0;
}
