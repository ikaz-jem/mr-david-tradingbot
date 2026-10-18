import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  articleId: { type: Schema.Types.ObjectId, required: true, index: true },
  key: { type: String, required: true, unique: true },
  alt: { type: String, required: true },
  caption: { type: String, default: "" },
  contentType: { type: String, default: "image/webp" },
  published: { type: Boolean, default: false },
  byteSize: { type: Number, required: true },
  status: { type: String, enum: ["active", "upload_pending", "deletion_pending"], default: "upload_pending", index: true },
  uploadedBy: { type: Schema.Types.ObjectId, required: true },
}, { timestamps: true });
export type HelpAssetRecord = InferSchemaType<typeof schema>;
export const HelpAsset = (mongoose.models.HelpAsset as Model<HelpAssetRecord> | undefined) ?? mongoose.model<HelpAssetRecord>("HelpAsset", schema);
