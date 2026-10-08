import { NextResponse } from "next/server";
import { z } from "zod";
import { workspaceActor } from "@/lib/workspace-access";
import { isSameOrigin } from "@/lib/request-origin";
import { getGateway, publicGateway, providerRequest, PaymentProviderError } from "@/lib/payment-gateways";
import { cryptoPaymentCurrencies } from "@/lib/crypto-payment-currencies";
import { PaymentGateway } from "@/models/PaymentGateway";
import { encryptServiceSecret } from "@/lib/service-config";
import { AdminAuditEvent } from "@/models/AdminAuditEvent";
import { connectDB } from "@/lib/db";

export async function GET(request: Request) {
  const actor = await workspaceActor();
  if (actor?.organizationKind !== "platform" || !actor.can("settings:read")) return NextResponse.json({ error: "Settings permission required." }, { status: 403 });
  const verify = new URL(request.url).searchParams.get("verify");
  if (verify === "paystack" || verify === "nowpayments") {
    try {
      const gateway = await getGateway(verify, actor.isDemo);
      if (gateway.mode === "demo") return NextResponse.json({ message: "Simulation does not contact a provider. Sign in with a real admin account to configure live payments." });
      if (!gateway.key) return NextResponse.json({ error: "No API key configured." }, { status: 400 });
      const currencies = verify === "nowpayments" ? await cryptoPaymentCurrencies(gateway, true) : [];
      if (verify === "paystack") await providerRequest(gateway, "balance");
      return NextResponse.json({ message: `${gateway.mode} API credentials accepted.${verify === "nowpayments" ? ` ${currencies.length} merchant assets available. This does not verify the IPN secret or payout wallet.` : " This does not verify checkout or webhook delivery."}` });
    } catch (error) { return NextResponse.json({ error: error instanceof PaymentProviderError ? error.message : "Provider connectivity check failed." }, { status: 503 }); }
  }
  const gateways = await Promise.all([getGateway("paystack", actor.isDemo), getGateway("nowpayments", actor.isDemo)]);
  return NextResponse.json({ gateways: gateways.map(publicGateway), isDemo: actor.isDemo, canEdit: actor.can("settings:update") }, { headers: { "Cache-Control": "no-store" } });
}
const schema = z.object({ provider: z.enum(["paystack", "nowpayments"]), enabled: z.boolean(), mode: z.enum(["demo", "test", "live"]), currency: z.enum(["NGN", "USD", "GHS", "ZAR", "KES"]), ratePerUsd: z.number().min(0).max(1000000), apiKey: z.string().max(1000).default(""), webhookSecret: z.string().max(1000).default(""), clearSecrets: z.boolean().default(false), reason: z.string().trim().min(8).max(300) });
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const actor = await workspaceActor();
  if (actor?.organizationKind !== "platform" || !actor.can("settings:update")) return NextResponse.json({ error: "Settings update permission required." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the configuration and enter an audit reason." }, { status: 400 });
  const input = parsed.data;
  if (actor.isDemo ? input.mode === "live" : input.mode !== "live") return NextResponse.json({ error: "Use demo accounts for simulation and provider test mode; real accounts use live payments." }, { status: 400 });
  try {
    const db = await connectDB();
    const previous = await getGateway(input.provider, actor.isDemo);
    const key = input.apiKey.trim() || (input.clearSecrets ? "" : previous.key);
    const secret = input.webhookSecret.trim() || (input.clearSecrets ? "" : previous.webhookSecret);
    if (input.enabled && input.mode !== "demo") {
      if (input.provider === "paystack" && (!key.startsWith(input.mode === "live" ? "sk_live_" : "sk_test_") || input.ratePerUsd <= 0)) throw new Error("Enter a matching Paystack key and settlement exchange rate.");
      if (input.provider === "nowpayments" && (!key || !secret)) throw new Error("Enter the NOWPayments API key and IPN secret.");
      const candidate = { ...previous, key, webhookSecret: secret, mode: input.mode, currency: input.currency, ratePerUsd: input.ratePerUsd };
      await providerRequest(candidate, input.provider === "nowpayments" ? "merchant/coins" : "balance");
    }
    await db.connection.transaction(async session => {
      const [record] = await PaymentGateway.create([{ provider: input.provider, isDemo: actor.isDemo, enabled: input.enabled, mode: input.mode, currency: input.provider === "nowpayments" ? "USD" : input.currency, ratePerUsd: input.provider === "nowpayments" ? 1 : input.ratePerUsd, apiKeyEncrypted: key ? encryptServiceSecret(key, "paymentApiKey") : "", webhookSecretEncrypted: secret ? encryptServiceSecret(secret, "paymentWebhookSecret") : "", createdBy: actor.id }], { session });
      await AdminAuditEvent.create([{ actorId: actor.id, targetType: "platform", targetId: String(record._id), action: "payment_gateway_configuration", before: JSON.stringify(publicGateway(previous)), after: JSON.stringify({ provider: input.provider, enabled: input.enabled, mode: input.mode, currency: input.currency, ratePerUsd: input.ratePerUsd, credentialsChanged: Boolean(input.apiKey || input.webhookSecret || input.clearSecrets) }), reason: input.reason, status: "applied" }], { session });
    });
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof PaymentProviderError || (error instanceof Error && /Enter/.test(error.message)) ? error.message : "Unable to save payment settings." }, { status: 400 }); }
}
