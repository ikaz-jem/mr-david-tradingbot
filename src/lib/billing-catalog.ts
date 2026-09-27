import { plans, type PlanId } from "@/lib/plans";

export const SIGNALS_PRODUCT_ID = "signals";
export const topups = [
  { id: "topup_25", credits: 25, label: "25 additional credits" },
  { id: "topup_100", credits: 100, label: "100 additional credits" },
] as const;
export type TopupId = (typeof topups)[number]["id"];

// Future products register their own plans and top-ups here while using the
// same ProductAccount, BillingPurchase and CreditEntry ownership boundaries.
export const products = {
  signals: { id: SIGNALS_PRODUCT_ID, label: "Trade research", plans, topups },
} as const;

const priceEnv: Record<PlanId | TopupId, string> = {
  starter: "PAYSTACK_SIGNALS_STARTER_MINOR",
  trader: "PAYSTACK_SIGNALS_TRADER_MINOR",
  desk: "PAYSTACK_SIGNALS_DESK_MINOR",
  topup_25: "PAYSTACK_SIGNALS_TOPUP_25_MINOR",
  topup_100: "PAYSTACK_SIGNALS_TOPUP_100_MINOR",
};

export function billingPrice(itemId: PlanId | TopupId) {
  const raw = process.env[priceEnv[itemId]];
  const amount = raw && /^\d+$/.test(raw) ? Number(raw) : 0;
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export function paystackSettlementConfig() {
  const key = process.env.PAYSTACK_LIVE_SECRET_KEY;
  const currency = process.env.PAYSTACK_CURRENCY;
  if (!key?.startsWith("sk_live_") || !currency || !/^[A-Z]{3}$/.test(currency)) return null;
  return { key, currency };
}

export function liveBillingConfig() {
  const settlement = paystackSettlementConfig();
  const countries = (process.env.PAYSTACK_ALLOWED_COUNTRIES ?? "").split(",").map(value => value.trim().toUpperCase()).filter(Boolean);
  if (!settlement || process.env.BILLING_LIVE_ENABLED !== "true" || process.env.PAYSTACK_MERCHANT_APPROVED !== "true" || process.env.PAYSTACK_WEBHOOK_CONFIRMED !== "true" || !countries.length || countries.some(value => !/^[A-Z]{2}$/.test(value))) return null;
  return { ...settlement, countries };
}
