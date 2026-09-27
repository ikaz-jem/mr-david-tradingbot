import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const securityAttemptSchema = new Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, required: true, default: 0 },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
securityAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export type SecurityAttemptRecord = InferSchemaType<typeof securityAttemptSchema>;
export const SecurityAttempt = (mongoose.models.SecurityAttempt as Model<SecurityAttemptRecord> | undefined) ?? mongoose.model<SecurityAttemptRecord>("SecurityAttempt", securityAttemptSchema);
