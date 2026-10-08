import { PaymentGateway } from "@/models/PaymentGateway";
import { decryptServiceSecret } from "@/lib/service-config";
import { connectDB } from "@/lib/db";

export type GatewayName = "paystack" | "nowpayments";
export async function getGateway(provider: GatewayName, isDemo: boolean, id?: string) {
  await connectDB();
  const stored = await PaymentGateway.findOne(id ? { _id: id, provider, isDemo } : { provider, isDemo }).select("+apiKeyEncrypted +webhookSecretEncrypted").sort({ createdAt: -1, _id: -1 }).lean();
  const key = stored?.apiKeyEncrypted ? decryptServiceSecret(stored.apiKeyEncrypted, "paymentApiKey") : "";
  const webhookSecret = stored?.webhookSecretEncrypted ? decryptServiceSecret(stored.webhookSecretEncrypted, "paymentWebhookSecret") : "";
  return { id: stored ? String(stored._id) : null, provider, isDemo, enabled: stored?.enabled ?? isDemo, mode: stored?.mode ?? (isDemo ? "demo" : "live"), currency: provider === "nowpayments" ? "USD" : stored?.currency ?? "NGN", ratePerUsd: provider === "nowpayments" ? 1 : stored?.ratePerUsd ?? 0, key, webhookSecret };
}
export type Gateway = Awaited<ReturnType<typeof getGateway>>;
export class PaymentProviderError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; this.name = "PaymentProviderError"; }
}
export function gatewayReady(gateway: Gateway) {
  return gateway.mode === "demo" ? gateway.isDemo : Boolean(gateway.key && (gateway.provider === "paystack" ? gateway.ratePerUsd > 0 && gateway.key.startsWith(gateway.mode === "live" ? "sk_live_" : "sk_test_") : gateway.webhookSecret));
}
export function publicGateway(gateway: Gateway) {
  const { key, webhookSecret, ...safe } = gateway;
  return { ...safe, ready: gatewayReady(gateway), keyConfigured: Boolean(key), webhookConfigured: Boolean(webhookSecret) };
}
export async function providerRequest<T>(gateway: Gateway, path: string, body?: unknown): Promise<T> {
  if (gateway.mode === "demo") throw new Error("Demo payments do not contact providers");
  const base = gateway.provider === "paystack" ? "https://api.paystack.co/" : gateway.mode === "test" ? "https://api-sandbox.nowpayments.io/v1/" : "https://api.nowpayments.io/v1/";
  const response = await fetch(base + path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", ...(gateway.provider === "paystack" ? { Authorization: `Bearer ${gateway.key}` } : { "x-api-key": gateway.key }) }, body: body ? JSON.stringify(body) : undefined, cache: "no-store", signal: AbortSignal.timeout(15000) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || (gateway.provider === "paystack" && result.status !== true)) {
    const code = typeof result.code === "string" ? result.code.toUpperCase() : `HTTP_${response.status}`;
    if ([401, 403].includes(response.status) || code === "INVALID_API_KEY") throw new PaymentProviderError("CREDENTIALS_REJECTED", `${gateway.provider === "paystack" ? "Paystack" : "NOWPayments"} rejected the ${gateway.mode} credentials. Live keys cannot be used in sandbox mode. Ask the administrator to check the matching gateway environment.`);
    if (/MIN|SMALL/.test(code)) throw new PaymentProviderError("BELOW_MINIMUM", "This amount is below the provider minimum for the selected asset/network. Choose a different asset or a larger credit pack.");
    if (/CURRENCY|PAIR|ROUTE/.test(code)) throw new PaymentProviderError("CURRENCY_UNAVAILABLE", "This asset/network is unavailable for your merchant payout configuration. Choose another or check the provider payout wallets.");
    if (response.status === 429) throw new PaymentProviderError("RATE_LIMITED", "The payment provider is busy. Wait a minute before trying again.");
    throw new PaymentProviderError(code.replace(/[^A-Z0-9_]/g, "").slice(0,60), `Payment provider could not start this request (HTTP ${response.status}). Ask support to check the merchant configuration and payment reference.`);
  }
  return gateway.provider === "paystack" ? result.data : result;
}
