import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["user", "staff", "admin"], default: "user", index: true },
  status: { type: String, enum: ["active", "suspended"], default: "active" },
  countryCode: { type: String, default: null },
  creditBalance: { type: Number, default: 5, min: 0 },
  emailVerifiedAt: { type: Date, default: null },
  authVersion: { type: Number, default: 0 },
  isDemo: { type: Boolean, default: false },
}, { timestamps: true });

export type UserRecord = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };
export const User = (mongoose.models.User as Model<UserRecord> | undefined) ?? mongoose.model<UserRecord>("User", userSchema);
