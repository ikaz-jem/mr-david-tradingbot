import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  key: { type: String, required: true, unique: true },
  status: { type: String, enum: ["idle", "running", "completed", "failed"], default: "idle" },
  leaseUntil: { type: Date, default: new Date(0) },
  runId: { type: String, default: "" },
  profilesEvaluated: { type: Number, min: 0, default: 0 },
  ordersAttempted: { type: Number, min: 0, default: 0 },
  ordersAccepted: { type: Number, min: 0, default: 0 },
  blocked: { type: Number, min: 0, default: 0 },
  lastError: { type: String, default: "", maxlength: 300 },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

export type AutopilotJobRecord = InferSchemaType<typeof schema>;
export const AutopilotJob = (mongoose.models.AutopilotJob as Model<AutopilotJobRecord> | undefined) ?? mongoose.model<AutopilotJobRecord>("AutopilotJob", schema);
