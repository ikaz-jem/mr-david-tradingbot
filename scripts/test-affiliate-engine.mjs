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
  const makePurchase = (userId, reference, kind = "activation") => BillingPurchase.create({ userId, reference, kind, itemId: kind === "activation" ? "account_activation" : "credits_25", credits: 100, expectedAmount: 3000, currency: "NGN", status: "paid" });
  const purchase = await makePurchase(buyer._id, "first");
  await mongoose.connection.transaction(session => creditFirstPurchase(purchase, session));
  let rows = await AffiliateCommission.find({ purchaseId: purchase._id }).sort({ level: 1 }).lean();
  assert.deepEqual(rows.map(row => row.amountMinor), [375, 75]);
  assert.equal(String(rows[0].beneficiaryId), String(direct._id));
  assert.ok(rows[0].availableAt > new Date());
  await mongoose.connection.transaction(session => creditFirstPurchase(purchase, session));
  assert.equal(await AffiliateCommission.countDocuments({}), 2, "Duplicate fulfillment must not award twice");
  const refill = await makePurchase(buyer._id, "refill", "topup");
  await mongoose.connection.transaction(session => creditFirstPurchase(refill, session));
  assert.equal(await AffiliateCommission.countDocuments({}), 2, "Repeat purchases never award");
  await AffiliateConfig.updateOne({ key: "global" }, { $set: { rates: [5000] } });
  rows = await AffiliateCommission.find({ purchaseId: purchase._id }).sort({ level: 1 }).lean();
  assert.deepEqual(rows.map(row => row.rateBps), [1250, 250], "Existing rates remain immutable");
  const fixedBuyer = await makeUser("fixed");
  await AffiliateAccount.create({ userId: fixedBuyer._id, sponsorId: direct._id, code: "f".repeat(24), isDemo: false });
  await AffiliateConfig.updateOne({ key: "global" }, { $set: { rewardType: "fixed", fixedRewardsMinor: [500, 100], fixedCurrency: "USD" } });
  const fixedPurchase = await makePurchase(fixedBuyer._id, "fixed-first");
  await mongoose.connection.transaction(session => creditFirstPurchase(fixedPurchase, session));
  const fixedRows = await AffiliateCommission.find({ purchaseId: fixedPurchase._id }).sort({ level: 1 }).lean();
  assert.deepEqual(fixedRows.map(row => row.amountMinor), [500, 100]);
  assert.ok(fixedRows.every(row => row.currency === "USD" && row.saleCurrency === "NGN" && row.rewardType === "fixed"));
  const disabledBuyer = await makeUser("disabled");
  await AffiliateAccount.create({ userId: disabledBuyer._id, sponsorId: direct._id, code: "d".repeat(24), isDemo: false });
  await AffiliateConfig.updateOne({ key: "global" }, { $set: { enabled: false } });
  const disabledPurchase = await makePurchase(disabledBuyer._id, "disabled-first");
  await mongoose.connection.transaction(session => creditFirstPurchase(disabledPurchase, session));
  await AffiliateConfig.updateOne({ key: "global" }, { $set: { enabled: true } });
  const disabledRefill = await makePurchase(disabledBuyer._id, "disabled-second", "topup");
  await mongoose.connection.transaction(session => creditFirstPurchase(disabledRefill, session));
  assert.equal(await AffiliateCommission.countDocuments({}), 4, "Enabling later must not reward a refill");
  const rollbackBuyer = await makeUser("rollback");
  await AffiliateAccount.create({ userId: rollbackBuyer._id, sponsorId: direct._id, code: "e".repeat(24), isDemo: false });
  const rollbackPurchase = await makePurchase(rollbackBuyer._id, "rollback");
  await assert.rejects(mongoose.connection.transaction(async session => { await creditFirstPurchase(rollbackPurchase, session); throw new Error("Intentional rollback"); }));
  assert.equal(await AffiliateConversion.countDocuments({ buyerId: rollbackBuyer._id }), 0);
  assert.equal(await AffiliateCommission.countDocuments({}), 4);
  console.log("PASS: activation-only percentage/fixed rewards, idempotency, disabled-program behavior, immutable snapshots, and rollback.");
} finally {
  if (mongoose.connection.name !== database || !/^enrivea_affiliate_test_\d+$/.test(database)) throw new Error("Unexpected test database; refusing cleanup");
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
