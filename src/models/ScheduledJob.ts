import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  key: { type: String, required: true, unique: true },
  status: { type: String, enum: ["idle", "running", "completed", "failed"], default: "idle" },
  leaseId: { type: String, default: null },
  leaseUntil: { type: Date, default: null },
  lastStartedAt: { type: Date, default: null },
  lastRecoveryAt: { type: Date, default: null },
  lastSucceededAt: { type: Date, default: null },
  lastFinishedAt: { type: Date, default: null },
  failures: { type: Number, default: 0 },
}, { timestamps: true });
type Record = InferSchemaType<typeof schema>;
export const ScheduledJob = (mongoose.models.ScheduledJob as Model<Record> | undefined) ?? mongoose.model<Record>("ScheduledJob", schema);
