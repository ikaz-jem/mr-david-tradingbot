import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { verifyPaystackSignature } from "../src/lib/paystack.ts";

test("accepts the Paystack SHA-512 signature for the exact raw payload", () => {
  const body = JSON.stringify({ event: "charge.success", data: { reference: "test-ref" } });
  const secret = "sk_test_example";
  const signature = createHmac("sha512", secret).update(body).digest("hex");
  assert.equal(verifyPaystackSignature(body, signature, secret), true);
  assert.equal(verifyPaystackSignature(`${body} `, signature, secret), false);
});

test("rejects missing and malformed Paystack signatures", () => {
  assert.equal(verifyPaystackSignature("{}", null, "sk_test_example"), false);
  assert.equal(verifyPaystackSignature("{}", "not-a-hex-signature", "sk_test_example"), false);
});
