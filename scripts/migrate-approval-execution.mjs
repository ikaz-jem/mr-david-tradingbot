import mongoose from "mongoose";

if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing.");
await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false, serverSelectionTimeoutMS: 15_000 });
try {
  const orders = mongoose.connection.db.collection("orders");
  const name = await orders.createIndex({ activeKey: 1 }, { unique: true, sparse: true, name: "activeKey_1" });
  console.log(JSON.stringify({ database: mongoose.connection.name, migration: "approval-execution", index: name, ok: true }));
} finally {
  await mongoose.disconnect();
}
