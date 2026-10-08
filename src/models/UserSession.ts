import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", default: null, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  sessionId: { type: String, required: true, unique: true },
  status: { type: String, enum: ["active", "revoked", "expired"], default: "active", index: true },
  lastSeenAt: { type: Date, default: Date.now, index: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  revokedAt: { type: Date, default: null },
  ip: { type: String, default: "" },
  userAgent: { type: String, default: "", maxlength: 500 },
}, { timestamps: true });

schema.index({ userId: 1, status: 1, lastSeenAt: -1 });
export type UserSessionRecord = InferSchemaType<typeof schema> & { _id: mongoose.Types.ObjectId };
export const UserSession = (mongoose.models.UserSession as Model<UserSessionRecord> | undefined) ?? mongoose.model<UserSessionRecord>("UserSession", schema);
