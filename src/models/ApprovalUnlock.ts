import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  opportunityId: { type: Schema.Types.ObjectId, ref: "SharedOpportunity", required: true, index: true },
  status: { type: String, enum: ["unlocked", "dismissed", "paper_open", "external", "exchange_pending", "exchange_filled", "exchange_partial", "exchange_cancelled", "exchange_rejected", "closed_manual", "closed_target", "closed_stop"], default: "unlocked", index: true },
  creditCost: { type: Number, min: 0, required: true },
  amountUsdt: { type: Number, min: 0, default: 0 },
  executionPrice: { type: Number, min: 0, default: null },
  markPrice: { type: Number, min: 0, default: null },
  exitPrice: { type: Number, min: 0, default: null },
  pnlUsdt: { type: Number, default: null },
  pnlPct: { type: Number, default: null },
  unlockedAt: { type: Date, default: Date.now },
  decidedAt: { type: Date, default: null },
  closedAt: { type: Date, default: null },
  checkedThrough: { type: Date, default: null },
  executionNote: { type: String, default: "" },
  exchangeProvider: { type: String, default: null },
  exchangeOrderId: { type: String, default: null },
  exchangeClientOrderId: { type: String, default: null },
  exchangeOrderStatus: { type: String, default: null },
  exchangeMarket: { type: String, enum: ["spot", "futures"], default: null },
  leverage: { type: Number, min: 1, max: 20, default: null },
  marginMode: { type: String, enum: ["isolated", "cross"], default: null },
  stopOrderId: { type: String, default: null },
  targetOrderId: { type: String, default: null },
  protectionStatus: { type: String, enum: ["pending", "active", "failed", "closed"], default: null },
  executedQuantity: { type: Number, min: 0, default: null },
  executedQuoteQuantity: { type: Number, min: 0, default: null },
}, { timestamps: true });

schema.index({ userId: 1, opportunityId: 1 }, { unique: true });
schema.index({ userId: 1, status: 1, updatedAt: -1 });
export type ApprovalUnlockRecord = InferSchemaType<typeof schema> & { _id: mongoose.Types.ObjectId };
export const ApprovalUnlock = (mongoose.models.ApprovalUnlock as Model<ApprovalUnlockRecord> | undefined) ?? mongoose.model<ApprovalUnlockRecord>("ApprovalUnlock", schema);
