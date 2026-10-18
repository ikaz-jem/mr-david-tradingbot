import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  scope: { type: String, enum: ["live", "demo"], required: true, default: "live" },
  slug: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  icon: { type: String, default: "book" },
  sortOrder: { type: Number, default: 0 },
  status: { type: String, enum: ["active", "hidden", "deleted"], default: "active" },
}, { timestamps: true });
schema.index({ scope: 1, slug: 1 }, { unique: true });

export type HelpCategoryRecord = InferSchemaType<typeof schema>;
export const HelpCategory = (mongoose.models.HelpCategory as Model<HelpCategoryRecord> | undefined) ?? mongoose.model<HelpCategoryRecord>("HelpCategory", schema);
