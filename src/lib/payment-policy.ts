import { createHmac, timingSafeEqual } from "node:crypto";

export function sortedPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedPayload);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, sortedPayload(item)]));
  return value;
}
export function verifyNowSignature(body: unknown, signature: string | null, secret: string) {
  if (!secret || !signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const digest = createHmac("sha512", secret).update(JSON.stringify(sortedPayload(body))).digest();
  return timingSafeEqual(digest, Buffer.from(signature, "hex"));
}
export function validCryptoSettlement(payment: { payment_id?: unknown; order_id?: unknown; payment_status?: unknown; price_amount?: unknown; price_currency?: unknown; pay_currency?: unknown; actually_paid?: unknown; pay_amount?: unknown }, purchase: { reference: string; providerPaymentId?: string | null; expectedAmount: number; currency: string; payAmount?: string; payCurrency?: string }) {
  const actual = Number(payment.actually_paid), requested = Number(purchase.payAmount || payment.pay_amount);
  return payment.payment_status === "finished" && String(payment.payment_id) === purchase.providerPaymentId && payment.order_id === purchase.reference && String(payment.price_currency).toUpperCase() === purchase.currency && Math.abs(Number(payment.price_amount) * 100 - purchase.expectedAmount) < 0.000001 && String(payment.pay_currency).toLowerCase() === (purchase.payCurrency || "usdtbsc").toLowerCase() && Number.isFinite(actual) && Number.isFinite(requested) && requested > 0 && actual >= requested;
}
