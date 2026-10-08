import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const configSchema = new Schema({
  key: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: true },
  rates: { type: [Number], default: [1000] },
  cookieDays: { type: Number, default: 30 },
  holdDays: { type: Number, default: 14 },
}, { timestamps: true });
const accountSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, unique: true, ref: "User" },
  code: { type: String, required: true, unique: true },
  isDemo: { type: Boolean, required: true, index: true },
  sponsorId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
}, { timestamps: true });
const conversionSchema = new Schema({
  buyerId: { type: Schema.Types.ObjectId, required: true, unique: true },
  purchaseId: { type: Schema.Types.ObjectId, required: true, unique: true },
  isDemo: { type: Boolean, required: true },
  amountMinor: { type: Number, required: true },
  currency: { type: String, required: true },
  rates: { type: [Number], required: true },
}, { timestamps: true });
const commissionSchema = new Schema({
  beneficiaryId: { type: Schema.Types.ObjectId, required: true, index: true },
  buyerId: { type: Schema.Types.ObjectId, required: true },
  purchaseId: { type: Schema.Types.ObjectId, required: true },
  isDemo: { type: Boolean, required: true, index: true },
  level: { type: Number, required: true },
  rateBps: { type: Number, required: true },
  saleMinor: { type: Number, required: true },
  amountMinor: { type: Number, required: true },
  currency: { type: String, required: true },
  availableAt: { type: Date, required: true },
  status: { type: String, enum: ["earned", "paid", "reversed"], default: "earned" },
  payoutReference: { type: String, default: "" },
  reason: { type: String, default: "" },
  updatedBy: { type: Schema.Types.ObjectId, default: null },
  paidAt: { type: Date, default: null },
}, { timestamps: true });
commissionSchema.index({ purchaseId: 1, level: 1 }, { unique: true });
commissionSchema.index({ beneficiaryId: 1, createdAt: -1 });
type Config = InferSchemaType<typeof configSchema>;
type Account = InferSchemaType<typeof accountSchema>;
type Conversion = InferSchemaType<typeof conversionSchema>;
type Commission = InferSchemaType<typeof commissionSchema>;
export const AffiliateConfig = (mongoose.models.AffiliateConfig as Model<Config>) || mongoose.model("AffiliateConfig", configSchema);
export const AffiliateAccount = (mongoose.models.AffiliateAccount as Model<Account>) || mongoose.model("AffiliateAccount", accountSchema);
export const AffiliateConversion = (mongoose.models.AffiliateConversion as Model<Conversion>) || mongoose.model("AffiliateConversion", conversionSchema);
export const AffiliateCommission = (mongoose.models.AffiliateCommission as Model<Commission>) || mongoose.model("AffiliateCommission", commissionSchema);
