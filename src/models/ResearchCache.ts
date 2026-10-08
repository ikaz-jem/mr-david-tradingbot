import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const researchCacheSchema = new Schema({
  key: { type: String, required: true, unique: true, index: true },
  kind: { type: String, enum: ["candles", "decision"], required: true, index: true },
  payload: { type: Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

export type ResearchCacheRecord = InferSchemaType<typeof researchCacheSchema> & { _id: mongoose.Types.ObjectId };
export const ResearchCache = (mongoose.models.ResearchCache as Model<ResearchCacheRecord> | undefined) ?? mongoose.model<ResearchCacheRecord>("ResearchCache", researchCacheSchema);
