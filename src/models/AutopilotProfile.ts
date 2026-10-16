import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  status: { type: String, enum: ["paused", "running", "emergency_stopped"], default: "paused", index: true },
  provider: { type: String, enum: ["binance", "bybit", "okx", "kraken", "kucoin"], default: "binance" },
  market: { type: String, enum: ["futures"], default: "futures" },
  strategySlug: { type: String, default: "ai-router", maxlength: 40 },
  allowedSymbols: { type: [String], default: ["BTCUSDT", "ETHUSDT", "SOLUSDT"] },
  allowedIntervals: { type: [String], default: ["15m", "1h", "4h"] },
  minConfidence: { type: Number, min: 50, max: 95, default: 72 },
  minRiskReward: { type: Number, min: 1, max: 5, default: 1.5 },
  maxPositionUsd: { type: Number, min: 10, max: 100000, default: 100 },
  maxDailyTrades: { type: Number, min: 1, max: 20, default: 3 },
  maxOpenPositions: { type: Number, min: 1, max: 10, default: 2 },
  dailyLossLimitPct: { type: Number, min: 0.25, max: 20, default: 2 },
  leverage: { type: Number, min: 1, max: 20, default: 2 },
  marginMode: { type: String, enum: ["isolated", "cross"], default: "isolated" },
  triggerPriceType: { type: String, enum: ["mark", "last"], default: "mark" },
  enabledAt: { type: Date, default: null },
  emergencyStoppedAt: { type: Date, default: null },
  lastEvaluatedAt: { type: Date, default: null },
  lastDecision: { type: String, default: "", maxlength: 240 },
  revision: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ status: 1, updatedAt: 1 });
export type AutopilotProfileRecord = InferSchemaType<typeof schema> & { _id: mongoose.Types.ObjectId };
export const AutopilotProfile = (mongoose.models.AutopilotProfile as Model<AutopilotProfileRecord> | undefined) ?? mongoose.model<AutopilotProfileRecord>("AutopilotProfile", schema);
