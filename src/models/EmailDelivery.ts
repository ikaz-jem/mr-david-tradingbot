import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const emailDeliverySchema = new Schema({
  eventKey: { type: String, required: true, unique: true },
  recipient: { type: String, required: true, index: true },
  category: { type: String, required: true },
  providerId: { type: String, default: null, index: true },
  status: { type: String, enum: ["sent", "delivered", "bounced", "complained", "failed"], required: true },
  lastError: { type: String, default: "" },
}, { timestamps: true });

export type EmailDeliveryRecord = InferSchemaType<typeof emailDeliverySchema> & { _id: mongoose.Types.ObjectId };
export const EmailDelivery = (mongoose.models.EmailDelivery as Model<EmailDeliveryRecord> | undefined) ?? mongoose.model<EmailDeliveryRecord>("EmailDelivery", emailDeliverySchema);
