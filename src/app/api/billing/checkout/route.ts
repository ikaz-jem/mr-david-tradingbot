import { randomBytes } from "node:crypto";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { billingPrice, liveBillingConfig, products, SIGNALS_PRODUCT_ID } from "@/lib/billing-catalog";
import { ensureProductAccount } from "@/lib/credits";
import { connectDB } from "@/lib/db";
import { paystackLiveRequest } from "@/lib/paystack-live";
import { isSameOrigin } from "@/lib/request-origin";
import { BillingPurchase } from "@/models/BillingPurchase";
import { User } from "@/models/User";

export const runtime = "nodejs";
const schema = z.object({ productId: z.literal("signals"), kind: z.enum(["monthly", "topup"]), itemId: z.enum(["starter", "trader", "desk", "topup_25", "topup_100"]) });
type Authorization = { reference: string; authorization_url: string };

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid billing item." }, { status: 400 });
  const { productId, kind, itemId } = parsed.data;
  const plan = products.signals.plans.find(item => item.id === itemId);
  const topup = products.signals.topups.find(item => item.id === itemId);
  if ((kind === "monthly" && !plan) || (kind === "topup" && !topup)) return NextResponse.json({ error: "This item is not available." }, { status: 400 });
  const config = liveBillingConfig();
  const amount = billingPrice(itemId);
  if (!config || !amount) return NextResponse.json({ error: "Live Paystack billing is not configured for this item." }, { status: 503 });
  let callbackUrl: string;
  try {
    const appOrigin = new URL(process.env.APP_URL!);
    if (appOrigin.protocol !== "https:" || appOrigin.origin !== new URL(process.env.NEXTAUTH_URL!).origin) throw new Error("Invalid app origin");
    callbackUrl = new URL("/dashboard/credits", appOrigin).toString();
  } catch { return NextResponse.json({ error: "Secure app URL is not configured for billing." }, { status: 503 }); }
  try {
    await connectDB();
    const user = await User.findOne({ _id: session.user.id, status: "active", isDemo: false, emailVerifiedAt: { $ne: null } }).select("email countryCode creditBalance").lean();
    if (!user) return NextResponse.json({ error: "Verified account required." }, { status: 403 });
    if (!user.countryCode || !config.countries.includes(user.countryCode.toUpperCase())) return NextResponse.json({ error: "Paystack checkout is unavailable in your account country." }, { status: 403 });
    const account = await ensureProductAccount(session.user.id, SIGNALS_PRODUCT_ID);
    if (!account) throw new Error("Product account unavailable");
    const active = account.subscriptionStatus === "active" && Boolean(account.currentPeriodEnd && account.currentPeriodEnd > new Date());
    if (kind === "topup" && !active) return NextResponse.json({ error: "Subscribe to Trade research before buying extra credits." }, { status: 403 });
    if (kind === "monthly" && active) return NextResponse.json({ error: "Your monthly access is still active. Renew after the current period ends." }, { status: 409 });
    const duplicate = await BillingPurchase.exists({ userId: user._id, productId, kind, status: { $in: ["initializing", "pending"] }, createdAt: { $gt: new Date(Date.now() - 15 * 60_000) } });
    if (duplicate) return NextResponse.json({ error: "A checkout is already open. Complete it or wait 15 minutes before trying again." }, { status: 409 });
    const reference = `enrivea-${randomBytes(16).toString("hex")}`;
    const purchase = await BillingPurchase.create({ userId: user._id, productId, kind, itemId, credits: plan?.credits ?? topup!.credits, reference, expectedAmount: amount, currency: config.currency });
    try {
      const authorization = await paystackLiveRequest<Authorization>("transaction/initialize", { method: "POST", body: { email: user.email, amount: String(amount), currency: config.currency, reference, callback_url: callbackUrl, metadata: JSON.stringify({ purchaseId: purchase.id, productId, kind }) } });
      if (authorization.reference !== reference || !authorization.authorization_url.startsWith("https://checkout.paystack.com/")) throw new Error("Invalid checkout response");
      await BillingPurchase.updateOne({ _id: purchase._id, status: "initializing" }, { $set: { status: "pending" } });
      return NextResponse.json({ url: authorization.authorization_url });
    } catch (error) {
      // A timeout is ambiguous: provider confirmation may still arrive.
      await BillingPurchase.updateOne({ _id: purchase._id, status: "initializing" }, { $set: { status: "review" } });
      throw error;
    }
  } catch (error) { console.error("Live checkout failed", error); return NextResponse.json({ error: "Checkout is unavailable. No credits were added." }, { status: 503 }); }
}
