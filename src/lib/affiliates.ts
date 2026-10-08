import { randomBytes } from "node:crypto";
import mongoose, { type ClientSession } from "mongoose";
import { AffiliateAccount, AffiliateCommission, AffiliateConfig, AffiliateConversion } from "@/models/Affiliate";
import { BillingPurchase } from "@/models/BillingPurchase";
import { User } from "@/models/User";
import { commissionMinor } from "@/lib/affiliate-policy";

export async function affiliateConfig(isDemo: boolean, session?: ClientSession) {
  const config = await AffiliateConfig.findOne({ key: isDemo ? "demo" : "global" }).session(session ?? null).lean();
  return { enabled: config?.enabled ?? true, rates: config?.rates ?? [1000], cookieDays: config?.cookieDays ?? 30, holdDays: config?.holdDays ?? 14 };
}

export async function ensureAffiliateAccount(userId: string, isDemo: boolean) {
  await AffiliateAccount.init();
  return AffiliateAccount.findOneAndUpdate({ userId }, { $setOnInsert: { userId, isDemo, code: randomBytes(12).toString("hex") } }, { upsert: true, returnDocument: "after" });
}

export async function initializeAffiliateLedger() {
  await Promise.all([AffiliateAccount.init(), AffiliateCommission.init(), AffiliateConversion.init(), AffiliateConfig.init()]);
}

// Called inside the verified payment transaction: purchase, credits, and commission commit together.
export async function creditFirstPurchase(purchase: { _id: mongoose.Types.ObjectId; userId: mongoose.Types.ObjectId; expectedAmount: number; currency: string }, session: ClientSession) {
  const buyer = await User.findById(purchase.userId).select("isDemo").session(session).lean();
  if (!buyer || buyer.isDemo) return;
  if (await AffiliateConversion.exists({ buyerId: purchase.userId }).session(session)) return;
  // Existing paying accounts cannot qualify on a later refill after this feature is deployed.
  if (await BillingPurchase.exists({ userId: purchase.userId, status: "paid", _id: { $ne: purchase._id } }).session(session)) return;
  const config = await affiliateConfig(false, session);
  await AffiliateConversion.create([{ buyerId: purchase.userId, purchaseId: purchase._id, isDemo: false, amountMinor: purchase.expectedAmount, currency: purchase.currency, rates: config.enabled ? config.rates : [] }], { session });
  if (!config.enabled) return;
  let account = await AffiliateAccount.findOne({ userId: purchase.userId, isDemo: false }).session(session).lean();
  const seen = new Set([String(purchase.userId)]);
  for (let index = 0; index < config.rates.length && account?.sponsorId; index++) {
    const beneficiaryId = account.sponsorId;
    if (seen.has(String(beneficiaryId))) break;
    seen.add(String(beneficiaryId));
    const eligible = await User.exists({ _id: beneficiaryId, status: "active", isDemo: false }).session(session);
    const amountMinor = commissionMinor(purchase.expectedAmount, config.rates[index]);
    if (eligible && amountMinor > 0) await AffiliateCommission.create([{ beneficiaryId, buyerId: purchase.userId, purchaseId: purchase._id, isDemo: false, level: index + 1, rateBps: config.rates[index], saleMinor: purchase.expectedAmount, amountMinor, currency: purchase.currency, availableAt: new Date(Date.now() + config.holdDays * 86400000) }], { session });
    account = await AffiliateAccount.findOne({ userId: beneficiaryId, isDemo: false }).session(session).lean();
  }
}

export async function referralSponsor(code: string | undefined) {
  if (!code || !/^[a-f0-9]{24}$/.test(code)) return null;
  const config = await affiliateConfig(false);
  if (!config.enabled) return null;
  const account = await AffiliateAccount.findOne({ code, isDemo: false }).lean();
  if (!account || !await User.exists({ _id: account.userId, isDemo: false, status: "active" })) return null;
  return account.userId;
}

export async function affiliateReport(userId: string, isDemo: boolean, admin: boolean, page = 1) {
  const scope = admin ? { isDemo } : { isDemo, beneficiaryId: new mongoose.Types.ObjectId(userId) };
  const referralScope = admin ? { isDemo } : { isDemo, sponsorId: new mongoose.Types.ObjectId(userId) };
  const [config, account, rows, total, balances, referrals, referralCount] = await Promise.all([
    affiliateConfig(isDemo), ensureAffiliateAccount(userId, isDemo),
    AffiliateCommission.find(scope).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 25).limit(25).lean(),
    AffiliateCommission.countDocuments(scope),
    AffiliateCommission.aggregate([{ $match: scope }, { $group: { _id: { currency: "$currency", status: { $cond: [{ $and: [{ $eq: ["$status", "earned"] }, { $gt: ["$availableAt", new Date()] }] }, "pending", { $cond: [{ $eq: ["$status", "earned"] }, "available", "$status"] }] } }, amountMinor: { $sum: "$amountMinor" }, count: { $sum: 1 } } }]),
    AffiliateAccount.find({ ...referralScope, sponsorId: { ...(admin ? { $ne: null } : { $eq: new mongoose.Types.ObjectId(userId) }) } }).sort({ createdAt: -1 }).skip((page - 1) * 25).limit(25).lean(),
    AffiliateAccount.countDocuments({ ...referralScope, sponsorId: admin ? { $ne: null } : new mongoose.Types.ObjectId(userId) }),
  ]);
  const ids = [...rows.flatMap(row => [row.beneficiaryId, row.buyerId]), ...referrals.flatMap(row => row.sponsorId ? [row.userId, row.sponsorId] : [row.userId])];
  const users = await User.find({ _id: { $in: ids }, isDemo }).select("name email").lean();
  const names = new Map(users.map(user => [String(user._id), admin ? `${user.name} (${user.email})` : user.name]));
  const converted = await AffiliateConversion.find({ buyerId: { $in: referrals.map(row => row.userId) }, isDemo }).select("buyerId").lean();
  return {
    config, code: account!.code, page, total, referralCount, balances,
    rows: rows.map(row => ({
      id: String(row._id), beneficiary: admin ? names.get(String(row.beneficiaryId)) ?? "Account" : "You",
      buyer: admin ? names.get(String(row.buyerId)) ?? "Account" : `Referral ${String(row.buyerId).slice(-6)}`,
      level: row.level, rateBps: row.rateBps, amountMinor: row.amountMinor, saleMinor: row.saleMinor, currency: row.currency,
      status: row.status === "earned" ? row.availableAt > new Date() ? "pending" : "available" : row.status,
      createdAt: row.createdAt.toISOString(), availableAt: row.availableAt.toISOString(), payoutReference: row.payoutReference, reason: row.reason,
    })),
    referrals: referrals.map(row => ({
      id: String(row._id), name: admin ? `${names.get(String(row.userId)) ?? "Account"} · referred by ${names.get(String(row.sponsorId)) ?? "Account"}` : `Referral ${String(row.userId).slice(-6)}`,
      createdAt: row.createdAt.toISOString(), converted: converted.some(item => String(item.buyerId) === String(row.userId)),
    })),
  };
}
