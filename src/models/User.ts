import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

const settingsSchema = new Schema({
  timezone: { type: String, default: "UTC", maxlength: 64 },
  locale: { type: String, enum: ["en"], default: "en" },
  defaultSymbol: { type: String, default: "BTCUSDT", maxlength: 20 },
  defaultInterval: { type: String, enum: ["5m", "15m", "30m", "1h", "2h", "4h", "6h", "12h", "1d", "3d", "1w"], default: "4h" },
  defaultStrategy: { type: String, default: "ai-router", maxlength: 40 },
  riskProfile: { type: String, enum: ["conservative", "balanced", "aggressive"], default: "balanced" },
  compactMode: { type: Boolean, default: false },
  reducedMotion: { type: Boolean, default: false },
  inAppResearch: { type: Boolean, default: true },
  inAppBilling: { type: Boolean, default: true },
  inAppExchange: { type: Boolean, default: true },
  emailResearch: { type: Boolean, default: true },
  emailBilling: { type: Boolean, default: true },
  emailSecurity: { type: Boolean, default: true },
}, { _id: false });

const userSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", default: null, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["user", "staff", "admin"], default: "user", index: true },
  status: { type: String, enum: ["invited", "active", "suspended", "banned", "deactivated", "closed"], default: "active", index: true },
  countryCode: { type: String, default: null },
  creditBalance: { type: Number, default: 0, min: 0 },
  activatedAt: { type: Date, default: null, index: true },
  activationReference: { type: String, default: null },
  emailVerifiedAt: { type: Date, default: null },
  authVersion: { type: Number, default: 0 },
  isDemo: { type: Boolean, default: false },
  mustChangePassword: { type: Boolean, default: false },
  invitedAt: { type: Date, default: null },
  invitedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  lastActivityAt: { type: Date, default: null, index: true },
  mfaEnrolledAt: { type: Date, default: null },
  mfaRequired: { type: Boolean, default: false },
  settings: { type: settingsSchema, default: () => ({}) },
  lastPasswordChangedAt: { type: Date, default: null },
  closedAt: { type: Date, default: null },
}, { timestamps: true });

userSchema.index({ organizationId: 1, status: 1, role: 1 });

export type UserRecord = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };
export const User = (mongoose.models.User as Model<UserRecord> | undefined) ?? mongoose.model<UserRecord>("User", userSchema);
