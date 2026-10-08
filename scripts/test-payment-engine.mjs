import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import mongoose from "mongoose";
import { createHmac } from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
  if (specifier === "next/server") return nextResolve("next/server.js", context);
  if (specifier.startsWith("@/")) return nextResolve(pathToFileURL(path.join(root, "src", `${specifier.slice(2)}.ts`)).href, context);
  return nextResolve(specifier, context);
} });
const { User } = await import("../src/models/User.ts");
const { BillingPurchase } = await import("../src/models/BillingPurchase.ts");
const { PaymentGateway } = await import("../src/models/PaymentGateway.ts");
const { AffiliateAccount, AffiliateCommission } = await import("../src/models/Affiliate.ts");
const { CreditEntry } = await import("../src/models/CreditEntry.ts");
const { encryptServiceSecret } = await import("../src/lib/service-config.ts");
const { verifyPayment } = await import("../src/lib/payment-verification.ts");
const { sortedPayload } = await import("../src/lib/payment-policy.ts");
const { POST: cryptoWebhook } = await import("../src/app/api/webhooks/nowpayments/route.ts");
const { POST: paystackWebhook } = await import("../src/app/api/webhooks/paystack-live/route.ts");
const database = `enrivea_payment_test_${Date.now()}`;
await mongoose.connect(process.env.MONGODB_URI, { dbName: database, serverSelectionTimeoutMS: 10000 });
const originalFetch = globalThis.fetch;
try {
  await Promise.all([User.init(), BillingPurchase.init(), PaymentGateway.init(), AffiliateAccount.init(), AffiliateCommission.init(), CreditEntry.init()]);
  const referrer = await User.create({ name: "Referrer", email: "referrer@example.invalid", passwordHash: "not-a-login", settings: { emailBilling: false } });
  const user = await User.create({ name: "Buyer", email: "buyer@example.invalid", passwordHash: "not-a-login", emailVerifiedAt: new Date(), settings: { emailBilling: false } });
  await AffiliateAccount.create({ userId: user._id, sponsorId: referrer._id, isDemo: false, code: "a".repeat(24) });
  const secret = "test-ipn-secret";
  const crypto = await PaymentGateway.create({ provider: "nowpayments", isDemo: false, enabled: true, mode: "live", currency: "USD", apiKeyEncrypted: encryptServiceSecret("test-crypto-api", "paymentApiKey"), webhookSecretEncrypted: encryptServiceSecret(secret, "paymentWebhookSecret"), createdBy: referrer._id });
  const card = await PaymentGateway.create({ provider: "paystack", isDemo: false, enabled: true, mode: "live", currency: "NGN", ratePerUsd: 1500, apiKeyEncrypted: encryptServiceSecret("sk_live_mock_only", "paymentApiKey"), createdBy: referrer._id });
  const reference = `enrivea-${"a".repeat(32)}`;
  await BillingPurchase.create({ userId: user._id, reference, kind: "activation", itemId: "account_activation", credits: 100, expectedAmount: 3000, currency: "USD", provider: "nowpayments", mode: "live", gatewayId: crypto._id, providerPaymentId: "1234", payAmount: "30", status: "pending" });
  let cryptoResponse = { payment_id: 1234, order_id: reference, payment_status: "partially_paid", price_amount: 30, price_currency: "usd", pay_currency: "usdtbsc", pay_amount: 30, actually_paid: 20 };
  let cardResponse;
  globalThis.fetch = async url => {
    if (String(url) === "https://api.nowpayments.io/v1/payment/1234") return Response.json(cryptoResponse);
    if (String(url).startsWith("https://api.paystack.co/transaction/verify/")) return Response.json({ status: true, data: cardResponse });
    throw new Error(`Unexpected external request blocked: ${url}`);
  };
  assert.equal(await verifyPayment(reference), "review");
  assert.equal((await User.findById(user._id)).creditBalance, 0);
  cryptoResponse = { ...cryptoResponse, payment_status: "finished", actually_paid: 30 };
  const body = JSON.stringify(cryptoResponse);
  let response = await cryptoWebhook(new Request("https://example.invalid/api/webhooks/nowpayments", { method: "POST", body, headers: { "x-nowpayments-sig": "0".repeat(128) } }));
  assert.equal(response.status, 400);
  const signature = createHmac("sha512", secret).update(JSON.stringify(sortedPayload(cryptoResponse))).digest("hex");
  response = await cryptoWebhook(new Request("https://example.invalid/api/webhooks/nowpayments", { method: "POST", body, headers: { "x-nowpayments-sig": signature } }));
  assert.equal(response.status, 200, await response.text());
  assert.equal((await User.findById(user._id)).creditBalance, 100);
  assert.ok((await User.findById(user._id)).activatedAt);
  assert.equal(await AffiliateCommission.countDocuments({}), 1);
  assert.equal((await AffiliateCommission.findOne()).amountMinor, 300);
  await verifyPayment(reference);
  assert.equal(await CreditEntry.countDocuments({}), 1);
  const refill = `enrivea-${"b".repeat(32)}`;
  await BillingPurchase.create({ userId: user._id, reference: refill, kind: "topup", itemId: "credits_25", credits: 25, expectedAmount: 2250000, currency: "NGN", provider: "paystack", mode: "live", gatewayId: card._id, status: "pending" });
  cardResponse = { id: 5678, reference: refill, domain: "live", status: "success", amount: 2250000, currency: "NGN", customer: { email: user.email } };
  const cardBody = JSON.stringify({ event: "charge.success", data: { reference: refill } });
  const cardSignature = createHmac("sha512", "sk_live_mock_only").update(cardBody).digest("hex");
  response = await paystackWebhook(new Request("https://example.invalid/api/webhooks/paystack-live", { method: "POST", body: cardBody, headers: { "x-paystack-signature": cardSignature } }));
  assert.equal(response.status, 200, await response.text());
  assert.equal((await User.findById(user._id)).creditBalance, 125);
  const { cryptoPaymentCurrencies } = await import('../src/lib/crypto-payment-currencies.ts');
  const { getGateway, providerRequest, PaymentProviderError } = await import('../src/lib/payment-gateways.ts');
  const gateway = await getGateway('nowpayments', false, String(crypto._id));
  globalThis.fetch = async url => {
    if (String(url).endsWith('/currencies')) return Response.json({ currencies: ['btc', 'usdtbsc', 'usdttrc20'] });
    if (String(url).endsWith('/merchant/coins')) return Response.json({ selectedCurrencies: ['BTC', 'USDTBSC'] });
    if (String(url).endsWith('/full-currencies')) return Response.json({ currencies: [
      { code: 'BTC', name: 'Bitcoin', enable: true, available_for_payment: true, network: 'btc' },
      { code: 'USDTBSC', name: 'Tether', enable: true, available_for_payment: false, network: 'bsc' },
      { code: 'USDTTRC20', name: 'Tether', enable: true, available_for_payment: true, network: 'trx' },
    ] });
    throw new Error('Unexpected provider request');
  };
  assert.deepEqual((await cryptoPaymentCurrencies(gateway, true)).map(coin => coin.code), ['btc'], 'Only selected, available merchant currencies are offered');
  globalThis.fetch = async () => Response.json({ code: 'INVALID_API_KEY', message: 'sensitive-provider-detail' }, { status: 403 });
  await assert.rejects(() => providerRequest(gateway, 'currencies'), error => error instanceof PaymentProviderError && error.code === 'CREDENTIALS_REJECTED' && !error.message.includes('sensitive-provider-detail'));
  assert.equal(await AffiliateCommission.countDocuments({}), 1, "Second gateway must not award another referral commission");
  await verifyPayment(refill);
  assert.equal((await User.findById(user._id)).creditBalance, 125);
  console.log("PASS: mocked provider verification + real DB; signed crypto activation, Paystack refill, partial-payment rejection, invalid signatures, duplicate protection, and cross-gateway first-purchase commission.");
} finally {
  globalThis.fetch = originalFetch;
  if (mongoose.connection.name !== database || !/^enrivea_payment_test_\d+$/.test(database)) throw new Error("Unexpected database; refusing cleanup");
  await mongoose.connection.dropDatabase(); await mongoose.disconnect();
}
