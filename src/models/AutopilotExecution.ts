import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  profileId: { type: Schema.Types.ObjectId, ref: "AutopilotProfile", required: true, index: true },
  opportunityId: { type: Schema.Types.ObjectId, ref: "SharedOpportunity", required: true, index: true },
  approvalUnlockId: { type: Schema.Types.ObjectId, ref: "ApprovalUnlock", default: null },
  orderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
  runId: { type: String, required: true },
  provider: { type: String, enum: ["binance", "bybit", "okx", "kraken", "kucoin"], required: true },
  market: { type: String, enum: ["futures"], default: "futures" },
  symbol: { type: String, required: true },
  interval: { type: String, required: true },
  side: { type: String, enum: ["BUY", "SELL"], required: true },
  strategySlug: { type: String, required: true },
  status: { type: String, enum: ["submitting", "submitted", "filled", "partial", "protection_failed", "rejected", "blocked", "closed_target", "closed_stop", "closed_manual"], default: "submitting", index: true },
  reason: { type: String, default: "", maxlength: 300 },
  creditCost: { type: Number, min: 0, required: true },
  amountUsdt: { type: Number, min: 0, required: true },
  leverage: { type: Number, min: 1, max: 20, required: true },
  entryPrice: { type: Number, min: 0, required: true },
  stopPrice: { type: Number, min: 0, required: true },
  targetPrice: { type: Number, min: 0, required: true },
  exchangeOrderId: { type: String, default: null },
  protectionStatus: { type: String, enum: ["pending", "active", "failed", "closed"], default: "pending" },
  pnlUsdt: { type: Number, default: null },
  pnlPct: { type: Number, default: null },
  openedAt: { type: Date, default: null },
  closedAt: { type: Date, default: null },
}, { timestamps: true });

schema.index({ userId: 1, opportunityId: 1 }, { unique: true });
schema.index({ userId: 1, createdAt: -1 });
export type AutopilotExecutionRecord = InferSchemaType<typeof schema> & { _id: mongoose.Types.ObjectId };
export const AutopilotExecution = (mongoose.models.AutopilotExecution as Model<AutopilotExecutionRecord> | undefined) ?? mongoose.model<AutopilotExecutionRecord>("AutopilotExecution", schema);
