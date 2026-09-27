import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const exchangeConnectionEventSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  provider: { type: String, required: true },
  action: { type: String, enum: ["connected", "replaced", "checked", "check_failed", "disconnected"], required: true },
  detail: { type: String, required: true, maxlength: 180 },
}, { timestamps: true });

exchangeConnectionEventSchema.index({ createdAt: -1 });
export type ExchangeConnectionEventRecord = InferSchemaType<typeof exchangeConnectionEventSchema>;
export const ExchangeConnectionEvent = (mongoose.models.ExchangeConnectionEvent as Model<ExchangeConnectionEventRecord> | undefined) ?? mongoose.model<ExchangeConnectionEventRecord>("ExchangeConnectionEvent", exchangeConnectionEventSchema);
