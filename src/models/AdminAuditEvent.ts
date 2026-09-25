import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const adminAuditEventSchema = new Schema({
  actorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  targetUserId: { type: Schema.Types.ObjectId, ref: "User", index: true },
  targetType: { type: String, enum: ["user", "platform", "signal"], default: "user" },
  targetId: { type: String, default: "" },
  action: { type: String, required: true },
  before: { type: String, required: true },
  after: { type: String, required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ["pending", "applied", "failed"], default: "pending", index: true },
}, { timestamps: true });

adminAuditEventSchema.index({ createdAt: -1 });
export type AdminAuditEventRecord = InferSchemaType<typeof adminAuditEventSchema> & { _id: mongoose.Types.ObjectId };
export const AdminAuditEvent = (mongoose.models.AdminAuditEvent as Model<AdminAuditEventRecord> | undefined) ?? mongoose.model<AdminAuditEventRecord>("AdminAuditEvent", adminAuditEventSchema);
