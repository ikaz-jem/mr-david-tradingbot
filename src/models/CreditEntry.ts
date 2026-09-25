import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

const creditEntrySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  amount: { type: Number, required: true },
  kind: { type: String, enum: ["welcome", "purchase", "reserve", "release", "capture", "adjustment", "refund"], required: true },
  sourceKey: { type: String, required: true, unique: true },
  note: { type: String, default: "" },
}, { timestamps: true });

creditEntrySchema.index({ userId: 1, createdAt: -1 });
export type CreditEntryRecord = InferSchemaType<typeof creditEntrySchema>;
export const CreditEntry = (mongoose.models.CreditEntry as Model<CreditEntryRecord> | undefined) ?? mongoose.model<CreditEntryRecord>("CreditEntry", creditEntrySchema);
