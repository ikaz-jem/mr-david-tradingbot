import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const configSchema = new Schema({
  key: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: true },
  rewardType: { type: String, enum: ["percentage", "fixed"], default: "percentage" },
  rates: { type: [Number], default: [1000] },
  fixedRewardsMinor: { type: [Number], default: [500] },
  fixedCurrency: { type: String, enum: ["USD", "NGN", "GHS", "ZAR", "KES"], default: "USD" },
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
  rewardType: { type: String, enum: ["percentage", "fixed"], default: "percentage" },
  rewards: { type: [Number], default: [] },
  rewardCurrency: { type: String, default: "" },
}, { timestamps: true });
const commissionSchema = new Schema({
  beneficiaryId: { type: Schema.Types.ObjectId, required: true, index: true },
  buyerId: { type: Schema.Types.ObjectId, required: true },
  purchaseId: { type: Schema.Types.ObjectId, required: true },
  isDemo: { type: Boolean, required: true, index: true },
  level: { type: Number, required: true },
  rateBps: { type: Number, required: true },
  rewardType: { type: String, enum: ["percentage", "fixed"], default: "percentage" },
  saleMinor: { type: Number, required: true },
  saleCurrency: { type: String, default: "" },
  amountMinor: { type: Number, required: true },
  currency: { type: String, required: true },
  availableAt: { type: Date, required: true },
  status: { type: String, enum: ["earned", "paid", "reversed"], default: "earned" },
  payoutReference: { type: String, default: "" },
  settlementChannel: { type: String, enum: ["paystack", "nowpayments", "external", ""], default: "" },
  reason: { type: String, default: "" },
  updatedBy: { type: Schema.Types.ObjectId, default: null },
  paidAt: { type: Date, default: null },
}, { timestamps: true });
commissionSchema.index({ purchaseId: 1, level: 1 }, { unique: true });
commissionSchema.index({ beneficiaryId: 1, createdAt: -1 });
const payoutProfileSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, unique: true, ref: "User" },
  isDemo: { type: Boolean, required: true, index: true },
  method: { type: String, enum: ["paystack", "nowpayments", "external"], required: true },
  label: { type: String, required: true, maxlength: 120 },
  maskedDestination: { type: String, required: true, maxlength: 160 },
  detailsEncrypted: { type: String, required: true, select: false },
  revision: { type: Number, default: 0, min: 0 },
}, { timestamps: true });
type Config = InferSchemaType<typeof configSchema>;
type Account = InferSchemaType<typeof accountSchema>;
type Conversion = InferSchemaType<typeof conversionSchema>;
type Commission = InferSchemaType<typeof commissionSchema>;
type PayoutProfile = InferSchemaType<typeof payoutProfileSchema>;
export const AffiliateConfig = (mongoose.models.AffiliateConfig as Model<Config>) || mongoose.model("AffiliateConfig", configSchema);
export const AffiliateAccount = (mongoose.models.AffiliateAccount as Model<Account>) || mongoose.model("AffiliateAccount", accountSchema);
export const AffiliateConversion = (mongoose.models.AffiliateConversion as Model<Conversion>) || mongoose.model("AffiliateConversion", conversionSchema);
export const AffiliateCommission = (mongoose.models.AffiliateCommission as Model<Commission>) || mongoose.model("AffiliateCommission", commissionSchema);
export const AffiliatePayoutProfile = (mongoose.models.AffiliatePayoutProfile as Model<PayoutProfile>) || mongoose.model("AffiliatePayoutProfile", payoutProfileSchema);
