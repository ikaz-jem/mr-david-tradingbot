import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, unique: true },
  planId: { type: String, enum: ["starter", "trader", "desk"], default: "trader" },
  periodEnd: { type: Date, required: true },
  wallets: { type: Map, of: Number, default: {} },
  revision: { type: Number, default: 0 },
  passwordHash: { type: String, select: false },
  passwordChangedAt: Date,
  receipts: { type: [{ requestId: String, kind: String, productId: String, itemId: String, amount: Number, credits: Number, createdAt: Date }], default: [] },
  activity: { type: [{ productId: String, amount: Number, note: String, createdAt: Date }], default: [] },
  connections: { type: [{ provider: String, label: String, connectedAt: Date }], default: [] },
}, { timestamps: true });
export type DemoWorkspaceRecord = InferSchemaType<typeof schema>;
export const DemoWorkspace = (mongoose.models.DemoWorkspace as Model<DemoWorkspaceRecord> | undefined) ?? mongoose.model<DemoWorkspaceRecord>("DemoWorkspace", schema);

