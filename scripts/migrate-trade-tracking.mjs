import mongoose from "mongoose";

if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing.");
await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false, serverSelectionTimeoutMS: 15_000 });
try {
  const orders = mongoose.connection.db.collection("orders");
  const fills = mongoose.connection.db.collection("tradefills");
  const indexes = [
    await orders.createIndex({ positionGuardKey: 1 }, { unique: true, sparse: true, name: "positionGuardKey_1" }),
    await orders.createIndex({ market: 1, trackingStatus: 1, nextTrackAt: 1 }, { name: "market_1_trackingStatus_1_nextTrackAt_1" }),
    await fills.createIndex({ connectionId: 1, market: 1, symbol: 1, exchangeTradeId: 1 }, { unique: true, name: "connectionId_1_market_1_symbol_1_exchangeTradeId_1" }),
    await fills.createIndex({ userId: 1, tradedAt: -1 }, { name: "userId_1_tradedAt_-1" }),
  ];
  console.log(JSON.stringify({ database: mongoose.connection.name, migration: "trade-tracking", indexes, ok: true }));
} finally {
  await mongoose.disconnect();
}
