import { connectDB } from "@/lib/db";
import { BillingPurchase } from "@/models/BillingPurchase";
import { User } from "@/models/User";
import { CreditEntry } from "@/models/CreditEntry";
import { DemoWorkspace } from "@/models/DemoWorkspace";
import { ensureDemoWorkspace } from "@/lib/demo-workspace";
import { activateAccount, addPurchasedCredits } from "@/lib/credits";
import { creditFirstPurchase, initializeAffiliateLedger } from "@/lib/affiliates";
import { notifyUser } from "@/lib/notifications";
import { accountEventEmail, sendEmail } from "@/lib/email";

// Only provider verification or the authenticated demo simulator may call this function.
export async function fulfillPayment(reference: string, transactionId: string) {
  const db = await connectDB();
  await Promise.all([BillingPurchase.init(), CreditEntry.init(), initializeAffiliateLedger()]);
  const initial = await BillingPurchase.findOne({ reference }).lean();
  if (!initial) throw new Error("Payment not found");
  if (initial.isDemo) await ensureDemoWorkspace(String(initial.userId));
  const result = await db.connection.transaction(async session => {
    const purchase = await BillingPurchase.findOne({ reference }).session(session);
    if (!purchase || purchase.status === "paid") return "duplicate";
    if (!["activation", "topup"].includes(purchase.kind)) throw new Error("Unsupported purchase");
    const user = await User.findOne({ _id: purchase.userId, status: "active" }).session(session).lean();
    if (!user || Boolean(user.isDemo) !== Boolean(purchase.isDemo) || (!user.isDemo && purchase.mode !== "live") || (user.isDemo && purchase.mode === "live")) throw new Error("Payment environment does not match account");
    const workspace = user.isDemo ? await DemoWorkspace.findOne({ userId: user._id }).session(session) : null;
    const activated = user.isDemo ? workspace?.activatedAt : user.activatedAt;
    if (purchase.kind === "activation" ? Boolean(activated) : !activated) {
      purchase.status = "review"; purchase.checkoutLock = null; await purchase.save({ session }); return "review";
    }
    purchase.status = "paid"; purchase.verifiedAt = new Date(); purchase.providerTransactionId = transactionId; purchase.checkoutLock = null;
    await purchase.save({ session });
    if (user.isDemo) {
      if (!workspace) throw new Error("Demo workspace missing");
      if (purchase.kind === "activation") workspace.activatedAt = new Date();
      workspace.creditBalance += purchase.credits;
      workspace.revision++;
      workspace.receipts.push({ requestId: purchase.reference, kind: purchase.kind, productId: "platform", itemId: purchase.itemId, amount: (purchase.catalogAmountUsd ?? purchase.expectedAmount) / 100, credits: purchase.credits, createdAt: new Date() });
      workspace.activity.push({ productId: "platform", amount: purchase.credits, note: `${purchase.provider} ${purchase.mode} payment`, createdAt: new Date() });
      await workspace.save({ session });
    } else {
      if (purchase.kind === "activation") await activateAccount(purchase.userId, purchase.credits, reference, session);
      else await addPurchasedCredits(purchase.userId, purchase.credits, reference, `${purchase.credits} platform credit refill`, session);
      await creditFirstPurchase(purchase, session);
    }
    return "paid";
  });
  if (result === "paid") {
    const title = initial.kind === "activation" ? "Account activated" : "Credits added";
    const message = `${initial.credits} platform credits were added${initial.isDemo ? " to your demo balance. No real payment was taken" : ""}.`;
    await notifyUser({ userId: String(initial.userId), kind: "billing", title, body: message, href: "/dashboard/credits", sourceKey: `payment:${reference}` }).catch(() => undefined);
    const user = await User.findById(initial.userId).select("name email settings").lean();
    if (!initial.isDemo && user && user.settings?.emailBilling !== false && process.env.APP_URL) {
      await sendEmail({ to: user.email, category: "billing", eventKey: `payment:${reference}`, ...accountEventEmail(user.name, title, message, new URL("/dashboard/credits", process.env.APP_URL).toString()) }).catch(() => undefined);
    }
  }
  return result;
}
