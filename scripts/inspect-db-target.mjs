import mongoose from "mongoose";

if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing.");
await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false, serverSelectionTimeoutMS: 15_000 });
try {
  const collections = await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray();
  console.log(JSON.stringify({ database: mongoose.connection.name, remote: !["localhost", "127.0.0.1"].includes(mongoose.connection.host), collectionCount: collections.length }));
} finally {
  await mongoose.disconnect();
}
