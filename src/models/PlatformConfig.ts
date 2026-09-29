import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { scanSymbols } from "@/lib/scan-markets";

const platformConfigSchema = new Schema({
  key: { type: String, required: true, unique: true, default: "global" },
  registrationOpen: { type: Boolean, default: true },
  scansOpen: { type: Boolean, default: true },
  exchangeConnectionsOpen: { type: Boolean, default: true },
  paperReconciliationOpen: { type: Boolean, default: true },
  contactIntakeOpen: { type: Boolean, default: true },
  allowedScanSymbols: { type: [String], default: [...scanSymbols] },
  announcement: { type: String, default: "" },
}, { timestamps: true });

export type PlatformConfigRecord = InferSchemaType<typeof platformConfigSchema>;
export const PlatformConfig = (mongoose.models.PlatformConfig as Model<PlatformConfigRecord> | undefined) ?? mongoose.model<PlatformConfigRecord>("PlatformConfig", platformConfigSchema);
