import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const contactThrottleSchema = new Schema({
  key: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
contactThrottleSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export type ContactThrottleRecord = InferSchemaType<typeof contactThrottleSchema>;
export const ContactThrottle = (mongoose.models.ContactThrottle as Model<ContactThrottleRecord> | undefined) ?? mongoose.model<ContactThrottleRecord>("ContactThrottle", contactThrottleSchema);
