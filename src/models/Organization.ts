import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  slug: { type: String, required: true, lowercase: true, trim: true },
  kind: { type: String, enum: ["platform", "customer"], default: "customer" },
  status: { type: String, enum: ["active", "suspended", "closed"], default: "active", index: true },
  isDemo: { type: Boolean, default: false, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

schema.index({ slug: 1, isDemo: 1 }, { unique: true });
export type OrganizationRecord = InferSchemaType<typeof schema> & { _id: mongoose.Types.ObjectId };
export const Organization = (mongoose.models.Organization as Model<OrganizationRecord> | undefined) ?? mongoose.model<OrganizationRecord>("Organization", schema);
