import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  sessionId: { type: String, required: true, index: true },
  token: { type: String, required: true, unique: true },
  platform: { type: String, enum: ["ios", "android"], required: true },
  status: { type: String, enum: ["active", "revoked", "invalid"], default: "active" },
  lastRegisteredAt: { type: Date, default: Date.now },
}, { timestamps: true });

schema.index({ userId: 1, status: 1 });
export type PushDeviceRecord = InferSchemaType<typeof schema> & { _id: mongoose.Types.ObjectId };
export const PushDevice = (mongoose.models.PushDevice as Model<PushDeviceRecord> | undefined) ?? mongoose.model<PushDeviceRecord>("PushDevice", schema);
