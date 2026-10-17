import test from "node:test";
import assert from "node:assert/strict";
import { paymentCallbackOrigin, PaymentCallbackError } from "../src/lib/payment-callback-policy.ts";

test("demo checkout needs no configured public callback", () => {
  assert.equal(paymentCallbackOrigin("paystack", "demo"), null);
});

test("Paystack test checkout omits unavailable or local callbacks", () => {
  for (const appUrl of [undefined, "http://localhost:3000", "https://localhost:3000", "http://127.0.0.1:3000", "not a URL"]) {
    assert.equal(paymentCallbackOrigin("paystack", "test", appUrl), null);
  }
  assert.equal(paymentCallbackOrigin("paystack", "test", "https://preview.example.com/other"), "https://preview.example.com");
});

test("live Paystack and crypto checkouts still require public HTTPS", () => {
  for (const [provider, mode] of [["paystack", "live"], ["nowpayments", "test"], ["nowpayments", "live"]]) {
    assert.throws(() => paymentCallbackOrigin(provider, mode, "http://localhost:3000"), PaymentCallbackError);
    assert.throws(() => paymentCallbackOrigin(provider, mode), PaymentCallbackError);
    assert.equal(paymentCallbackOrigin(provider, mode, "https://pay.example.com"), "https://pay.example.com");
  }
});
