import assert from "node:assert/strict";
import { test } from "node:test";
import { createHmac } from "node:crypto";
import { verifyNowSignature, sortedPayload, validCryptoSettlement } from "../src/lib/payment-policy.ts";
test("NOWPayments IPN authenticates recursively sorted payload and rejects forgery", () => {
  const payload = { z: { b: 2, a: 1 }, payment_status: "finished" };
  const key = "test-only-secret";
  const signature = createHmac("sha512", key).update(JSON.stringify(sortedPayload(payload))).digest("hex");
  assert.equal(verifyNowSignature(payload, signature, key), true);
  assert.equal(verifyNowSignature({ ...payload, payment_status: "waiting" }, signature, key), false);
  assert.equal(verifyNowSignature(payload, null, key), false);
});
test("crypto fulfills only a complete payment for the exact invoice, currency and network", () => {
  const purchase = { reference: "invoice", providerPaymentId: "123", expectedAmount: 3000, currency: "USD", payAmount: "30" };
  const payment = { payment_id: 123, order_id: "invoice", payment_status: "finished", price_amount: 30, price_currency: "usd", pay_currency: "usdtbsc", pay_amount: 30, actually_paid: 30 };
  assert.equal(validCryptoSettlement(payment, purchase), true);
  assert.equal(validCryptoSettlement({ ...payment, pay_currency: "btc", actually_paid: 0.001, pay_amount: 0.001 }, { ...purchase, payCurrency: "btc", payAmount: "0.001" }), true);
  assert.equal(validCryptoSettlement(payment, { ...purchase, payCurrency: "usdttrc20" }), false);
  for (const change of [{ actually_paid: 29.99 }, { payment_status: "confirmed" }, { pay_currency: "usdttrc20" }, { order_id: "other" }, { payment_id: 456 }, { price_amount: 29 }, { price_currency: "ngn" }]) assert.equal(validCryptoSettlement({ ...payment, ...change }, purchase), false);
});
