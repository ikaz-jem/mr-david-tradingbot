import mongoose from "mongoose";
import { CreditEntry } from "@/models/CreditEntry";
import { User } from "@/models/User";

export const PLATFORM_CREDIT_ID = "platform";

export async function getAccountCreditState(userId: string) {
  const user = await User.findById(userId).select("creditBalance activatedAt isDemo").lean();
  if (!user) throw new Error("Account unavailable");
  if (user.isDemo) {
    // Keep the server-only demo workspace out of live transaction workers and
    // maintenance scripts that only use the production credit helpers below.
    const { ensureDemoWorkspace } = await import("@/lib/demo-workspace");
    const workspace = await ensureDemoWorkspace(userId);
    return { balance: workspace?.creditBalance ?? 0, activated: Boolean(workspace?.activatedAt) };
  }
  return { balance: user.creditBalance, activated: Boolean(user.activatedAt) };
}

export async function getCreditBalance(userId: string) {
  return (await getAccountCreditState(userId)).balance;
}

export async function activateAccount(userId: mongoose.Types.ObjectId, credits: number, reference: string, session: mongoose.ClientSession) {
  const user = await User.findOneAndUpdate(
    { _id: userId, status: "active", isDemo: false, activatedAt: null },
    { $set: { activatedAt: new Date(), activationReference: reference }, $inc: { creditBalance: credits } },
    { returnDocument: "after", session },
  );
  if (!user) throw new Error("Account is already activated or unavailable");
  await CreditEntry.create([{ userId, productId: PLATFORM_CREDIT_ID, amount: credits, kind: "purchase", sourceKey: `activation:${reference}`, note: "Account activation credit grant" }], { session });
  return user;
}

export async function addPurchasedCredits(userId: mongoose.Types.ObjectId, credits: number, reference: string, label: string, session: mongoose.ClientSession) {
  const user = await User.findOneAndUpdate(
    { _id: userId, status: "active", isDemo: false, activatedAt: { $ne: null } },
    { $inc: { creditBalance: credits } },
    { returnDocument: "after", session },
  );
  if (!user) throw new Error("Activate the account before adding credits");
  await CreditEntry.create([{ userId, productId: PLATFORM_CREDIT_ID, amount: credits, kind: "purchase", sourceKey: `topup:${reference}`, note: label }], { session });
  return user;
}
