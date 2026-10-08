import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

const scanRunSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  requestId: { type: String, required: true },
  symbol: { type: String, required: true },
  interval: { type: String, default: "4h" },
  requestedStrategySlug: { type: String, default: "ai-router" },
  strategySlug: { type: String, default: "trend-breakout" },
  strategyVersion: { type: Number, min: 1, default: 1 },
  creditCost: { type: Number, default: 1 },
  status: { type: String, enum: ["running", "completed", "failed"], default: "running" },
  outcome: { type: String, enum: ["setup", "no_setup"], default: null },
  setupSide: { type: String, enum: ["buy", "sell"], default: null },
  summary: { type: String, default: "" },
  modelVersion: { type: String, default: "" },
  providerResponseId: { type: String, default: "" },
  aiDecision: { type: String, enum: ["publish", "no_setup"], default: null },
  aiConfidence: { type: Number, min: 0, max: 100, default: null },
  inputTokens: { type: Number, min: 0, default: 0 },
  outputTokens: { type: Number, min: 0, default: 0 },
  marketCacheHit: { type: Boolean, default: false },
  aiCacheHit: { type: Boolean, default: false },
  signalId: { type: Schema.Types.ObjectId, ref: "Signal", default: null },
  dataCutoff: { type: Date, default: null },
  charged: { type: Boolean, default: false },
}, { timestamps: true });

scanRunSchema.index({ userId: 1, requestId: 1 }, { unique: true });
export type ScanRunRecord = InferSchemaType<typeof scanRunSchema> & { _id: mongoose.Types.ObjectId };
export const ScanRun = (mongoose.models.ScanRun as Model<ScanRunRecord> | undefined) ?? mongoose.model<ScanRunRecord>("ScanRun", scanRunSchema);
