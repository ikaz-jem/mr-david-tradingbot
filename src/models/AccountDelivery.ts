import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  sourceKey: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  isDemo: { type: Boolean, required: true },
  kind: { type: String, enum: ["account", "billing", "research", "exchange", "system"], required: true },
  title: { type: String, required: true, maxlength: 120 },
  body: { type: String, required: true, maxlength: 500 },
  href: { type: String, required: true },
  email: { type: new Schema({ to: String, subject: String, html: String, text: String }, { _id: false }), default: null },
  status: { type: String, enum: ["pending", "delivered", "attention"], default: "pending", index: true },
  inboxDoneAt: { type: Date, default: null },
  emailDoneAt: { type: Date, default: null },
  firstAttemptAt: { type: Date, default: null },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now },
  leaseId: { type: String, default: null },
  leaseUntil: { type: Date, default: null },
}, { timestamps: true });
schema.index({ status: 1, nextAttemptAt: 1, leaseUntil: 1 });
type Record = InferSchemaType<typeof schema>;
export const AccountDelivery = (mongoose.models.AccountDelivery as Model<Record> | undefined) ?? mongoose.model<Record>("AccountDelivery", schema);
