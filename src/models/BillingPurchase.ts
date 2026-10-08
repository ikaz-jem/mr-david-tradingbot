import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const billingPurchaseSchema = new Schema({
  provider: { type: String, enum: ["paystack", "nowpayments"], default: "paystack" },
  mode: { type: String, enum: ["demo", "test", "live"], default: "live" },
  isDemo: { type: Boolean, default: false, index: true },
  gatewayId: { type: Schema.Types.ObjectId, default: null },
  catalogAmountUsd: { type: Number, default: null },
  authorizationUrl: { type: String, default: "" },
  payAddress: { type: String, default: "" },
  payAmount: { type: String, default: "" },
  payCurrency: { type: String, default: "usdtbsc" },
  payNetwork: { type: String, default: "BNB Smart Chain (BEP20)" },
  payExtraId: { type: String, default: "" },
  failureCode: { type: String, default: "" },
  providerStatus: { type: String, default: "" },
  providerPaymentId: { type: String, default: null },
  checkoutLock: { type: String, default: null },
  lastCheckedAt: { type: Date, default: null },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  productId: { type: String, required: true, default: "signals" },
  kind: { type: String, enum: ["activation", "topup", "monthly"], required: true },
  itemId: { type: String, required: true },
  credits: { type: Number, required: true, min: 1 },
  reference: { type: String, required: true, unique: true },
  expectedAmount: { type: Number, required: true, min: 1 },
  currency: { type: String, required: true },
  status: { type: String, enum: ["initializing", "pending", "paid", "failed", "review"], default: "initializing", index: true },
  providerTransactionId: { type: String, default: null },
  verifiedAt: { type: Date, default: null },
}, { timestamps: true });

billingPurchaseSchema.index({ userId: 1, createdAt: -1 });
billingPurchaseSchema.index({ checkoutLock: 1 }, { unique: true, partialFilterExpression: { checkoutLock: { $type: "string" } } });
billingPurchaseSchema.index({ provider: 1, mode: 1, providerPaymentId: 1 }, { unique: true, partialFilterExpression: { providerPaymentId: { $type: "string" } } });
export type BillingPurchaseRecord = InferSchemaType<typeof billingPurchaseSchema> & { _id: mongoose.Types.ObjectId };
export const BillingPurchase = (mongoose.models.BillingPurchase as Model<BillingPurchaseRecord> | undefined) ?? mongoose.model<BillingPurchaseRecord>("BillingPurchase", billingPurchaseSchema);
