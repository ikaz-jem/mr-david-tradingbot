import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  key: { type: String, required: true, unique: true },
  status: { type: String, enum: ["idle", "running", "completed", "failed"], default: "idle" },
  leaseUntil: { type: Date, default: new Date(0) },
  runId: { type: String, default: "" },
  combinations: { type: Number, min: 0, default: 0 },
  opportunitiesCreated: { type: Number, min: 0, default: 0 },
  outcomes: { type: [{ symbol: String, interval: String, strategy: String, result: String }], default: [] },
  eligibleUsers: { type: Number, default: 0 },
  nextOffset: { type: Number, default: 0 },
  lastError: { type: String, default: "" },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

export type ApprovalScanJobRecord = InferSchemaType<typeof schema> & { _id: mongoose.Types.ObjectId };
export const ApprovalScanJob = (mongoose.models.ApprovalScanJob as Model<ApprovalScanJobRecord> | undefined) ?? mongoose.model<ApprovalScanJobRecord>("ApprovalScanJob", schema);
