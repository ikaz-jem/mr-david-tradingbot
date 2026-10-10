import { createHash, randomBytes } from "node:crypto";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { hash } from "bcryptjs";
import mongoose from "mongoose";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(pathToFileURL(path.join(root, "src", `${specifier.slice(2)}.ts`)).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { User } = await import("../src/models/User.ts");
const { BillingPurchase } = await import("../src/models/BillingPurchase.ts");
const { CreditEntry } = await import("../src/models/CreditEntry.ts");
const { PlatformConfig } = await import("../src/models/PlatformConfig.ts");
const { AdminAuditEvent } = await import("../src/models/AdminAuditEvent.ts");
const {
  AffiliateAccount,
  AffiliateCommission,
  AffiliateConfig,
  AffiliateConversion,
  AffiliatePayoutProfile,
} = await import("../src/models/Affiliate.ts");
const { affiliateConfig, creditFirstPurchase } = await import("../src/lib/affiliates.ts");
const { activateAccount } = await import("../src/lib/credits.ts");

const ADMIN_EMAIL = "echchebabzakariae@gmail.com";
const AVAILABLE_SHOWCASE = process.argv.includes("--available");
const SHOWCASE_KEY = AVAILABLE_SHOWCASE ? "available" : "pending";
const PARTNER_EMAIL = AVAILABLE_SHOWCASE ? "affiliate-showcase.available.partner@enrivea.invalid" : "affiliate-showcase.partner@enrivea.invalid";
const CUSTOMER_EMAIL = AVAILABLE_SHOWCASE ? "affiliate-showcase.available.customer@enrivea.invalid" : "affiliate-showcase.customer@enrivea.invalid";
const REFERENCE = AVAILABLE_SHOWCASE ? "affiliate-showcase-live-v1-available-activation" : "affiliate-showcase-live-v1-activation";
const AUDIT_ACTION = AVAILABLE_SHOWCASE ? "affiliate_showcase_available_created" : "affiliate_showcase_created";

if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing.");

const codeFor = value => createHash("sha256").update(value).digest("hex").slice(0, 24);

await mongoose.connect(process.env.MONGODB_URI, {
  bufferCommands: false,
  serverSelectionTimeoutMS: 15_000,
});

try {
  const database = mongoose.connection.name;
  const host = mongoose.connection.host.toLowerCase();
  if (["admin", "config", "local", "test"].includes(database.toLowerCase())) {
    throw new Error(`Refusing to seed generic database ${database}.`);
  }
  if (["localhost", "127.0.0.1", "::1"].includes(host)) {
    throw new Error("Refusing to create a live-mode showcase on localhost.");
  }

  await Promise.all([
    User.init(),
    BillingPurchase.init(),
    CreditEntry.init(),
    PlatformConfig.init(),
    AdminAuditEvent.init(),
    AffiliateAccount.init(),
    AffiliateCommission.init(),
    AffiliateConfig.init(),
    AffiliateConversion.init(),
    AffiliatePayoutProfile.init(),
  ]);

  const admin = await User.findOne({ email: ADMIN_EMAIL }).select("name email role status isDemo").lean();
  if (!admin || admin.isDemo || admin.status !== "active" || admin.role !== "admin") {
    throw new Error(`A live, active administrator must exist at ${ADMIN_EMAIL}.`);
  }

  const config = await affiliateConfig(false);
  const directReward = config.rewardType === "fixed" ? config.fixedRewardsMinor[0] : config.rates[0];
  if (!config.enabled || !directReward || directReward <= 0) {
    throw new Error("The live affiliate program must be enabled with a positive direct reward before creating the showcase.");
  }

  const platform = await PlatformConfig.findOne({ key: "global" }).select("activationPriceMinor activationCredits").lean();
  const activationPriceMinor = platform?.activationPriceMinor ?? 2500;
  const activationCredits = platform?.activationCredits ?? 25;
  const passwordHash = await hash(randomBytes(48).toString("base64url"), 12);
  const now = new Date();

  const result = await mongoose.connection.transaction(async session => {
    const userDefaults = {
      passwordHash,
      role: "user",
      status: "active",
      countryCode: "NG",
      creditBalance: 0,
      emailVerifiedAt: now,
      authVersion: 0,
      isDemo: false,
      mustChangePassword: false,
    };

    const partner = await User.findOneAndUpdate(
      { email: PARTNER_EMAIL },
      { $setOnInsert: { ...userDefaults, name: `Affiliate Showcase ${AVAILABLE_SHOWCASE ? "Available " : ""}Partner` } },
      { upsert: true, returnDocument: "after", session, setDefaultsOnInsert: true },
    );
    const customer = await User.findOneAndUpdate(
      { email: CUSTOMER_EMAIL },
      { $setOnInsert: { ...userDefaults, name: `Affiliate Showcase ${AVAILABLE_SHOWCASE ? "Available " : ""}Customer` } },
      { upsert: true, returnDocument: "after", session, setDefaultsOnInsert: true },
    );

    if (!partner || !customer || partner.isDemo || customer.isDemo || partner.role !== "user" || customer.role !== "user") {
      throw new Error("Showcase identities conflict with an existing protected account.");
    }

    let partnerAccount = await AffiliateAccount.findOne({ userId: partner._id }).session(session);
    if (!partnerAccount) {
      [partnerAccount] = await AffiliateAccount.create([{
        userId: partner._id,
        code: codeFor(PARTNER_EMAIL),
        isDemo: false,
        sponsorId: null,
      }], { session });
    }
    if (partnerAccount.isDemo || partnerAccount.sponsorId) {
      throw new Error("The showcase partner already belongs to a different referral chain.");
    }

    let customerAccount = await AffiliateAccount.findOne({ userId: customer._id }).session(session);
    if (!customerAccount) {
      [customerAccount] = await AffiliateAccount.create([{
        userId: customer._id,
        code: codeFor(CUSTOMER_EMAIL),
        isDemo: false,
        sponsorId: partner._id,
      }], { session });
    }
    if (customerAccount.isDemo || String(customerAccount.sponsorId) !== String(partner._id)) {
      throw new Error("The showcase customer already belongs to a different referral chain.");
    }

    let purchase = await BillingPurchase.findOne({ reference: REFERENCE }).session(session);
    if (!purchase) {
      [purchase] = await BillingPurchase.create([{
        provider: "nowpayments",
        mode: "live",
        isDemo: false,
        userId: customer._id,
        productId: "platform",
        kind: "activation",
        itemId: "account_activation",
        credits: activationCredits,
        reference: REFERENCE,
        expectedAmount: activationPriceMinor,
        catalogAmountUsd: activationPriceMinor,
        currency: "USD",
        status: "paid",
        providerStatus: "showcase_verified",
        providerTransactionId: "SHOWCASE-NO-PROVIDER-TRANSFER",
        verifiedAt: now,
      }], { session });
    }
    if (
      String(purchase.userId) !== String(customer._id)
      || purchase.kind !== "activation"
      || purchase.itemId !== "account_activation"
      || purchase.status !== "paid"
      || purchase.mode !== "live"
      || purchase.isDemo
    ) {
      throw new Error("The showcase purchase reference conflicts with another purchase.");
    }

    if (!customer.activatedAt) {
      await activateAccount(customer._id, purchase.credits, REFERENCE, session);
    } else if (customer.activationReference !== REFERENCE) {
      throw new Error("The showcase customer was activated by a different purchase.");
    }

    await creditFirstPurchase(purchase, session);
    const conversion = await AffiliateConversion.findOne({ buyerId: customer._id }).session(session);
    const commission = await AffiliateCommission.findOne({
      purchaseId: purchase._id,
      beneficiaryId: partner._id,
      level: 1,
    }).session(session);
    if (!conversion || !commission) {
      throw new Error("Production referral processing did not create the expected conversion and direct commission.");
    }

    if (AVAILABLE_SHOWCASE && commission.availableAt > now) {
      const activationDate = new Date(now.getTime() - (config.holdDays + 1) * 86_400_000);
      const availableAt = new Date(activationDate.getTime() + config.holdDays * 86_400_000);
      await Promise.all([
        User.updateOne({ _id: customer._id, activationReference: REFERENCE }, { $set: { activatedAt: activationDate } }, { session }),
        BillingPurchase.updateOne({ _id: purchase._id }, { $set: { verifiedAt: activationDate, createdAt: activationDate } }, { session, timestamps: false }),
        AffiliateConversion.updateOne({ _id: conversion._id }, { $set: { createdAt: activationDate } }, { session, timestamps: false }),
        AffiliateCommission.updateOne({ _id: commission._id }, { $set: { createdAt: activationDate, availableAt } }, { session, timestamps: false }),
      ]);
      commission.createdAt = activationDate;
      commission.availableAt = availableAt;
    }

    await AdminAuditEvent.findOneAndUpdate(
      { actorId: admin._id, targetId: REFERENCE, action: AUDIT_ACTION },
      {
        $setOnInsert: {
          actorId: admin._id,
          targetUserId: customer._id,
          targetType: "user",
          targetId: REFERENCE,
          action: AUDIT_ACTION,
          before: "No affiliate showcase activation",
          after: JSON.stringify({
            partnerEmail: PARTNER_EMAIL,
            customerEmail: CUSTOMER_EMAIL,
            purchaseReference: REFERENCE,
            commissionId: String(commission._id),
          }),
          reason: `Administrator-requested, clearly labeled live-mode ${SHOWCASE_KEY} affiliate showcase; no provider funds were transferred`,
          status: "applied",
        },
      },
      { upsert: true, returnDocument: "after", session, setDefaultsOnInsert: true },
    );

    return {
      partnerId: String(partner._id),
      customerId: String(customer._id),
      purchaseId: String(purchase._id),
      conversionId: String(conversion._id),
      commissionId: String(commission._id),
    };
  });

  const [partner, customer, commission, referralCount, conversionCount] = await Promise.all([
    User.findById(result.partnerId).select("name email status isDemo").lean(),
    User.findById(result.customerId).select("name email status isDemo activatedAt activationReference creditBalance").lean(),
    AffiliateCommission.findById(result.commissionId).lean(),
    AffiliateAccount.countDocuments({ userId: result.customerId, sponsorId: result.partnerId, isDemo: false }),
    AffiliateConversion.countDocuments({ buyerId: result.customerId, isDemo: false }),
  ]);

  console.log(JSON.stringify({
    database,
    mode: "live",
    showcaseState: AVAILABLE_SHOWCASE ? "available" : "pending",
    providerTransferMade: false,
    idempotentReference: REFERENCE,
    adminViewer: admin.email,
    partner,
    activatedCustomer: customer,
    referralCount,
    conversionCount,
    commission: commission && {
      id: String(commission._id),
      level: commission.level,
      rewardType: commission.rewardType,
      rateBps: commission.rateBps,
      amountMinor: commission.amountMinor,
      currency: commission.currency,
      status: commission.status,
      availableAt: commission.availableAt,
    },
  }, null, 2));
} finally {
  await mongoose.disconnect();
}
