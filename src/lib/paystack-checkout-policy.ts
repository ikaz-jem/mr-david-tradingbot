import { z } from "zod";

export class PaystackEmailError extends Error {}

export function paystackCustomerEmail(accountEmail: string, paymentEmail: string | undefined, mode: "demo" | "test" | "live") {
  if (mode === "demo") return accountEmail;
  const email = (paymentEmail?.trim() || accountEmail).trim().toLowerCase();
  const domain = email.split("@")[1] ?? "";
  if (!z.email().max(254).safeParse(email).success || /(^|\.)(invalid|test|example|localhost)$/.test(domain)) {
    throw new PaystackEmailError("Enter a valid payment email you control. Demo placeholder addresses cannot be used with Paystack.");
  }
  return email;
}

type InitializeInput = {
  email: string;
  amount: number;
  currency: string;
  reference: string;
  kind: "activation" | "topup";
  itemId: string;
  callbackUrl?: string;
};

export function paystackInitializePayload(input: InitializeInput) {
  return {
    email: input.email,
    amount: String(input.amount),
    currency: input.currency,
    reference: input.reference,
    ...(input.callbackUrl ? { callback_url: input.callbackUrl } : {}),
    metadata: JSON.stringify({ kind: input.kind, itemId: input.itemId }),
  };
}

export function paystackTransactionMatchesPurchase(
  transaction: { id: number | string; domain: string; reference: string; amount: number; currency: string; customer?: { email?: string } },
  purchase: { reference: string; mode: string; expectedAmount: number; currency: string; providerCustomerEmail?: string },
  accountEmail: string,
) {
  const expectedEmail = (purchase.providerCustomerEmail || accountEmail).trim().toLowerCase();
  return transaction.reference === purchase.reference
    && transaction.domain === purchase.mode
    && transaction.amount === purchase.expectedAmount
    && transaction.currency === purchase.currency
    && transaction.customer?.email?.trim().toLowerCase() === expectedEmail
    && (typeof transaction.id === "string" ? /^\d+$/.test(transaction.id) : Number.isSafeInteger(transaction.id));
}

export function paystackValidationFailure(result: unknown) {
  const body = result && typeof result === "object" ? result as Record<string, unknown> : {};
  const message = typeof body.message === "string" ? body.message.toLowerCase() : "";
  const providerCode = typeof body.code === "string" ? body.code.toLowerCase() : "";
  const detail = `${providerCode} ${message}`;
  if (/currenc|international|dollar/.test(detail)) return { code: "PAYSTACK_CURRENCY", message: "Paystack rejected the configured currency. Ask an administrator to choose a currency enabled for this merchant account." };
  if (/amount|minimum|maximum|limit exceeded/.test(detail)) return { code: "PAYSTACK_AMOUNT", message: "Paystack rejected the checkout amount. Ask an administrator to review the price, exchange rate, and provider limits." };
  if (/email/.test(detail)) return { code: "PAYSTACK_EMAIL", message: "Paystack rejected the payment email address. Check it or choose another email you control." };
  if (/metadata/.test(detail)) return { code: "PAYSTACK_METADATA", message: "Paystack rejected the checkout details. Contact support with the payment reference." };
  if (/callback|redirect/.test(detail)) return { code: "PAYSTACK_CALLBACK", message: "Paystack rejected the return URL. Ask an administrator to check the configured public app URL." };
  if (/reference/.test(detail)) return { code: "PAYSTACK_REFERENCE", message: "Paystack rejected the payment reference. Contact support before retrying." };
  return { code: "PAYSTACK_VALIDATION", message: "Paystack rejected the checkout details. Ask an administrator to check the merchant currency, exchange rate, and payment settings." };
}
