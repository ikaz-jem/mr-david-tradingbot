import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
const schema = new Schema({
  articleId: { type: Schema.Types.ObjectId, required: true, index: true },
  visitorKey: { type: String, required: true },
  helpful: { type: Boolean, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
schema.index({ articleId: 1, visitorKey: 1 }, { unique: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export type HelpFeedbackRecord = InferSchemaType<typeof schema>;
export const HelpFeedback = (mongoose.models.HelpFeedback as Model<HelpFeedbackRecord> | undefined) ?? mongoose.model<HelpFeedbackRecord>("HelpFeedback", schema);
