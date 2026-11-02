import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  sessionId: { type: String, required: true, unique: true },
  authVersion: { type: Number, required: true },
  status: { type: String, enum: ["active", "revoked"], default: "active" },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  lastSeenAt: { type: Date, default: Date.now },
  deviceLabel: { type: String, default: "Mobile app", maxlength: 100 },
}, { timestamps: true });

schema.index({ userId: 1, status: 1 });
export type MobileSessionRecord = InferSchemaType<typeof schema> & { _id: mongoose.Types.ObjectId };
export const MobileSession = (mongoose.models.MobileSession as Model<MobileSessionRecord> | undefined) ?? mongoose.model<MobileSessionRecord>("MobileSession", schema);
