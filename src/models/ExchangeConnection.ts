import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const exchangeConnectionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  provider: { type: String, enum: ["binance", "bybit", "okx", "kraken", "kucoin"], required: true },
  market: { type: String, enum: ["spot", "futures"], required: true },
  environment: { type: String, enum: ["live"], default: "live" },
  apiKeyCiphertext: { type: String, required: true, select: false },
  apiSecretCiphertext: { type: String, required: true, select: false },
  apiPassphraseCiphertext: { type: String, default: null, select: false },
  apiKeyVersion: { type: String, default: null },
  keyLast4: { type: String, required: true },
  accountLabel: { type: String, default: null },
  status: { type: String, enum: ["connected", "attention"], default: "connected", index: true },
  access: { type: String, enum: ["read_only", "spot_trade", "futures_trade"], default: "read_only" },
  ipRestricted: { type: Boolean, default: false },
  lastCheckedAt: { type: Date, default: null },
  lastError: { type: String, default: null },
}, { timestamps: true });

exchangeConnectionSchema.index({ userId: 1, provider: 1, market: 1, environment: 1 }, { unique: true });
export type ExchangeConnectionRecord = InferSchemaType<typeof exchangeConnectionSchema> & { _id: mongoose.Types.ObjectId };
export const ExchangeConnection = (mongoose.models.ExchangeConnection as Model<ExchangeConnectionRecord> | undefined) ?? mongoose.model<ExchangeConnectionRecord>("ExchangeConnection", exchangeConnectionSchema);
