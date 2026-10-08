import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  roleId: { type: Schema.Types.ObjectId, ref: "AccessRole", required: true, index: true },
  assignedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  expiresAt: { type: Date, default: null, index: true },
}, { timestamps: true });

schema.index({ organizationId: 1, userId: 1, roleId: 1 }, { unique: true });
export type UserRoleRecord = InferSchemaType<typeof schema> & { _id: mongoose.Types.ObjectId };
export const UserRole = (mongoose.models.UserRole as Model<UserRoleRecord> | undefined) ?? mongoose.model<UserRoleRecord>("UserRole", schema);
