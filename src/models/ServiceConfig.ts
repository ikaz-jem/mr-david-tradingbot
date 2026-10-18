import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const serviceConfigSchema = new Schema({
  key: { type: String, required: true, unique: true, default: "global" },
  openaiApiKeyEncrypted: { type: String, default: "" },
  openaiModel: { type: String, default: "" },
  openaiResearchModel: { type: String, default: "" },
  openaiApprovalModel: { type: String, default: "" },
  openaiAutopilotModel: { type: String, default: "" },
  openaiVerifiedAt: { type: Date, default: null },
  openaiLastError: { type: String, default: "" },
  resendApiKeyEncrypted: { type: String, default: "" },
  resendFromEmail: { type: String, default: "" },
  resendSupportEmail: { type: String, default: "" },
  resendWebhookSecretEncrypted: { type: String, default: "" },
  r2AccountId: { type: String, default: "" },
  r2BucketName: { type: String, default: "" },
  r2AccessKeyIdEncrypted: { type: String, default: "" },
  r2SecretAccessKeyEncrypted: { type: String, default: "" },
}, { timestamps: true });

export type ServiceConfigRecord = InferSchemaType<typeof serviceConfigSchema>;
export const ServiceConfig = (mongoose.models.ServiceConfig as Model<ServiceConfigRecord> | undefined) ?? mongoose.model<ServiceConfigRecord>("ServiceConfig", serviceConfigSchema);
