import { BillingPurchase } from "@/models/BillingPurchase";
import { getGateway, providerRequest, type Gateway } from "@/lib/payment-gateways";
import { validCryptoSettlement } from "@/lib/payment-policy";
import { fulfillPayment } from "@/lib/payment-fulfillment";
import { User } from "@/models/User";
import { paystackSettlementConfig } from "@/lib/billing-catalog";
import { paystackPaymentDisposition } from "@/lib/paystack-status-policy";
import { paystackTransactionMatchesPurchase } from "@/lib/paystack-checkout-policy";

export async function purchaseGateway(purchase: { provider?: string; isDemo?: boolean; gatewayId?: unknown; mode?: string }) {
  if (!purchase.gatewayId) {
    const legacy = paystackSettlementConfig();
    if (!legacy || purchase.provider === "nowpayments") throw new Error("Payment credentials unavailable");
    return { id: null, provider: "paystack", isDemo: false, enabled: true, mode: "live", currency: legacy.currency, ratePerUsd: 1, key: legacy.key, webhookSecret: "" } satisfies Gateway;
  }
  return getGateway(purchase.provider === "nowpayments" ? "nowpayments" : "paystack", Boolean(purchase.isDemo), String(purchase.gatewayId));
}
export async function verifyPayment(reference: string) {
  const purchase = await BillingPurchase.findOne({ reference }).lean();
  if (!purchase) throw new Error("Payment unavailable");
  if (purchase.status === "paid") return "paid";
  if (purchase.mode === "demo") return purchase.status;
  const gateway = await purchaseGateway(purchase);
  if (gateway.mode === "demo") return purchase.status;
  if (gateway.provider === "paystack") {
    const result = await providerRequest<{ id: number | string; domain: string; reference: string; status: string; amount: number; currency: string; customer?: { email?: string } }>(gateway, `transaction/verify/${encodeURIComponent(reference)}`);
    const user = await User.findById(purchase.userId).select("email").lean();
    const disposition = paystackPaymentDisposition(result.status);
    if (disposition !== "paid") {
      await BillingPurchase.updateOne({ _id: purchase._id, status: { $ne: "paid" } }, { $set: { providerStatus: result.status, status: disposition, ...(disposition === "failed" || disposition === "review" ? { checkoutLock: null } : {}) } });
      return disposition;
    }
    const valid = paystackTransactionMatchesPurchase(result, { ...purchase, mode: gateway.mode }, user?.email ?? "");
    if (!valid) { await BillingPurchase.updateOne({ _id: purchase._id, status: { $ne: "paid" } }, { $set: { status: "review", checkoutLock: null } }); return "review"; }
    return fulfillPayment(reference, String(result.id));
  }
  if (!purchase.providerPaymentId || !/^\d+$/.test(purchase.providerPaymentId)) return purchase.status;
  const result = await providerRequest<{ payment_id: string | number; order_id: string; payment_status: string; price_amount: number; price_currency: string; pay_currency: string; actually_paid: number; pay_amount: number }>(gateway, `payment/${purchase.providerPaymentId}`);
  if (String(result.payment_id) !== purchase.providerPaymentId || result.order_id !== reference) throw new Error("Payment reference mismatch");
  if (validCryptoSettlement(result, purchase)) {
    await BillingPurchase.updateOne({ _id: purchase._id, status: { $ne: "paid" } }, { $set: { providerStatus: "finished" } });
    return fulfillPayment(reference, String(result.payment_id));
  }
  const status = ["finished", "partially_paid", "refunded"].includes(result.payment_status) ? "review" : ["failed", "expired"].includes(result.payment_status) ? "failed" : "pending";
  await BillingPurchase.updateOne({ _id: purchase._id, status: { $ne: "paid" } }, { $set: { status, providerStatus: result.payment_status, ...(status !== "pending" ? { checkoutLock: null } : {}) } });
  return status;
}
