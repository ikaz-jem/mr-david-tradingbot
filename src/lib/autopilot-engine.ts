import "server-only";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getPlatformConfig } from "@/lib/platform-config";
import { getProductCatalog } from "@/lib/product-catalog";
import { regulatedAccess } from "@/lib/jurisdiction-policy";
import { autopilotDecision } from "@/lib/autopilot-policy";
import { calculateTradeMetrics } from "@/lib/trade-math";
import { validateOpportunityNow } from "@/lib/approval-engine";
import { executeApprovalOnExchange } from "@/lib/approval-execution";
import { writeSecurityAudit } from "@/lib/access-control";
import { notifyUser } from "@/lib/notifications";
import { PLATFORM_CREDIT_ID } from "@/lib/credits";
import { AutopilotProfile } from "@/models/AutopilotProfile";
import { AutopilotExecution } from "@/models/AutopilotExecution";
import { AutopilotJob } from "@/models/AutopilotJob";
import { ApprovalUnlock } from "@/models/ApprovalUnlock";
import { CreditEntry } from "@/models/CreditEntry";
import { ExchangeConnection } from "@/models/ExchangeConnection";
import { Order } from "@/models/Order";
import { SharedOpportunity } from "@/models/SharedOpportunity";
import { User } from "@/models/User";

const JOB_KEY = "autopilot:live";
const openStatuses: Array<"submitting" | "submitted" | "filled" | "partial" | "protection_failed"> = ["submitting", "submitted", "filled", "partial", "protection_failed"];

async function setDecision(profileId: mongoose.Types.ObjectId, message: string) {
  await AutopilotProfile.updateOne({ _id: profileId }, { $set: { lastEvaluatedAt: new Date(), lastDecision: message.slice(0, 240) } });
}

async function evaluateProfile(profile: mongoose.HydratedDocument<import("@/models/AutopilotProfile").AutopilotProfileRecord>, runId: string, product: { enabled: boolean; cost: number }) {
  const user = await User.findOne({ _id: profile.userId, status: "active", isDemo: false }).select("_id organizationId countryCode activatedAt creditBalance").lean();
  if (!user) { await setDecision(profile._id, "Account is unavailable."); return "blocked"; }
  const jurisdiction = regulatedAccess({ isDemo: false, countryCode: user.countryCode, action: "exchange_execution" });
  const connection = await ExchangeConnection.findOne({ userId: user._id, provider: profile.provider, market: "futures", environment: "live", status: "connected", access: "futures_trade" }).select("_id").lean();
  if (profile.provider !== "binance") { await setDecision(profile._id, "Futures tracking for this exchange is not certified."); return "blocked"; }
  const now = new Date();
  const unsafeOrder = connection ? await Order.findOne({ userId: user._id, connectionId: connection._id, market: "futures", $or: [{ trackingStatus: { $in: ["pending", "stale", "unsupported", "attribution_uncertain"] } }, { trackingStatus: "current", lastTrackedAt: { $lt: new Date(now.getTime() - 180_000) } }] }).select("_id").lean() : null;
  if (unsafeOrder) { await setDecision(profile._id, "Exchange tracking is unresolved or stale. New entries are paused."); return "blocked"; }
  const unsettledClose = await AutopilotExecution.exists({ userId: user._id, closedAt: { $gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) }, pnlUsdt: null });
  if (unsettledClose) { await setDecision(profile._id, "A closed position has incomplete P&L. New entries are paused."); return "blocked"; }
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const [dailyTrades, openPositions, lossRows] = await Promise.all([
    AutopilotExecution.countDocuments({ userId: user._id, createdAt: { $gte: dayStart }, status: { $ne: "blocked" } }),
    AutopilotExecution.countDocuments({ userId: user._id, status: { $in: openStatuses } }),
    AutopilotExecution.aggregate<{ loss: number }>([{ $match: { userId: user._id, closedAt: { $gte: dayStart }, pnlUsdt: { $lt: 0 } } }, { $group: { _id: null, loss: { $sum: { $abs: "$pnlUsdt" } } } }]),
  ]);
  const candidates = await SharedOpportunity.find({ scope: "live", status: "active", expiresAt: { $gt: now }, symbol: { $in: profile.allowedSymbols }, interval: { $in: profile.allowedIntervals }, $or: [{ strategySlug: profile.strategySlug }, { requestedStrategySlug: profile.strategySlug }] }).sort({ confidence: -1, createdAt: -1 }).limit(20).lean();
  const consumed = new Set<string>();
  if (candidates.length) {
    const opportunityIds = candidates.map(item => item._id);
    const [automated, manuallyHandled] = await Promise.all([
      AutopilotExecution.find({ userId: user._id, opportunityId: { $in: opportunityIds } }).select("opportunityId").lean(),
      ApprovalUnlock.find({ userId: user._id, opportunityId: { $in: opportunityIds } }).select("opportunityId").lean(),
    ]);
    for (const item of [...automated, ...manuallyHandled]) consumed.add(String(item.opportunityId));
  }
  const opportunity = candidates.find(item => !consumed.has(String(item._id)));
  if (!opportunity) { await setDecision(profile._id, "No new matching shared opportunity."); return "blocked"; }
  if (connection && await Order.exists({ userId: user._id, connectionId: connection._id, positionGuardKey: String(connection._id) + ":" + opportunity.symbol })) { await setDecision(profile._id, "This market already has a platform position or protective order."); return "blocked"; }
  const metrics = calculateTradeMetrics(opportunity.side, opportunity.entry, opportunity.stop, opportunity.target, profile.maxPositionUsd);
  const controls = await getPlatformConfig(false);
  const policy = autopilotDecision({ operationsOpen: !controls.maintenanceMode && controls.autopilotOpen && controls.exchangeConnectionsOpen, productEnabled: product.enabled, certified: process.env.EXCHANGE_EXECUTION_CERTIFIED === "true", accountActive: Boolean(user.activatedAt), countryAllowed: jurisdiction.allowed, connected: Boolean(connection), credits: user.creditBalance, creditCost: product.cost, dailyTrades, maxDailyTrades: profile.maxDailyTrades, openPositions, maxOpenPositions: profile.maxOpenPositions, dailyRealizedLossUsd: lossRows[0]?.loss ?? 0, dailyLossLimitUsd: profile.maxPositionUsd * profile.maxDailyTrades * profile.dailyLossLimitPct / 100, confidence: opportunity.confidence, minConfidence: profile.minConfidence, riskReward: metrics.riskReward, minRiskReward: profile.minRiskReward });
  if (!policy.allowed) { await setDecision(profile._id, `Blocked: ${policy.code.toLowerCase().replaceAll("_", " ")}.`); return "blocked"; }
  const validity = await validateOpportunityNow(opportunity);
  if (!validity.valid) { await setDecision(profile._id, validity.reason ?? "The opportunity is no longer valid."); return "blocked"; }

  const unlockId = new mongoose.Types.ObjectId();
  const executionId = new mongoose.Types.ObjectId();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const debited = await User.findOneAndUpdate({ _id: user._id, status: "active", activatedAt: { $ne: null }, creditBalance: { $gte: product.cost } }, { $inc: { creditBalance: -product.cost } }, { session, new: true });
      if (!debited) throw new Error("INSUFFICIENT_CREDITS");
      await CreditEntry.create([{ userId: user._id, productId: PLATFORM_CREDIT_ID, amount: -product.cost, kind: "capture", sourceKey: `autopilot:${user._id}:${opportunity._id}`, note: `${opportunity.symbol} guarded Autopilot cycle` }], { session });
      await ApprovalUnlock.create([{ _id: unlockId, userId: user._id, opportunityId: opportunity._id, status: "unlocked", creditCost: product.cost, amountUsdt: profile.maxPositionUsd, unlockedAt: new Date() }], { session });
      await AutopilotExecution.create([{ _id: executionId, userId: user._id, organizationId: profile.organizationId, profileId: profile._id, opportunityId: opportunity._id, approvalUnlockId: unlockId, runId, provider: profile.provider, market: "futures", symbol: opportunity.symbol, interval: opportunity.interval, side: opportunity.side, strategySlug: opportunity.strategySlug, status: "submitting", reason: "Risk gates passed; submitting one protected Futures position.", creditCost: product.cost, amountUsdt: profile.maxPositionUsd, leverage: profile.leverage, entryPrice: validity.markPrice ?? opportunity.entry, stopPrice: opportunity.stop, targetPrice: opportunity.target }], { session });
    });
  } finally { await session.endSession(); }

  try {
    const result = await executeApprovalOnExchange({ source: "autopilot", provider: profile.provider, market: "futures", userId: String(user._id), approvalUnlockId: String(unlockId), opportunityId: String(opportunity._id), symbol: opportunity.symbol, side: opportunity.side, amountUsdt: profile.maxPositionUsd, referencePrice: validity.markPrice ?? opportunity.entry, stopPrice: opportunity.stop, targetPrice: opportunity.target, futuresConfig: { leverage: profile.leverage, marginMode: profile.marginMode, positionMode: "one_way", triggerPriceType: profile.triggerPriceType } });
    const order = await Order.findOne({ activeKey: `autopilot:${unlockId}` }).select("_id").lean();
    const status = result.state === "protection_failed" ? "protection_failed" : result.state === "filled" ? "filled" : result.state === "partial" ? "partial" : "submitted";
    await AutopilotExecution.updateOne({ _id: executionId }, { $set: { status, orderId: order?._id ?? null, exchangeOrderId: result.orderId, protectionStatus: result.protectionStatus ?? "pending", openedAt: new Date(), reason: `Exchange accepted the automated ${profile.leverage}x Futures position.` } });
    if (status === "protection_failed") await AutopilotProfile.updateOne({ _id: profile._id }, { $set: { status: "emergency_stopped", emergencyStoppedAt: new Date(), lastDecision: "Emergency stop: exchange protection orders are incomplete." }, $inc: { revision: 1 } });
    else await setDecision(profile._id, `${opportunity.symbol} position accepted by ${profile.provider}.`);
    await writeSecurityAudit({ actor: { id: String(user._id), organizationId: String(profile.organizationId) }, action: "autopilot.order.execute", resource: "orders", targetType: "AutopilotExecution", targetId: String(executionId), newValue: { provider: profile.provider, symbol: opportunity.symbol, side: opportunity.side, amountUsdt: profile.maxPositionUsd, leverage: profile.leverage, orderId: result.orderId, protectionStatus: result.protectionStatus }, outcome: "success", reason: "Certified worker passed stored user risk policy" }).catch(() => undefined);
    return "accepted";
  } catch (error) {
    const order = await Order.findOne({ activeKey: `autopilot:${unlockId}` }).select("_id status protectionStatus exchangeOrderId").lean();
    const uncertain = Boolean(order && ["intent", "unknown", "submitted", "partial", "protection_failed"].includes(order.status));
    await AutopilotExecution.updateOne({ _id: executionId }, { $set: { orderId: order?._id ?? null, exchangeOrderId: order?.exchangeOrderId ?? null, status: order?.status === "protection_failed" ? "protection_failed" : uncertain ? "submitted" : "rejected", protectionStatus: order?.protectionStatus === "failed" ? "failed" : "pending", reason: error instanceof Error ? error.message.slice(0, 300) : "Execution failed" } });
    if (uncertain) await AutopilotProfile.updateOne({ _id: profile._id }, { $set: { status: "emergency_stopped", emergencyStoppedAt: new Date(), lastDecision: "Emergency stop: an order needs reconciliation." }, $inc: { revision: 1 } });
    await notifyUser({ userId: String(user._id), kind: "exchange", title: "Autopilot needs attention", body: uncertain ? "An automated order or its protection needs immediate exchange review. Autopilot was stopped." : "The automated order was rejected. Review the execution history.", href: "/dashboard/autopilot", sourceKey: `autopilot-failed:${executionId}` }).catch(() => undefined);
    await writeSecurityAudit({ actor: { id: String(user._id), organizationId: String(profile.organizationId) }, action: "autopilot.order.execute", resource: "orders", targetType: "AutopilotExecution", targetId: String(executionId), outcome: "failed", reason: error instanceof Error ? error.message : "Execution failed", metadata: { uncertain } }).catch(() => undefined);
    return uncertain ? "attention" : "rejected";
  }
}

export async function runAutopilotWorker() {
  await connectDB();
  const runId = randomUUID(); const now = new Date(); const leaseUntil = new Date(now.getTime() + 4 * 60_000);
  await AutopilotJob.updateOne({ key: JOB_KEY }, { $setOnInsert: { key: JOB_KEY, status: "idle", leaseUntil: new Date(0) } }, { upsert: true }).catch(error => { if (!(error instanceof Error) || !error.message.includes("E11000")) throw error; });
  const job = await AutopilotJob.findOneAndUpdate({ key: JOB_KEY, $or: [{ status: { $ne: "running" } }, { leaseUntil: { $lte: now } }] }, { $set: { status: "running", leaseUntil, runId, startedAt: now, lastError: "" } }, { new: true });
  if (!job || job.runId !== runId) return { skipped: true, reason: "Worker lease is already held." };
  let evaluated = 0, attempted = 0, accepted = 0, blocked = 0;
  try {
    const [product, profiles] = await Promise.all([getProductCatalog(false).then(items => items.find(item => item.slug === "autopilot")), AutopilotProfile.find({ status: "running" }).sort({ lastEvaluatedAt: 1, updatedAt: 1 }).limit(100)]);
    if (!product) throw new Error("Autopilot product is not configured");
    for (const profile of profiles) {
      evaluated += 1;
      const result = await evaluateProfile(profile, runId, product).catch(async error => { await setDecision(profile._id, error instanceof Error ? error.message : "Evaluation failed"); return "blocked"; });
      if (result === "accepted" || result === "attention" || result === "rejected") attempted += 1;
      if (result === "accepted") accepted += 1; else blocked += 1;
    }
    await AutopilotJob.updateOne({ key: JOB_KEY, runId }, { $set: { status: "completed", leaseUntil: new Date(0), profilesEvaluated: evaluated, ordersAttempted: attempted, ordersAccepted: accepted, blocked, completedAt: new Date() } });
    return { skipped: false, profilesEvaluated: evaluated, ordersAttempted: attempted, ordersAccepted: accepted, blocked };
  } catch (error) {
    await AutopilotJob.updateOne({ key: JOB_KEY, runId }, { $set: { status: "failed", leaseUntil: new Date(0), lastError: error instanceof Error ? error.message.slice(0, 300) : "Worker failed", completedAt: new Date() } });
    throw error;
  }
}
