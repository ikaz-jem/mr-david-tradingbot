import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  permissionId: { type: Schema.Types.ObjectId, ref: "Permission", required: true },
  effect: { type: String, enum: ["allow", "deny"], required: true },
  reason: { type: String, required: true, trim: true, maxlength: 300 },
  grantedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  expiresAt: { type: Date, default: null, index: true },
}, { timestamps: true });

schema.index({ organizationId: 1, userId: 1, permissionId: 1 }, { unique: true });
export type UserPermissionRecord = InferSchemaType<typeof schema> & { _id: mongoose.Types.ObjectId };
export const UserPermission = (mongoose.models.UserPermission as Model<UserPermissionRecord> | undefined) ?? mongoose.model<UserPermissionRecord>("UserPermission", schema);
