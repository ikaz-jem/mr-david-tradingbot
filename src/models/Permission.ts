import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  key: { type: String, required: true, unique: true, lowercase: true, trim: true },
  module: { type: String, required: true, lowercase: true, trim: true, index: true },
  resource: { type: String, required: true, lowercase: true, trim: true },
  action: { type: String, required: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, required: true, trim: true, maxlength: 300 },
  risk: { type: String, enum: ["low", "medium", "high", "critical"], default: "low" },
  active: { type: Boolean, default: true },
}, { timestamps: true });

schema.index({ module: 1, resource: 1, action: 1 });
export type PermissionRecord = InferSchemaType<typeof schema> & { _id: mongoose.Types.ObjectId };
export const Permission = (mongoose.models.Permission as Model<PermissionRecord> | undefined) ?? mongoose.model<PermissionRecord>("Permission", schema);
