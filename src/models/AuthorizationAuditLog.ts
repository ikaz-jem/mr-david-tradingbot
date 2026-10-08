import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", default: null, index: true },
  actorId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
  action: { type: String, required: true, index: true },
  resource: { type: String, required: true, index: true },
  targetType: { type: String, required: true },
  targetId: { type: String, default: "" },
  previousValue: { type: Schema.Types.Mixed, default: null },
  newValue: { type: Schema.Types.Mixed, default: null },
  outcome: { type: String, enum: ["success", "denied", "failed"], required: true, index: true },
  reason: { type: String, default: "", maxlength: 500 },
  ip: { type: String, default: "" },
  userAgent: { type: String, default: "", maxlength: 500 },
  requestId: { type: String, default: "", index: true },
  metadata: { type: Schema.Types.Mixed, default: null },
}, { timestamps: { createdAt: true, updatedAt: false } });

schema.index({ organizationId: 1, createdAt: -1 });
schema.index({ actorId: 1, createdAt: -1 });
export type AuthorizationAuditLogRecord = InferSchemaType<typeof schema> & { _id: mongoose.Types.ObjectId };
export const AuthorizationAuditLog = (mongoose.models.AuthorizationAuditLog as Model<AuthorizationAuditLogRecord> | undefined) ?? mongoose.model<AuthorizationAuditLogRecord>("AuthorizationAuditLog", schema);
