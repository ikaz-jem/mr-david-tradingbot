import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  scope: { type: String, enum: ["live", "demo"], required: true, default: "live" },
  slug: { type: String, required: true },
  title: { type: String, required: true },
  summary: { type: String, required: true },
  categorySlug: { type: String, required: true, index: true },
  body: { type: String, required: true },
  draft: { type: Schema.Types.Mixed, default: null },
  draftStatus: { type: String, enum: ["draft", "review", null], default: null },
  keywords: { type: [String], default: [] },
  relatedSlugs: { type: [String], default: [] },
  status: { type: String, enum: ["draft", "review", "published", "archived", "deleted"], default: "draft", index: true },
  revision: { type: Number, default: 1 },
  sortOrder: { type: Number, default: 0 },
  createdBy: { type: Schema.Types.ObjectId, default: null },
  reviewedBy: { type: Schema.Types.ObjectId, default: null },
  publishedAt: { type: Date, default: null },
  reviewedAt: { type: Date, default: null },
}, { timestamps: true, optimisticConcurrency: true });
schema.index({ status: 1, categorySlug: 1, sortOrder: 1 });
schema.index({ scope: 1, slug: 1 }, { unique: true });
schema.index({ title: "text", summary: "text", body: "text", keywords: "text" });
export type HelpArticleRecord = InferSchemaType<typeof schema>;
export const HelpArticle = (mongoose.models.HelpArticle as Model<HelpArticleRecord> | undefined) ?? mongoose.model<HelpArticleRecord>("HelpArticle", schema);
