import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const paystackWebhookEventSchema = new Schema({
  eventHash: { type: String, required: true, unique: true },
  type: { type: String, required: true, index: true },
  reference: { type: String, default: null, index: true },
  outcome: { type: String, enum: ["recorded", "verified_test", "ignored", "review"], required: true },
}, { timestamps: true });

export type PaystackWebhookEventRecord = InferSchemaType<typeof paystackWebhookEventSchema>;
export const PaystackWebhookEvent = (mongoose.models.PaystackWebhookEvent as Model<PaystackWebhookEventRecord> | undefined) ?? mongoose.model<PaystackWebhookEventRecord>("PaystackWebhookEvent", paystackWebhookEventSchema);
