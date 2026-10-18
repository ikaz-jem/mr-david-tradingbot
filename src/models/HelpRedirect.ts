import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
const schema = new Schema({
  scope: { type: String, enum: ["live", "demo"], required: true },
  fromSlug: { type: String, required: true },
  toSlug: { type: String, required: true },
}, { timestamps: true });
schema.index({ scope: 1, fromSlug: 1 }, { unique: true });
export type HelpRedirectRecord = InferSchemaType<typeof schema>;
export const HelpRedirect = (mongoose.models.HelpRedirect as Model<HelpRedirectRecord> | undefined) ?? mongoose.model<HelpRedirectRecord>("HelpRedirect", schema);
