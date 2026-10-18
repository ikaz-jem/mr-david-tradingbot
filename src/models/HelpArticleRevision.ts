import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  articleId: { type: Schema.Types.ObjectId, required: true, index: true },
  revision: { type: Number, required: true },
  actorId: { type: Schema.Types.ObjectId, required: true },
  action: { type: String, required: true },
  snapshot: { type: Schema.Types.Mixed, required: true },
}, { timestamps: true });
schema.index({ articleId: 1, revision: 1 }, { unique: true });
export type HelpArticleRevisionRecord = InferSchemaType<typeof schema>;
export const HelpArticleRevision = (mongoose.models.HelpArticleRevision as Model<HelpArticleRevisionRecord> | undefined) ?? mongoose.model<HelpArticleRevisionRecord>("HelpArticleRevision", schema);
