import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  enabled: { type: Boolean, default: true, index: true },
  symbols: { type: [String], default: ["BTCUSDT", "ETHUSDT", "SOLUSDT"] },
  intervals: { type: [String], default: ["15m", "1h", "4h"] },
  strategySlugs: { type: [String], default: ["ai-router"] },
  minConfidence: { type: Number, min: 0, max: 100, default: 65 },
  minRiskReward: { type: Number, min: 0.5, max: 10, default: 1.5 },
  defaultNotionalUsdt: { type: Number, min: 10, max: 100000, default: 250 },
  revision: { type: Number, min: 0, default: 0 },
}, { timestamps: true });

export type ApprovalPreferenceRecord = InferSchemaType<typeof schema> & { _id: mongoose.Types.ObjectId };
export const ApprovalPreference = (mongoose.models.ApprovalPreference as Model<ApprovalPreferenceRecord> | undefined) ?? mongoose.model<ApprovalPreferenceRecord>("ApprovalPreference", schema);
