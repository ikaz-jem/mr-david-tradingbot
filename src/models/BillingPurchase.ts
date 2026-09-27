import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const billingPurchaseSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  productId: { type: String, required: true, default: "signals" },
  kind: { type: String, enum: ["monthly", "topup"], required: true },
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
export type BillingPurchaseRecord = InferSchemaType<typeof billingPurchaseSchema> & { _id: mongoose.Types.ObjectId };
export const BillingPurchase = (mongoose.models.BillingPurchase as Model<BillingPurchaseRecord> | undefined) ?? mongoose.model<BillingPurchaseRecord>("BillingPurchase", billingPurchaseSchema);
