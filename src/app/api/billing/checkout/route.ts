import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { workspaceActor } from "@/lib/workspace-access";
import { getPlatformConfig } from "@/lib/platform-config";
import { getGateway, gatewayReady, providerRequest, PaymentProviderError } from "@/lib/payment-gateways";
import { cryptoPaymentCurrencies } from "@/lib/crypto-payment-currencies";
import { getAccountCreditState } from "@/lib/credits";
import { BillingPurchase } from "@/models/BillingPurchase";
import { User } from "@/models/User";
import { isSameOrigin } from "@/lib/request-origin";

const schema = z.object({ kind: z.enum(["activation", "topup"]), itemId: z.string().min(2).max(40), provider: z.enum(["paystack", "nowpayments"]).default("paystack"), payCurrency: z.string().regex(/^[a-z0-9]{2,30}$/).default("usdtbsc") });
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const actor = await workspaceActor();
  if (!actor) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Select a valid product and payment method." }, { status: 400 });
  const { kind, itemId, provider, payCurrency } = parsed.data;
  let reference = "";
  try {
    const [platform, gateway, account, user] = await Promise.all([getPlatformConfig(actor.isDemo), getGateway(provider, actor.isDemo), getAccountCreditState(actor.id), User.findById(actor.id).select("email emailVerifiedAt").lean()]);
    if (!platform.billingOpen || platform.maintenanceMode) return NextResponse.json({ error: platform.maintenanceMode ? platform.maintenanceMessage : platform.billingPausedMessage }, { status: 503 });
    if (!gateway.enabled || !gatewayReady(gateway)) return NextResponse.json({ error: "This payment method is unavailable." }, { status: 503 });
    if (!actor.isDemo && (!user?.emailVerifiedAt || gateway.mode !== "live")) return NextResponse.json({ error: "Verify your email before paying." }, { status: 403 });
    if (actor.isDemo && gateway.mode === "live") return NextResponse.json({ error: "Demo accounts cannot make live payments." }, { status: 403 });
    const pack = platform.creditPacks.find(row => row.id === itemId && row.enabled);
    if (kind === "activation" && (itemId !== "account_activation" || !platform.activationOpen || account.activated)) return NextResponse.json({ error: "Activation is unavailable or already complete." }, { status: 409 });
    if (kind === "topup" && (!pack || !account.activated)) return NextResponse.json({ error: "Activate your account and choose an available credit pack." }, { status: 409 });
    const amountUsd = kind === "activation" ? platform.activationPriceMinor : pack!.priceMinor;
    const credits = kind === "activation" ? platform.activationCredits : pack!.credits;
    const expectedAmount = provider === "nowpayments" || gateway.mode === "demo" ? amountUsd : Math.round(amountUsd * gateway.ratePerUsd);
    const currency = gateway.mode === "demo" ? "USD" : gateway.currency;
    if (!Number.isSafeInteger(expectedAmount) || expectedAmount < 1) throw new Error("Invalid payment amount");
    const coin = provider === "nowpayments" ? (await cryptoPaymentCurrencies(gateway)).find(row => row.code === payCurrency) : null;
    if (provider === "nowpayments" && !coin) return NextResponse.json({ error: "This asset/network is not enabled for your merchant. Refresh the currency list and choose another." }, { status: 400 });
    const checkoutLock = `${actor.id}:${kind}:${itemId}:${provider}${provider === "nowpayments" ? `:${payCurrency}` : ""}`;
    await BillingPurchase.init();
    const existing = await BillingPurchase.findOne({ checkoutLock }).lean();
    if (existing) return NextResponse.json({ url: `/dashboard/checkout/${existing.reference}` });
    const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL;
    if (!appUrl) throw new Error("Configure APP_URL before checkout");
    const appOrigin = new URL(appUrl).origin;
    if (gateway.mode !== "demo" && new URL(appOrigin).protocol !== "https:") return NextResponse.json({ error: "Provider checkout requires a public HTTPS APP_URL for payment callbacks." }, { status: 503 });
    reference = `enrivea-${randomBytes(16).toString("hex")}`;
    try {
      await BillingPurchase.create({ userId: actor.id, productId: "platform", kind, itemId, credits, reference, expectedAmount, currency, provider, mode: gateway.mode, isDemo: actor.isDemo, gatewayId: gateway.id, catalogAmountUsd: amountUsd, checkoutLock, payCurrency, payNetwork: coin?.network || "" });
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === 11000) {
        const concurrent = await BillingPurchase.findOne({ checkoutLock }).lean();
        if (concurrent) return NextResponse.json({ url: `/dashboard/checkout/${concurrent.reference}` });
      }
      throw error;
    }
    if (gateway.mode === "demo") {
      await BillingPurchase.updateOne({ reference }, { $set: { status: "pending", providerStatus: "simulation", payAmount: (amountUsd / 100).toFixed(2) } });
    } else if (provider === "paystack") {
      const result = await providerRequest<{ reference: string; authorization_url: string }>(gateway, "transaction/initialize", { email: actor.email, amount: expectedAmount, currency, reference, callback_url: `${appOrigin}/dashboard/checkout/${reference}`, metadata: { kind, itemId } });
      const url = new URL(result.authorization_url);
      if (result.reference !== reference || url.protocol !== "https:" || url.hostname !== "checkout.paystack.com") throw new Error("Invalid checkout destination");
      await BillingPurchase.updateOne({ reference, status: { $ne: "paid" } }, { $set: { authorizationUrl: url.toString(), status: "pending" } });
    } else {
      const result = await providerRequest<{ payment_id: string | number; pay_address: string; pay_amount: number | string; pay_currency: string; payin_extra_id?: string | number | null }>(gateway, "payment", { price_amount: amountUsd / 100, price_currency: "usd", pay_currency: payCurrency, order_id: reference, order_description: kind === "activation" ? "Enrivea account activation" : `${credits} Enrivea credits`, ipn_callback_url: `${appOrigin}/api/webhooks/nowpayments` });
      if (!/^\d+$/.test(String(result.payment_id)) || typeof result.pay_address !== "string" || !result.pay_address.trim() || result.pay_address.length > 512 || result.pay_currency.toLowerCase() !== payCurrency || !Number.isFinite(Number(result.pay_amount)) || Number(result.pay_amount) <= 0 || (coin?.extraIdRequired && result.payin_extra_id == null)) throw new Error("Invalid crypto payment details");
      await BillingPurchase.updateOne({ reference, status: { $ne: "paid" } }, { $set: { providerPaymentId: String(result.payment_id), payAddress: result.pay_address, payAmount: String(result.pay_amount), payExtraId: result.payin_extra_id == null ? "" : String(result.payin_extra_id), status: "pending", providerStatus: "waiting" } });
    }
    return NextResponse.json({ url: `/dashboard/checkout/${reference}` });
  } catch (error) {
    const failureCode = error instanceof PaymentProviderError ? error.code : "INITIALIZATION_FAILED";
    if (reference) await BillingPurchase.updateOne({ reference, status: "initializing" }, { $set: { status: "review", checkoutLock: null, failureCode } }).catch(() => undefined);
    console.error("Checkout initialization failed", { reference, provider, failureCode });
    return NextResponse.json({ error: error instanceof PaymentProviderError ? error.message : "Unable to start payment. Check your payment history before retrying, or contact support.", reference: reference || undefined, code: failureCode }, { status: 503 });
  }
}
