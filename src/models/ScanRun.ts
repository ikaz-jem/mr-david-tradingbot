import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

const scanRunSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  requestId: { type: String, required: true },
  symbol: { type: String, required: true },
  status: { type: String, enum: ["running", "completed", "failed"], default: "running" },
  outcome: { type: String, enum: ["setup", "no_setup"], default: null },
  summary: { type: String, default: "" },
  signalId: { type: Schema.Types.ObjectId, ref: "Signal", default: null },
  dataCutoff: { type: Date, default: null },
  charged: { type: Boolean, default: false },
}, { timestamps: true });

scanRunSchema.index({ userId: 1, requestId: 1 }, { unique: true });
export type ScanRunRecord = InferSchemaType<typeof scanRunSchema> & { _id: mongoose.Types.ObjectId };
export const ScanRun = (mongoose.models.ScanRun as Model<ScanRunRecord> | undefined) ?? mongoose.model<ScanRunRecord>("ScanRun", scanRunSchema);
