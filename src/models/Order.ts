import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const orderSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  signalId: { type: Schema.Types.ObjectId, ref: "Signal", required: true, index: true },
  exchange: { type: String, enum: ["binance_spot"], required: true },
  clientOrderId: { type: String, required: true, unique: true },
  exchangeOrderId: { type: String, default: null },
  symbol: { type: String, required: true },
  side: { type: String, enum: ["BUY", "SELL"], required: true },
  quantity: { type: String, required: true },
  status: { type: String, enum: ["intent", "submitted", "unknown", "partial", "filled", "rejected", "cancelled"], default: "intent", index: true },
  filledQuantity: { type: String, default: "0" },
  feeAmount: { type: String, default: "0" },
  feeAsset: { type: String, default: null },
  errorCode: { type: String, default: null },
}, { timestamps: true });

orderSchema.index({ userId: 1, createdAt: -1 });
export type OrderRecord = InferSchemaType<typeof orderSchema>;
export const Order = (mongoose.models.Order as Model<OrderRecord> | undefined) ?? mongoose.model<OrderRecord>("Order", orderSchema);
