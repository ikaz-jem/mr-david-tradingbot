import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { scanSymbols } from "@/lib/scan-markets";

const creditPackSchema = new Schema({
  id: { type: String, required: true, maxlength: 40 },
  label: { type: String, required: true, maxlength: 80 },
  credits: { type: Number, required: true, min: 1, max: 100000 },
  priceMinor: { type: Number, required: true, min: 1, max: 100000000 },
  enabled: { type: Boolean, default: true },
}, { _id: false });

const platformConfigSchema = new Schema({
  key: { type: String, required: true, unique: true, default: "global" },
  registrationOpen: { type: Boolean, default: true },
  scansOpen: { type: Boolean, default: true },
  approvalDiscoveryOpen: { type: Boolean, default: true },
  autopilotOpen: { type: Boolean, default: true },
  exchangeConnectionsOpen: { type: Boolean, default: true },
  billingOpen: { type: Boolean, default: true },
  supportOpen: { type: Boolean, default: true },
  paperReconciliationOpen: { type: Boolean, default: true },
  contactIntakeOpen: { type: Boolean, default: true },
  maintenanceMode: { type: Boolean, default: false },
  maintenanceMessage: { type: String, default: "Enrivea Signal is undergoing scheduled maintenance. Existing data remains safe; please try again shortly.", maxlength: 240 },
  registrationPausedMessage: { type: String, default: "New registrations are temporarily paused. Please check back shortly.", maxlength: 240 },
  scansPausedMessage: { type: String, default: "Research scans are temporarily paused by operations. No credit was charged.", maxlength: 240 },
  approvalPausedMessage: { type: String, default: "Approval Desk discovery is temporarily paused. Existing unlocked research remains available.", maxlength: 240 },
  autopilotPausedMessage: { type: String, default: "Autopilot is temporarily paused by operations. No new automated actions will be created.", maxlength: 240 },
  exchangeConnectionsPausedMessage: { type: String, default: "New exchange connections are temporarily paused. Existing credentials remain protected and can still be removed.", maxlength: 240 },
  billingPausedMessage: { type: String, default: "Account activation and credit purchases are temporarily paused. No payment was initiated.", maxlength: 240 },
  supportPausedMessage: { type: String, default: "New support tickets are temporarily paused. Existing conversations remain available.", maxlength: 240 },
  paperReconciliationPausedMessage: { type: String, default: "Paper outcome refresh is temporarily paused. Existing performance records are unchanged.", maxlength: 240 },
  contactIntakePausedMessage: { type: String, default: "Contact intake is temporarily paused. Please use the published support email address.", maxlength: 240 },
  activationOpen: { type: Boolean, default: true },
  activationPriceMinor: { type: Number, default: 2500, min: 1, max: 100000000 },
  activationCredits: { type: Number, default: 25, min: 1, max: 100000 },
  creditPacks: { type: [creditPackSchema], default: [
    { id: "credits_25", label: "25 platform credits", credits: 25, priceMinor: 1500, enabled: true },
    { id: "credits_100", label: "100 platform credits", credits: 100, priceMinor: 5000, enabled: true },
  ] },
  allowedScanSymbols: { type: [String], default: [...scanSymbols] },
  approvalScanSymbols: { type: [String], default: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"] },
  approvalScanIntervals: { type: [String], default: ["15m", "1h", "4h"] },
  approvalScanStrategySlugs: { type: [String], default: ["ai-router", "trend-breakout", "momentum-continuation", "mean-reversion"] },
  approvalScanMaxCombinations: { type: Number, default: 120, min: 1, max: 500 },
  approvalScanCadenceMinutes: { type: Number, enum: [5, 10, 15, 30, 60], default: 5 },
  announcement: { type: String, default: "" },
}, { timestamps: true });

export type PlatformConfigRecord = InferSchemaType<typeof platformConfigSchema>;
export const PlatformConfig = (mongoose.models.PlatformConfig as Model<PlatformConfigRecord> | undefined) ?? mongoose.model<PlatformConfigRecord>("PlatformConfig", platformConfigSchema);
