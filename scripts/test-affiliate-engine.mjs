import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import mongoose from "mongoose";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) return nextResolve(pathToFileURL(path.join(root, "src", `${specifier.slice(2)}.ts`)).href, context);
  return nextResolve(specifier, context);
} });
const { User } = await import("../src/models/User.ts");
const { BillingPurchase } = await import("../src/models/BillingPurchase.ts");
const { AffiliateAccount, AffiliateCommission, AffiliateConfig, AffiliateConversion } = await import("../src/models/Affiliate.ts");
const { creditFirstPurchase, referralSponsor } = await import("../src/lib/affiliates.ts");
const database = `enrivea_affiliate_test_${Date.now()}`;
await mongoose.connect(process.env.MONGODB_URI, { dbName: database, serverSelectionTimeoutMS: 10000 });
try {
  await Promise.all([User.init(), BillingPurchase.init(), AffiliateAccount.init(), AffiliateCommission.init(), AffiliateConfig.init(), AffiliateConversion.init()]);
  const makeUser = name => User.create({ name, email: `${name}@example.invalid`, passwordHash: "not-a-login-hash", isDemo: false });
  const upper = await makeUser("upper");
  const direct = await makeUser("direct");
  const buyer = await makeUser("buyer");
  await AffiliateConfig.create({ key: "global", enabled: true, rates: [1250, 250], holdDays: 14 });
  await AffiliateAccount.create([
    { userId: upper._id, code: "a".repeat(24), isDemo: false },
    { userId: direct._id, sponsorId: upper._id, code: "b".repeat(24), isDemo: false },
    { userId: buyer._id, sponsorId: direct._id, code: "c".repeat(24), isDemo: false },
  ]);
  assert.equal(String(await referralSponsor("b".repeat(24))), String(direct._id));
  const makePurchase = (userId, reference) => BillingPurchase.create({ userId, reference, kind: "activation", itemId: "account_activation", credits: 100, expectedAmount: 3000, currency: "NGN", status: "paid" });
  const purchase = await makePurchase(buyer._id, "first");
  await mongoose.connection.transaction(session => creditFirstPurchase(purchase, session));
  let rows = await AffiliateCommission.find({ purchaseId: purchase._id }).sort({ level: 1 }).lean();
  assert.deepEqual(rows.map(row => row.amountMinor), [375, 75]);
  assert.equal(String(rows[0].beneficiaryId), String(direct._id));
  assert.ok(rows[0].availableAt > new Date());
  await mongoose.connection.transaction(session => creditFirstPurchase(purchase, session));
  assert.equal(await AffiliateCommission.countDocuments({}), 2, "Duplicate fulfillment must not award twice");
  const refill = await makePurchase(buyer._id, "refill");
  await mongoose.connection.transaction(session => creditFirstPurchase(refill, session));
  assert.equal(await AffiliateCommission.countDocuments({}), 2, "Repeat purchases never award");
  await AffiliateConfig.updateOne({ key: "global" }, { $set: { rates: [5000] } });
  rows = await AffiliateCommission.find({ purchaseId: purchase._id }).sort({ level: 1 }).lean();
  assert.deepEqual(rows.map(row => row.rateBps), [1250, 250], "Existing rates remain immutable");
  const disabledBuyer = await makeUser("disabled");
  await AffiliateAccount.create({ userId: disabledBuyer._id, sponsorId: direct._id, code: "d".repeat(24), isDemo: false });
  await AffiliateConfig.updateOne({ key: "global" }, { $set: { enabled: false } });
  const disabledPurchase = await makePurchase(disabledBuyer._id, "disabled-first");
  await mongoose.connection.transaction(session => creditFirstPurchase(disabledPurchase, session));
  await AffiliateConfig.updateOne({ key: "global" }, { $set: { enabled: true } });
  const disabledRefill = await makePurchase(disabledBuyer._id, "disabled-second");
  await mongoose.connection.transaction(session => creditFirstPurchase(disabledRefill, session));
  assert.equal(await AffiliateCommission.countDocuments({}), 2, "Enabling later must not reward second purchase");
  const rollbackBuyer = await makeUser("rollback");
  await AffiliateAccount.create({ userId: rollbackBuyer._id, sponsorId: direct._id, code: "e".repeat(24), isDemo: false });
  const rollbackPurchase = await makePurchase(rollbackBuyer._id, "rollback");
  await assert.rejects(mongoose.connection.transaction(async session => { await creditFirstPurchase(rollbackPurchase, session); throw new Error("Intentional rollback"); }));
  assert.equal(await AffiliateConversion.countDocuments({ buyerId: rollbackBuyer._id }), 0);
  assert.equal(await AffiliateCommission.countDocuments({}), 2);
  console.log("PASS: real MongoDB transactions, first-purchase-only commissions, two-level precision, idempotency, disabled-program behavior, rate snapshots, and rollback.");
} finally {
  if (mongoose.connection.name !== database || !/^enrivea_affiliate_test_\d+$/.test(database)) throw new Error("Unexpected test database; refusing cleanup");
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
