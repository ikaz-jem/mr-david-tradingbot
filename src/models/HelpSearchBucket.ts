import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
const schema = new Schema({
  key: { type: String, unique: true, required: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
}, { timestamps: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export type HelpSearchBucketRecord = InferSchemaType<typeof schema>;
export const HelpSearchBucket = (mongoose.models.HelpSearchBucket as Model<HelpSearchBucketRecord> | undefined) ?? mongoose.model<HelpSearchBucketRecord>("HelpSearchBucket", schema);
