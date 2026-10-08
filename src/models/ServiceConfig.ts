import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const serviceConfigSchema = new Schema({
  key: { type: String, required: true, unique: true, default: "global" },
  openaiApiKeyEncrypted: { type: String, default: "" },
  openaiModel: { type: String, default: "" },
  openaiVerifiedAt: { type: Date, default: null },
  openaiLastError: { type: String, default: "" },
  resendApiKeyEncrypted: { type: String, default: "" },
  resendFromEmail: { type: String, default: "" },
  resendSupportEmail: { type: String, default: "" },
  resendWebhookSecretEncrypted: { type: String, default: "" },
}, { timestamps: true });

export type ServiceConfigRecord = InferSchemaType<typeof serviceConfigSchema>;
export const ServiceConfig = (mongoose.models.ServiceConfig as Model<ServiceConfigRecord> | undefined) ?? mongoose.model<ServiceConfigRecord>("ServiceConfig", serviceConfigSchema);
