import test from "node:test";
import assert from "node:assert/strict";
import { paystackLiveApproved } from "../src/lib/paystack-live-policy.ts";

test("live Paystack is denied until merchant approval, webhook confirmation and launch gate are all explicit", () => {
  const approved = { BILLING_LIVE_ENABLED: "true", PAYSTACK_MERCHANT_APPROVED: "true", PAYSTACK_WEBHOOK_CONFIRMED: "true" };
  assert.equal(paystackLiveApproved(approved), true);
  for (const key of Object.keys(approved)) assert.equal(paystackLiveApproved({ ...approved, [key]: "false" }), false);
  assert.equal(paystackLiveApproved({}), false);
});
