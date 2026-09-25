import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const paystackCheckoutSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  planId: { type: String, enum: ["starter", "trader", "desk"], required: true },
  planCode: { type: String, required: true },
  reference: { type: String, required: true, unique: true },
  expectedAmount: { type: Number, required: true },
  currency: { type: String, required: true },
  authorizationUrl: { type: String, default: null },
  status: { type: String, enum: ["initializing", "pending", "paid_test", "failed", "review"], default: "initializing", index: true },
  verifiedAt: { type: Date, default: null },
  providerTransactionId: { type: String, default: null },
}, { timestamps: true });

paystackCheckoutSchema.index({ userId: 1, createdAt: -1 });
export type PaystackCheckoutRecord = InferSchemaType<typeof paystackCheckoutSchema> & { _id: mongoose.Types.ObjectId };
export const PaystackCheckout = (mongoose.models.PaystackCheckout as Model<PaystackCheckoutRecord> | undefined) ?? mongoose.model<PaystackCheckoutRecord>("PaystackCheckout", paystackCheckoutSchema);
