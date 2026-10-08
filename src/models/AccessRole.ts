import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  slug: { type: String, required: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, required: true, trim: true, maxlength: 300 },
  parentRoleId: { type: Schema.Types.ObjectId, ref: "AccessRole", default: null },
  system: { type: Boolean, default: false },
  superAdmin: { type: Boolean, default: false },
  status: { type: String, enum: ["active", "disabled"], default: "active", index: true },
  revision: { type: Number, min: 0, default: 0 },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

schema.index({ organizationId: 1, slug: 1 }, { unique: true });
export type AccessRoleRecord = InferSchemaType<typeof schema> & { _id: mongoose.Types.ObjectId };
export const AccessRole = (mongoose.models.AccessRole as Model<AccessRoleRecord> | undefined) ?? mongoose.model<AccessRoleRecord>("AccessRole", schema);
