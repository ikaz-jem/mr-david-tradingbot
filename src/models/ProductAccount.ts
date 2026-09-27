import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const productAccountSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  productId: { type: String, required: true, trim: true, maxlength: 80 },
  creditBalance: { type: Number, required: true, default: 0, min: 0 },
  planId: { type: String, default: null },
  subscriptionStatus: { type: String, enum: ["none", "active", "expired", "canceled"], default: "none" },
  currentPeriodStart: { type: Date, default: null },
  currentPeriodEnd: { type: Date, default: null },
  lastPaymentReference: { type: String, default: null },
}, { timestamps: true });

productAccountSchema.index({ userId: 1, productId: 1 }, { unique: true });
export type ProductAccountRecord = InferSchemaType<typeof productAccountSchema> & { _id: mongoose.Types.ObjectId };
export const ProductAccount = (mongoose.models.ProductAccount as Model<ProductAccountRecord> | undefined) ?? mongoose.model<ProductAccountRecord>("ProductAccount", productAccountSchema);
