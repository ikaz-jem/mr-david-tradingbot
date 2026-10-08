import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

// Every save creates a revision. In-flight payments keep the credential revision used at checkout.
const schema = new Schema({
  provider: { type: String, enum: ["paystack", "nowpayments"], required: true },
  isDemo: { type: Boolean, required: true },
  enabled: { type: Boolean, default: false },
  mode: { type: String, enum: ["demo", "test", "live"], required: true },
  apiKeyEncrypted: { type: String, default: "", select: false },
  webhookSecretEncrypted: { type: String, default: "", select: false },
  currency: { type: String, default: "NGN" },
  ratePerUsd: { type: Number, default: 0 },
  createdBy: { type: Schema.Types.ObjectId, required: true },
}, { timestamps: true });
schema.index({ provider: 1, isDemo: 1, createdAt: -1, _id: -1 });
export type PaymentGatewayRecord = InferSchemaType<typeof schema>;
export const PaymentGateway = (mongoose.models.PaymentGateway as Model<PaymentGatewayRecord>) || mongoose.model("PaymentGateway", schema);
