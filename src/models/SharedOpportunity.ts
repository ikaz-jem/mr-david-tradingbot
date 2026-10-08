import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  scope: { type: String, enum: ["live", "demo"], required: true, index: true },
  fingerprint: { type: String, required: true },
  symbol: { type: String, required: true, index: true },
  interval: { type: String, required: true, index: true },
  requestedStrategySlug: { type: String, required: true, index: true },
  strategySlug: { type: String, required: true },
  strategyName: { type: String, required: true },
  strategyVersion: { type: Number, min: 1, required: true },
  side: { type: String, enum: ["BUY", "SELL"], required: true, index: true },
  status: { type: String, enum: ["active", "expired", "invalidated"], default: "active", index: true },
  entry: { type: Number, required: true },
  stop: { type: Number, required: true },
  target: { type: Number, required: true },
  confidence: { type: Number, min: 0, max: 100, required: true },
  summary: { type: String, required: true },
  thesis: { type: String, required: true },
  riskNote: { type: String, required: true },
  marketFacts: { type: Schema.Types.Mixed, required: true },
  invalidationDirection: { type: String, enum: ["below", "above"], required: true },
  invalidationPrice: { type: Number, required: true },
  invalidationInstruction: { type: String, required: true },
  invalidationReason: { type: String, default: "" },
  modelVersion: { type: String, required: true },
  providerResponseId: { type: String, default: "" },
  dataCutoff: { type: Date, required: true, index: true },
  expiresAt: { type: Date, required: true, index: true },
}, { timestamps: true });

schema.index({ scope: 1, fingerprint: 1 }, { unique: true });
schema.index({ scope: 1, status: 1, expiresAt: 1, createdAt: -1 });
export type SharedOpportunityRecord = InferSchemaType<typeof schema> & { _id: mongoose.Types.ObjectId };
export const SharedOpportunity = (mongoose.models.SharedOpportunity as Model<SharedOpportunityRecord> | undefined) ?? mongoose.model<SharedOpportunityRecord>("SharedOpportunity", schema);
