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
