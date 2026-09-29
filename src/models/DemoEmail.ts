import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
const schema = new Schema({
  actorId: { type: Schema.Types.ObjectId, required: true },
  recipient: { type: String, required: true },
  category: { type: String, default: "admin_test" },
  subject: { type: String, required: true },
  status: { type: String, enum: ["simulated"], default: "simulated" },
}, { timestamps: true });
type Record = InferSchemaType<typeof schema>;
export const DemoEmail = (mongoose.models.DemoEmail as Model<Record> | undefined) ?? mongoose.model<Record>("DemoEmail", schema);
