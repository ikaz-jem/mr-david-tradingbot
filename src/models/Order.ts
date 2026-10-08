import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const orderSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  signalId: { type: Schema.Types.ObjectId, ref: "Signal", default: null, index: true },
  approvalUnlockId: { type: Schema.Types.ObjectId, ref: "ApprovalUnlock", default: null, index: true },
  opportunityId: { type: Schema.Types.ObjectId, ref: "SharedOpportunity", default: null, index: true },
  connectionId: { type: Schema.Types.ObjectId, ref: "ExchangeConnection", default: null },
  source: { type: String, enum: ["signal", "approval"], default: "signal", index: true },
  exchange: { type: String, enum: ["binance_spot", "bybit_spot", "okx_spot", "kraken_spot", "kucoin_spot", "binance_futures", "bybit_futures", "okx_futures", "kraken_futures", "kucoin_futures"], required: true },
  market: { type: String, enum: ["spot", "futures"], default: "spot", index: true },
  clientOrderId: { type: String, required: true, unique: true },
  activeKey: { type: String },
  exchangeOrderId: { type: String, default: null },
  symbol: { type: String, required: true },
  side: { type: String, enum: ["BUY", "SELL"], required: true },
  quantity: { type: String, default: "0" },
  quoteAmount: { type: Number, min: 0, default: 0 },
  marginAmount: { type: Number, min: 0, default: null },
  leverage: { type: Number, min: 1, max: 20, default: null },
  marginMode: { type: String, enum: ["isolated", "cross"], default: null },
  positionMode: { type: String, enum: ["one_way"], default: null },
  stopPrice: { type: Number, min: 0, default: null },
  targetPrice: { type: Number, min: 0, default: null },
  stopOrderId: { type: String, default: null },
  targetOrderId: { type: String, default: null },
  protectionStatus: { type: String, enum: ["not_applicable", "pending", "active", "failed", "closed"], default: "not_applicable", index: true },
  status: { type: String, enum: ["intent", "submitted", "unknown", "partial", "filled", "rejected", "cancelled", "protection_failed"], default: "intent", index: true },
  filledQuantity: { type: String, default: "0" },
  filledQuoteAmount: { type: String, default: "0" },
  averageFillPrice: { type: Number, min: 0, default: null },
  feeAmount: { type: String, default: "0" },
  feeAsset: { type: String, default: null },
  errorCode: { type: String, default: null },
  errorMessage: { type: String, default: null, maxlength: 300 },
  resolvedAt: { type: Date, default: null },
}, { timestamps: true });

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ activeKey: 1 }, { unique: true, sparse: true });
export type OrderRecord = InferSchemaType<typeof orderSchema>;
export const Order = (mongoose.models.Order as Model<OrderRecord> | undefined) ?? mongoose.model<OrderRecord>("Order", orderSchema);
