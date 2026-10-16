import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  connectionId: { type: Schema.Types.ObjectId, ref: "ExchangeConnection", required: true, index: true },
  orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
  provider: { type: String, required: true },
  market: { type: String, enum: ["spot", "futures"], required: true },
  symbol: { type: String, required: true },
  exchangeTradeId: { type: String, required: true },
  exchangeOrderId: { type: String, required: true },
  side: { type: String, enum: ["BUY", "SELL"], required: true },
  quantity: { type: String, required: true },
  price: { type: String, required: true },
  quoteQuantity: { type: String, required: true },
  commission: { type: String, default: "0" },
  commissionAsset: { type: String, default: null },
  realizedPnl: { type: String, default: null },
  tradedAt: { type: Date, required: true },
}, { timestamps: true });

schema.index({ connectionId: 1, market: 1, symbol: 1, exchangeTradeId: 1 }, { unique: true });
schema.index({ userId: 1, tradedAt: -1 });
export type TradeFillRecord = InferSchemaType<typeof schema> & { _id: mongoose.Types.ObjectId };
export const TradeFill = (mongoose.models.TradeFill as Model<TradeFillRecord> | undefined) ?? mongoose.model<TradeFillRecord>("TradeFill", schema);
