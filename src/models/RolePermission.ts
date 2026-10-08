import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  roleId: { type: Schema.Types.ObjectId, ref: "AccessRole", required: true, index: true },
  permissionId: { type: Schema.Types.ObjectId, ref: "Permission", required: true },
  effect: { type: String, enum: ["allow", "deny"], default: "allow" },
  grantedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

schema.index({ organizationId: 1, roleId: 1, permissionId: 1 }, { unique: true });
export type RolePermissionRecord = InferSchemaType<typeof schema> & { _id: mongoose.Types.ObjectId };
export const RolePermission = (mongoose.models.RolePermission as Model<RolePermissionRecord> | undefined) ?? mongoose.model<RolePermissionRecord>("RolePermission", schema);
