import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import mongoose from "mongoose";
import { hash } from "bcryptjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
  if (specifier === "next/server") return nextResolve("next/server.js", context);
  if (specifier.startsWith("@/")) return nextResolve(pathToFileURL(path.join(root, "src", `${specifier.slice(2)}.ts`)).href, context);
  return nextResolve(specifier, context);
} });
const database = `enrivea_release_test_${Date.now()}`;
await mongoose.connect(process.env.MONGODB_URI, { dbName: database, serverSelectionTimeoutMS: 15000 });
const realFetch = globalThis.fetch;
try {
  // No real provider calls are permitted, even when the launching environment
  // contains production credentials. All writes use this disposable database.
  process.env.RESEND_API_KEY = "re_isolated_test_only";
  process.env.RESEND_FROM_EMAIL = "Enrivea <test@example.invalid>";
  process.env.APP_URL = "https://release.example.invalid";
  let emailFails = true, emailRequests = 0, lastEmail = null;
  let paymentResult = null;
  globalThis.fetch = async (url, options) => {
    if (String(url) === "https://api.resend.com/emails") {
      emailRequests++; lastEmail = JSON.parse(options.body);
      return emailFails ? Response.json({ name: "application_error", message: "Injected outage" }, { status: 500 }) : Response.json({ id: "isolated-email-id" });
    }
    if (String(url).startsWith("https://api.paystack.co/transaction/verify/")) return Response.json({ status: true, data: paymentResult });
    throw new Error("Unexpected external request blocked");
  };
  const { User } = await import("../src/models/User.ts");
  const { EmailToken } = await import("../src/models/EmailToken.ts");
  const { BillingPurchase } = await import("../src/models/BillingPurchase.ts");
  const { PaymentGateway } = await import("../src/models/PaymentGateway.ts");
  const { AccountDelivery } = await import("../src/models/AccountDelivery.ts");
  const { ScheduledJob } = await import("../src/models/ScheduledJob.ts");
  const { CreditEntry } = await import("../src/models/CreditEntry.ts");
  const { Order } = await import("../src/models/Order.ts");
  const { AutopilotExecution } = await import("../src/models/AutopilotExecution.ts");
  const { AutopilotProfile } = await import("../src/models/AutopilotProfile.ts");
  const { ExchangeConnection } = await import("../src/models/ExchangeConnection.ts");
  const { UserSession } = await import("../src/models/UserSession.ts");
  const { AuthorizationAuditLog } = await import("../src/models/AuthorizationAuditLog.ts");
  const { Notification } = await import("../src/models/Notification.ts");
  const { encryptServiceSecret } = await import("../src/lib/service-config.ts");
  const { fulfillPayment } = await import("../src/lib/payment-fulfillment.ts");
  const { runBillingReconciliation } = await import("../src/lib/billing-reconciliation.ts");
  const { deliverAccountEvents } = await import("../src/lib/account-delivery.ts");
  const { requestEmailChange, completeEmailChange } = await import("../src/lib/email-change.ts");
  const { consumeAuthToken } = await import("../src/lib/auth-token-consumption.ts");
  const { hashEmailToken } = await import("../src/lib/email-tokens.ts");
  const { closeOwnedAccount } = await import("../src/lib/account-closure.ts");
  const { runScheduledJob } = await import("../src/lib/scheduled-job.ts");
  await Promise.all([User, EmailToken, BillingPurchase, PaymentGateway, AccountDelivery, ScheduledJob, CreditEntry, Order, AutopilotExecution, AutopilotProfile, ExchangeConnection, UserSession, AuthorizationAuditLog, Notification].map(model => model.init()));

  const user = await User.create({ name: "Release fixture", email: "fixture@example.invalid", passwordHash: await hash("TestOnlyPassword123!", 4), emailVerifiedAt: new Date(), settings: { emailBilling: true } });
  const gateway = await PaymentGateway.create({ provider: "paystack", isDemo: false, enabled: true, mode: "live", currency: "NGN", ratePerUsd: 1500, apiKeyEncrypted: encryptServiceSecret("sk_live_mock_only", "paymentApiKey"), createdBy: user._id });
  const reference = `enrivea-${"c".repeat(32)}`;
  await BillingPurchase.create({ userId: user._id, reference, provider: "paystack", gatewayId: gateway._id, mode: "live", kind: "activation", itemId: "account_activation", credits: 100, expectedAmount: 3000, currency: "NGN", status: "pending" });
  const settled = await Promise.all([fulfillPayment(reference, "1"), fulfillPayment(reference, "1")]);
  assert.ok(settled.includes("paid"));
  assert.equal((await User.findById(user._id)).creditBalance, 100);
  assert.equal(await CreditEntry.countDocuments({ userId: user._id }), 1);
  assert.equal(await AccountDelivery.countDocuments({ sourceKey: `payment:${reference}` }), 1);
  assert.equal((await AccountDelivery.findOne({ sourceKey: `payment:${reference}` })).status, "pending", "Receipt outage must not undo payment or lose receipt");
  emailFails = false;
  await AccountDelivery.updateOne({ sourceKey: `payment:${reference}` }, { $set: { nextAttemptAt: new Date(0) } });
  await deliverAccountEvents();
  assert.equal((await AccountDelivery.findOne()).status, "delivered");
  assert.equal(await Notification.countDocuments({ sourceKey: `payment:${reference}` }), 1);
  const sent = emailRequests;
  await deliverAccountEvents();
  assert.equal(emailRequests, sent, "Delivered receipt must not be sent again");

  const refill = `enrivea-${"d".repeat(32)}`;
  await BillingPurchase.create({ userId: user._id, reference: refill, provider: "paystack", gatewayId: gateway._id, mode: "live", kind: "topup", itemId: "credits_25", credits: 25, expectedAmount: 2000, currency: "NGN", status: "pending", createdAt: new Date(Date.now() - 120000) });
  paymentResult = { id: 2, reference: refill, domain: "live", status: "success", amount: 2000, currency: "NGN", customer: { email: user.email } };
  await runBillingReconciliation();
  assert.equal((await User.findById(user._id)).creditBalance, 125, "Worker recovers payment without browser or webhook");
  await runBillingReconciliation();
  assert.equal(await CreditEntry.countDocuments({ userId: user._id }), 2);

  const request = new Request("https://release.example.invalid/api/account/email");
  await assert.rejects(() => requestEmailChange(String(user._id), "new@example.invalid", "wrong", request));
  await requestEmailChange(String(user._id), "new@example.invalid", "TestOnlyPassword123!", request);
  const match = lastEmail.text.match(/https:\/\/[^\s]+/);
  const token = new URL(match[0]).searchParams.get("token");
  assert.equal((await User.findById(user._id)).email, user.email, "Request alone must not change email");
  const changes = await Promise.allSettled([completeEmailChange(token), completeEmailChange(token)]);
  assert.equal(changes.filter(item => item.status === "fulfilled").length, 1, "Token must be single use under concurrency");
  assert.equal((await User.findById(user._id)).email, "new@example.invalid");
  assert.equal((await User.findById(user._id)).authVersion, 1, "Email change invalidates old sessions");
  await EmailToken.create({ userId: user._id, kind: "email_change", tokenHash: hashEmailToken("expired"), newEmail: "evil@example.invalid", oldEmail: "new@example.invalid", authVersion: 0, expiresAt: new Date(Date.now() + 60000) });
  await assert.rejects(() => completeEmailChange("expired"));

  const suspended = await User.create({ name: "Suspended staff", email: "suspended@example.invalid", passwordHash: "fixture", status: "suspended" });
  await EmailToken.create({ userId: suspended._id, kind: "invite", tokenHash: hashEmailToken("invite"), expiresAt: new Date(Date.now() + 60000) });
  assert.equal(await consumeAuthToken(hashEmailToken("invite"), "reset", "new-hash"), null);
  assert.equal((await User.findById(suspended._id)).status, "suspended", "Old staff invite cannot reactivate suspended staff");
  await EmailToken.create({ userId: user._id, kind: "reset", tokenHash: hashEmailToken("reset"), expiresAt: new Date(Date.now() + 60000) });
  const resets = await Promise.all([consumeAuthToken(hashEmailToken("reset"), "reset", "fixture-hash"), consumeAuthToken(hashEmailToken("reset"), "reset", "fixture-hash")]);
  assert.equal(resets.filter(Boolean).length, 1);

  await Order.create({ userId: user._id, exchange: "binance_futures", market: "futures", clientOrderId: "fixture-order", symbol: "BTCUSDT", side: "BUY", status: "filled", trackingStatus: "current", positionGuardKey: "fixture-position" });
  const current = await User.findById(user._id);
  await assert.rejects(() => closeOwnedAccount(String(user._id), current.authVersion, request), /open trades/);
  assert.equal((await User.findById(user._id)).status, "active", "Blocked closure rolls back account status");
  await Order.deleteOne({ clientOrderId: "fixture-order" });
  await closeOwnedAccount(String(user._id), current.authVersion, request);
  assert.equal((await User.findById(user._id)).status, "closed");
  await assert.rejects(() => closeOwnedAccount(String(user._id), current.authVersion, request));

  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const first = runScheduledJob("billing-reconciliation", async () => { await gate; return { completed: true }; });
  while (!await ScheduledJob.exists({ key: "billing-reconciliation", status: "running" })) await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal((await runScheduledJob("billing-reconciliation", async () => { throw new Error("Must not run concurrently"); })).skipped, true);
  release(); await first;
  await assert.rejects(() => runScheduledJob("billing-reconciliation", async () => { throw new Error("Injected failure"); }));
  assert.equal((await ScheduledJob.findOne({ key: "billing-reconciliation" })).status, "failed");
  await runScheduledJob("billing-reconciliation", async () => ({ recovered: true }));
  assert.equal((await ScheduledJob.findOne({ key: "billing-reconciliation" })).failures, 0);
  let recoveryRuns = 0;
  const recover = () => runScheduledJob("billing-reconciliation", async () => { recoveryRuns++; return { recovered: true }; }, true);
  assert.equal((await recover()).skipped, true, "Healthy jobs cannot be recovered");
  await ScheduledJob.updateOne({ key: "billing-reconciliation" }, { $set: { lastSucceededAt: new Date(0), lastStartedAt: new Date(0) } });
  await Promise.all([recover(), recover(), recover()]);
  assert.equal(recoveryRuns, 1, "Concurrent recovery requests must claim once");
  assert.equal((await runScheduledJob("billing-reconciliation", async () => { throw new Error("Primary must not repeat backup"); })).skipped, true);
  assert.equal(await AuthorizationAuditLog.countDocuments({ action: "scheduler:recover" }), 1);
  await ScheduledJob.updateOne({ key: "billing-reconciliation" }, { $set: { lastSucceededAt: new Date(0), lastStartedAt: new Date(0), lastRecoveryAt: new Date(0) } });
  await assert.rejects(() => runScheduledJob("billing-reconciliation", async () => { throw new Error("Backup failure"); }, true));
  assert.equal((await recover()).skipped, true, "Failed recovery must respect cooldown");
  console.log("PASS: backup freshness, concurrent claim, primary cooldown, failure cooldown, and audit events.");
  console.log("PASS: isolated replica-set tests for concurrent payments, durable receipts, off-page recovery, verified email changes, token replay, suspended invitations, account closure guards and worker leases.");
} finally {
  globalThis.fetch = realFetch;
  if (mongoose.connection.name !== database || !/^enrivea_release_test_\d+$/.test(database)) throw new Error("Unexpected database; refusing cleanup");
  await mongoose.connection.dropDatabase(); await mongoose.disconnect();
}
