import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const signalSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  symbol: { type: String, required: true, index: true },
  interval: { type: String, required: true },
  requestedStrategySlug: { type: String, default: "ai-router" },
  strategySlug: { type: String, default: "trend-breakout" },
  strategyVersion: { type: Number, min: 1, default: 1 },
  side: { type: String, enum: ["buy", "sell"], required: true },
  status: { type: String, enum: ["watch", "triggered", "expired", "invalidated", "closed"], default: "watch", index: true },
  entry: { type: Number, required: true },
  stop: { type: Number, required: true },
  target: { type: Number, required: true },
  thesis: { type: String, required: true },
  riskNote: { type: String, required: true },
  confidence: { type: Number, min: 0, max: 100, default: 0 },
  modelVersion: { type: String, required: true },
  providerResponseId: { type: String, default: "" },
  marketFacts: { type: Schema.Types.Mixed, required: true },
  dataCutoff: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  analysisCost: { type: Number, default: 1 },
  moderationReason: { type: String, default: "" },
  moderatedAt: { type: Date },
  moderatedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

signalSchema.index({ userId: 1, createdAt: -1 });
export type SignalRecord = InferSchemaType<typeof signalSchema> & { _id: mongoose.Types.ObjectId };
export const Signal = (mongoose.models.Signal as Model<SignalRecord> | undefined) ?? mongoose.model<SignalRecord>("Signal", signalSchema);
