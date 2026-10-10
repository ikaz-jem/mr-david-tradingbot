import mongoose from "mongoose";

if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing.");

await mongoose.connect(process.env.MONGODB_URI, {
  bufferCommands: false,
  serverSelectionTimeoutMS: 15_000,
});

try {
  const database = mongoose.connection.db;
  if (!database) throw new Error("MongoDB connection is unavailable.");
  const connections = database.collection("exchangeconnections");

  await connections.updateMany(
    { market: { $exists: false } },
    { $set: { market: "spot" } },
  );
  await connections.updateMany(
    { environment: { $exists: false } },
    { $set: { environment: "live" } },
  );

  const duplicates = await connections.aggregate([
    { $group: { _id: { userId: "$userId", provider: "$provider", market: "$market", environment: "$environment" }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 1 },
  ]).toArray();
  if (duplicates.length) throw new Error("Duplicate market-scoped exchange connections exist. Resolve them before migrating.");

  const desiredIndexName = "userId_1_provider_1_market_1_environment_1";
  await connections.createIndex(
    { userId: 1, provider: 1, market: 1, environment: 1 },
    { unique: true, name: desiredIndexName },
  );

  const indexes = await connections.indexes();
  const legacyIndexes = indexes.filter(index => {
    const entries = Object.entries(index.key ?? {});
    return index.unique === true
      && entries.length === 2
      && entries[0]?.[0] === "userId"
      && entries[0]?.[1] === 1
      && entries[1]?.[0] === "provider"
      && entries[1]?.[1] === 1;
  });
  for (const index of legacyIndexes) {
    if (!index.name) throw new Error("A legacy unique index has no name and cannot be removed safely.");
    await connections.dropIndex(index.name);
  }

  console.log(JSON.stringify({
    database: mongoose.connection.name,
    migration: "exchange-market-connections",
    createdIndex: desiredIndexName,
    removedIndexes: legacyIndexes.map(index => index.name),
    ok: true,
  }));
} finally {
  await mongoose.disconnect();
}
