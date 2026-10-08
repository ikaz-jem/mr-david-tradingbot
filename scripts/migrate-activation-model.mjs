import mongoose from "mongoose";

if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing.");

await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false, serverSelectionTimeoutMS: 15_000 });
const db = mongoose.connection.db;
const database = mongoose.connection.name;
if (["admin", "config", "local", "test"].includes(database.toLowerCase())) throw new Error(`Refusing to migrate generic database ${database}.`);
if (["localhost", "127.0.0.1"].includes(mongoose.connection.host)) throw new Error("Refusing to run the live migration against localhost.");

const users = db.collection("users");
const productAccounts = db.collection("productaccounts");
const purchases = db.collection("billingpurchases");
const ledger = db.collection("creditentries");
const now = new Date();

await db.collection("platformconfigs").updateOne({ key: "global" }, {
  $set: { updatedAt: now },
  $setOnInsert: { key: "global", registrationOpen: true, scansOpen: true, exchangeConnectionsOpen: true, paperReconciliationOpen: true, contactIntakeOpen: true, allowedScanSymbols: ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "AVAXUSDT", "LINKUSDT", "DOTUSDT"], announcement: "", createdAt: now },
}, { upsert: true });
await db.collection("platformconfigs").updateOne({ key: "global", activationPriceMinor: { $exists: false } }, { $set: { activationPriceMinor: 2500 } });
await db.collection("platformconfigs").updateOne({ key: "global", activationCredits: { $exists: false } }, { $set: { activationCredits: 25 } });
await db.collection("platformconfigs").updateOne({ key: "global", activationOpen: { $exists: false } }, { $set: { activationOpen: true } });
await db.collection("platformconfigs").updateOne({ key: "global", creditPacks: { $exists: false } }, { $set: { creditPacks: [{ id: "credits_25", label: "25 platform credits", credits: 25, priceMinor: 1500, enabled: true }, { id: "credits_100", label: "100 platform credits", credits: 100, priceMinor: 5000, enabled: true }] } });

const entitled = new Map();
for await (const account of productAccounts.find({ subscriptionStatus: "active", planId: { $ne: null } })) {
  const key = String(account.userId);
  const previous = entitled.get(key);
  if (!previous || (account.creditBalance ?? 0) > (previous.creditBalance ?? 0)) entitled.set(key, account);
}
for await (const purchase of purchases.find({ kind: "monthly", status: "paid" })) {
  if (!entitled.has(String(purchase.userId))) entitled.set(String(purchase.userId), { userId: purchase.userId, creditBalance: 0, updatedAt: purchase.verifiedAt ?? purchase.updatedAt });
}

let activated = 0;
let balancesUpdated = 0;
let ledgerAdjusted = 0;
for await (const user of users.find({ isDemo: { $ne: true } })) {
  const legacy = entitled.get(String(user._id));
  const shouldActivate = Boolean(user.activatedAt || legacy || user.role === "admin" || user.role === "staff");
  const balance = Math.max(0, Number(user.creditBalance ?? 0), Number(legacy?.creditBalance ?? 0));
  const activationDate = user.activatedAt ?? legacy?.updatedAt ?? (shouldActivate ? now : null);
  const update = { creditBalance: balance, updatedAt: now };
  if (shouldActivate) {
    update.activatedAt = activationDate;
    update.activationReference = user.activationReference ?? "migration:legacy-entitlement";
    if (!user.activatedAt) activated += 1;
  }
  if (balance !== Number(user.creditBalance ?? 0)) balancesUpdated += 1;
  await users.updateOne({ _id: user._id }, { $set: update });

  const totals = await ledger.aggregate([{ $match: { userId: user._id } }, { $group: { _id: null, amount: { $sum: "$amount" } } }]).toArray();
  const delta = balance - Number(totals[0]?.amount ?? 0);
  if (delta !== 0) {
    await ledger.updateOne({ sourceKey: `migration:platform-balance:${user._id}` }, { $setOnInsert: { userId: user._id, productId: "platform", amount: delta, kind: "adjustment", sourceKey: `migration:platform-balance:${user._id}`, note: "Unified platform balance migration", createdAt: now, updatedAt: now } }, { upsert: true });
    ledgerAdjusted += 1;
  }
}

console.log(JSON.stringify({ database, activated, balancesUpdated, ledgerAdjusted }, null, 2));
await mongoose.disconnect();
