import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const notificationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  kind: { type: String, enum: ["account", "billing", "research", "exchange", "system"], required: true },
  title: { type: String, required: true, maxlength: 120 },
  body: { type: String, required: true, maxlength: 500 },
  href: { type: String, default: null },
  sourceKey: { type: String, required: true, unique: true },
  readAt: { type: Date, default: null },
  pushStatus: { type: String, enum: ["pending", "sent", "skipped", "failed"], default: "pending", index: true },
  pushAttempts: { type: Number, default: 0 },
  pushLeaseUntil: { type: Date, default: null },
  pushLastError: { type: String, default: null, maxlength: 300 },
  pushCompletedAt: { type: Date, default: null },
}, { timestamps: true });

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ pushStatus: 1, pushLeaseUntil: 1, createdAt: 1 });
export type NotificationRecord = InferSchemaType<typeof notificationSchema> & { _id: mongoose.Types.ObjectId };
export const Notification = (mongoose.models.Notification as Model<NotificationRecord> | undefined) ?? mongoose.model<NotificationRecord>("Notification", notificationSchema);
