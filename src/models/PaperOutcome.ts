import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

const paperOutcomeSchema = new Schema({
  signalId: { type: Schema.Types.ObjectId, ref: "Signal", required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  status: { type: String, enum: ["waiting", "open", "closed", "expired"], required: true },
  reason: { type: String, enum: ["none", "stop", "target", "time_exit", "no_entry"], required: true },
  entryAt: { type: Date, default: null },
  exitAt: { type: Date, default: null },
  exitPrice: { type: Number, default: null },
  netReturnPct: { type: Number, default: null },
  methodVersion: { type: String, required: true },
  feeRate: { type: Number, required: true },
  slippageRate: { type: Number, required: true },
  checkedAt: { type: Date, required: true },
}, { timestamps: true });

paperOutcomeSchema.index({ userId: 1, updatedAt: -1 });
export type PaperOutcomeRecord = InferSchemaType<typeof paperOutcomeSchema> & { _id: mongoose.Types.ObjectId };
export const PaperOutcome = (mongoose.models.PaperOutcome as Model<PaperOutcomeRecord> | undefined) ?? mongoose.model<PaperOutcomeRecord>("PaperOutcome", paperOutcomeSchema);
