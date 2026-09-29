import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const message = new Schema({
  authorId: { type: Schema.Types.ObjectId, required: true },
  authorName: { type: String, required: true },
  staff: { type: Boolean, default: false },
  internal: { type: Boolean, default: false },
  body: { type: String, required: true, maxlength: 4000 },
  createdAt: { type: Date, default: Date.now },
});
const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  isDemo: { type: Boolean, default: false, index: true },
  seedKey: { type: String },
  subject: { type: String, required: true, maxlength: 160 },
  category: { type: String, enum: ["account", "billing", "research", "exchange", "other"], required: true },
  priority: { type: String, enum: ["normal", "high", "urgent"], default: "normal" },
  status: { type: String, enum: ["open", "in_progress", "waiting", "resolved", "closed"], default: "open", index: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
  assignedName: { type: String, default: "" },
  messages: { type: [message], default: [] },
  revision: { type: Number, default: 0 },
}, { timestamps: true });
schema.index({ seedKey: 1 }, { unique: true, sparse: true });
schema.index({ isDemo: 1, status: 1, updatedAt: -1 });
export type SupportTicketRecord = InferSchemaType<typeof schema>;
export const SupportTicket = (mongoose.models.SupportTicket as Model<SupportTicketRecord> | undefined) ?? mongoose.model<SupportTicketRecord>("SupportTicket", schema);

