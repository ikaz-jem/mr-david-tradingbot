import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const emailTokenSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  kind: { type: String, enum: ["verify", "reset", "invite", "email_change"], required: true },
  newEmail: { type: String, default: null },
  oldEmail: { type: String, default: null },
  authVersion: { type: Number, default: null },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

emailTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
emailTokenSchema.index({ userId: 1, kind: 1, createdAt: -1 });
export type EmailTokenRecord = InferSchemaType<typeof emailTokenSchema> & { _id: mongoose.Types.ObjectId };
export const EmailToken = (mongoose.models.EmailToken as Model<EmailTokenRecord> | undefined) ?? mongoose.model<EmailTokenRecord>("EmailToken", emailTokenSchema);
