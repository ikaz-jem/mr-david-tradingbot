import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
const schema = new Schema({
  scope: { type: String, enum: ["demo", "live"], required: true },
  slug: { type: String, required: true },
  name: { type: String, required: true, maxlength: 80 },
  description: { type: String, required: true, maxlength: 300 },
  enabled: { type: Boolean, default: false },
  cost: { type: Number, min: 1, max: 1000, default: 1 },
  starter: { type: Number, min: 0, default: 25 },
  trader: { type: Number, min: 0, default: 100 },
  desk: { type: Number, min: 0, default: 300 },
  topupCredits: { type: Number, min: 1, default: 25 },
  topupPrice: { type: Number, min: 1, default: 15 },
  revision: { type: Number, default: 0 },
}, { timestamps: true });
schema.index({ scope: 1, slug: 1 }, { unique: true });
export type ProductDefinitionRecord = InferSchemaType<typeof schema>;
export const ProductDefinition = (mongoose.models.ProductDefinition as Model<ProductDefinitionRecord> | undefined) ?? mongoose.model<ProductDefinitionRecord>("ProductDefinition", schema);

