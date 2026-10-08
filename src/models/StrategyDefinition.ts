import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  scope: { type: String, enum: ["live", "demo"], required: true, index: true },
  slug: { type: String, required: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, required: true, trim: true, maxlength: 400 },
  engine: { type: String, enum: ["ai-router", "trend-breakout", "momentum-continuation", "mean-reversion", "ict-price-structure", "elliott-wave-assist"], required: true },
  sensitivity: { type: String, enum: ["conservative", "balanced", "aggressive"], default: "balanced" },
  products: { type: [String], enum: ["signals", "approval-desk", "autopilot"], default: ["signals"] },
  enabled: { type: Boolean, default: true, index: true },
  experimental: { type: Boolean, default: false },
  locked: { type: Boolean, default: false },
  version: { type: Number, min: 1, default: 1 },
  revision: { type: Number, min: 0, default: 0 },
}, { timestamps: true });

schema.index({ scope: 1, slug: 1 }, { unique: true });
export type StrategyDefinitionRecord = InferSchemaType<typeof schema>;
export const StrategyDefinition = (mongoose.models.StrategyDefinition as Model<StrategyDefinitionRecord> | undefined) ?? mongoose.model<StrategyDefinitionRecord>("StrategyDefinition", schema);
