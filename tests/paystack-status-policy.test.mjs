import test from "node:test";
import assert from "node:assert/strict";
import { paystackPaymentDisposition } from "../src/lib/paystack-status-policy.ts";

test("Paystack abandoned and in-progress transactions remain payable", () => {
  for (const status of ["abandoned", "ongoing", "pending", "processing", "queued", "unknown"]) {
    assert.equal(paystackPaymentDisposition(status), "pending");
  }
  assert.equal(paystackPaymentDisposition("success"), "paid");
  assert.equal(paystackPaymentDisposition("failed"), "failed");
  assert.equal(paystackPaymentDisposition("reversed"), "review");
});
