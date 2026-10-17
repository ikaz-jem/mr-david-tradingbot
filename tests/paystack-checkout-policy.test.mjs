import test from "node:test";
import assert from "node:assert/strict";
import { paystackCustomerEmail, PaystackEmailError, paystackInitializePayload, paystackTransactionMatchesPurchase, paystackValidationFailure } from "../src/lib/paystack-checkout-policy.ts";

test("Paystack defaults to the account email and accepts an explicit payment email in test and live mode", () => {
  assert.equal(paystackCustomerEmail("Customer@Enrivea.com", undefined, "live"), "customer@enrivea.com");
  assert.equal(paystackCustomerEmail("customer@enrivea.com", "", "test"), "customer@enrivea.com");
  assert.equal(paystackCustomerEmail("customer@enrivea.com", " Someone@Else.com ", "live"), "someone@else.com");
  assert.equal(paystackCustomerEmail("demo-user@enrivea.invalid", "buyer@example.com", "test"), "buyer@example.com");
  assert.equal(paystackCustomerEmail("demo-user@enrivea.invalid", "buyer@example.com", "demo"), "demo-user@enrivea.invalid");
  for (const candidate of [undefined, "", "demo-user@enrivea.invalid", "buyer@example.test", "not-an-email"]) {
    assert.throws(() => paystackCustomerEmail("demo-user@enrivea.invalid", candidate, "test"), PaystackEmailError);
  }
});

test("Paystack initialization sends a string amount and JSON-encoded metadata", () => {
  const base = { email: "buyer@example.com", amount: 4500000, currency: "NGN", reference: "enrivea-123", kind: "activation", itemId: "account_activation" };
  const local = paystackInitializePayload(base);
  assert.equal(local.amount, "4500000");
  assert.deepEqual(JSON.parse(local.metadata), { kind: "activation", itemId: "account_activation" });
  assert.equal("callback_url" in local, false);
  const deployed = paystackInitializePayload({ ...base, callbackUrl: "https://example.com/dashboard/checkout/enrivea-123" });
  assert.equal(deployed.callback_url, "https://example.com/dashboard/checkout/enrivea-123");
});

test("verification binds a successful Paystack payment to the saved payment email and exact order", () => {
  const purchase = { reference: "enrivea-123", mode: "live", expectedAmount: 4500000, currency: "NGN", providerCustomerEmail: "buyer@else.com" };
  const transaction = { id: 123, domain: "live", reference: "enrivea-123", amount: 4500000, currency: "NGN", customer: { email: "Buyer@Else.com" } };
  assert.equal(paystackTransactionMatchesPurchase(transaction, purchase, "account@enrivea.com"), true);
  for (const mismatch of [
    { ...transaction, domain: "test" },
    { ...transaction, amount: transaction.amount - 1 },
    { ...transaction, reference: "enrivea-other" },
    { ...transaction, customer: { email: "account@enrivea.com" } },
    { ...transaction, id: "not-an-id" },
  ]) assert.equal(paystackTransactionMatchesPurchase(mismatch, purchase, "account@enrivea.com"), false);
});

test("Paystack validation errors reveal a useful category without echoing provider text", () => {
  assert.equal(paystackValidationFailure({ message: "Currency is not enabled for buyer@example.com" }).code, "PAYSTACK_CURRENCY");
  assert.equal(paystackValidationFailure({ code: "invalid_amount", message: "Invalid Amount Sent" }).code, "PAYSTACK_AMOUNT");
  assert.equal(paystackValidationFailure({ message: "Invalid metadata" }).code, "PAYSTACK_METADATA");
  assert.equal(paystackValidationFailure({ message: "provider says secret sk_test_example" }).code, "PAYSTACK_VALIDATION");
  assert.equal(paystackValidationFailure({ message: "provider says secret sk_test_example" }).message.includes("sk_test_example"), false);
});
