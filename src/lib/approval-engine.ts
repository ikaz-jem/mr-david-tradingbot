import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { getProductCatalog } from "@/lib/product-catalog";
import { getPlatformConfig } from "@/lib/platform-config";
import { getServiceConfig } from "@/lib/service-config";
import { getEnabledStrategies } from "@/lib/strategy-catalog";
import { getSharedClosedCandles, getSharedResearchDecision } from "@/lib/cached-research";
import { resolveStrategySelection } from "@/lib/strategy-selection";
import { intervalMilliseconds, scanIntervals, scanSymbols, type ScanInterval } from "@/lib/scan-markets";
import { calculateTradeMetrics } from "@/lib/trade-math";
import { buildApprovalScanPlan } from "@/lib/approval-scan-plan";
import { notifyUser } from "@/lib/notifications";
import { ApprovalPreference } from "@/models/ApprovalPreference";
import { ApprovalScanJob } from "@/models/ApprovalScanJob";
import { SharedOpportunity } from "@/models/SharedOpportunity";
import { User } from "@/models/User";
import { reconcileApprovalPositions } from "@/lib/approval-reconciliation";

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const opportunityLifetime = (interval: ScanInterval) => Math.max(15 * 60_000, Math.min(12 * 60 * 60_000, intervalMilliseconds[interval] * 3));

export async function ensureApprovalPreference(userId: string) {
  await connectDB();
  return ApprovalPreference.findOneAndUpdate({ userId }, { $setOnInsert: { userId } }, { upsert: true, returnDocument: "after" });
}

export async function expireApprovalOpportunities(scope: "live" | "demo") {
  await SharedOpportunity.updateMany({ scope, status: "active", expiresAt: { $lte: new Date() } }, { $set: { status: "expired", invalidationReason: "The approval window elapsed before the setup was unlocked." } });
}

export async function latestClosedPrice(symbol: string) {
  if (!scanSymbols.includes(symbol as (typeof scanSymbols)[number])) throw new Error("Unsupported market");
  const { candles } = await getSharedClosedCandles(symbol as (typeof scanSymbols)[number], "5m");
  return candles.at(-1)!.close;
}

export async function validateOpportunityNow(opportunity: { _id: Types.ObjectId; scope: "live" | "demo"; symbol: string; side: "BUY" | "SELL"; status: string; expiresAt: Date; invalidationPrice: number; target: number }) {
  if (opportunity.status !== "active" || opportunity.expiresAt <= new Date()) return { valid: false, reason: "This setup has expired." };
  if (opportunity.scope === "demo") return { valid: true, markPrice: undefined };
  const markPrice = await latestClosedPrice(opportunity.symbol);
  const invalid = opportunity.side === "BUY" ? markPrice <= opportunity.invalidationPrice || markPrice >= opportunity.target : markPrice >= opportunity.invalidationPrice || markPrice <= opportunity.target;
  if (invalid) {
    await SharedOpportunity.updateOne({ _id: opportunity._id, status: "active" }, { $set: { status: "invalidated", invalidationReason: `Market reached the stop or target before unlock.` } });
    return { valid: false, reason: "The market invalidated this setup before unlock.", markPrice };
  }
  return { valid: true, markPrice };
}

export async function seedDemoApprovalOpportunities() {
  await connectDB();
  const now = Date.now();
  const fixtures = [
    { symbol: "BTCUSDT", interval: "1h", side: "BUY", entry: 68420, stop: 67180, target: 70900, confidence: 84, strategySlug: "trend-breakout", strategyName: "Trend + Breakout", summary: "Bullish continuation candidate", thesis: "Price reclaimed the hourly range with aligned trend, expanding participation, and a defined breakout retest.", riskNote: "Invalidate if a completed hourly candle closes below the protected breakout range." },
    { symbol: "ETHUSDT", interval: "4h", side: "SELL", entry: 3460, stop: 3548, target: 3284, confidence: 78, strategySlug: "mean-reversion", strategyName: "Mean Reversion", summary: "Bearish exhaustion candidate", thesis: "Price extended above its volatility band while momentum weakened, creating a bounded return-to-mean candidate.", riskNote: "Spot accounts cannot execute a naked short; use this as research unless derivatives execution is available." },
    { symbol: "SOLUSDT", interval: "15m", side: "BUY", entry: 162.4, stop: 158.9, target: 169.4, confidence: 73, strategySlug: "momentum-continuation", strategyName: "Momentum Continuation", summary: "Intraday momentum candidate", thesis: "Short-term trend, momentum, and relative volume aligned after a controlled consolidation.", riskNote: "Short approval window; do not chase if price moves materially beyond the planned entry." },
  ] as const;
  for (const [index, item] of fixtures.entries()) {
    const fingerprint = `demo-approval-v2:${index}`;
    await SharedOpportunity.findOneAndUpdate({ scope: "demo", fingerprint }, { $set: { ...item, scope: "demo", fingerprint, requestedStrategySlug: "ai-router", strategyVersion: 1, status: "active", marketFacts: { simulated: true }, invalidationDirection: item.side === "BUY" ? "below" : "above", invalidationPrice: item.stop, invalidationInstruction: item.riskNote, modelVersion: "demo-fixture-v2", providerResponseId: "", dataCutoff: new Date(now - (index + 1) * 5 * 60_000), expiresAt: new Date(now + (index + 2) * 45 * 60_000), invalidationReason: "" } }, { upsert: true, returnDocument: "after" });
  }
}

export async function runApprovalDiscovery() {
  await connectDB();
  const runId = randomUUID();
  const key = "approval-discovery:live";
  await ApprovalScanJob.updateOne({ key }, { $setOnInsert: { key, status: "idle", leaseUntil: new Date(0) } }, { upsert: true });
  const lease = await ApprovalScanJob.findOneAndUpdate({ key, $or: [{ status: { $ne: "running" } }, { leaseUntil: { $lte: new Date() } }] }, { $set: { status: "running", runId, leaseUntil: new Date(Date.now() + 6 * 60_000), startedAt: new Date() } }, { returnDocument: "after" });
  if (!lease || lease.runId !== runId) return { alreadyRunning: true, combinations: 0, opportunitiesCreated: 0 };
  let combinations = 0;
  let opportunitiesCreated = 0;
  const outcomes: { symbol: string; interval: string; strategy: string; result: string }[] = [];
  const deadline = Date.now() + 220_000;
  try {
    await expireApprovalOpportunities("live");
    const [config, service, product, preferences, strategies] = await Promise.all([
      getPlatformConfig(false),
      getServiceConfig(false),
      getProductCatalog(false).then(items => items.find(item => item.slug === "approval-desk")),
      ApprovalPreference.find({ enabled: true }).lean(),
      getEnabledStrategies(false, "approval-desk"),
    ]);
    if (config.maintenanceMode) throw new Error(config.maintenanceMessage);
    if (!config.scansOpen) throw new Error(config.scansPausedMessage);
    if (!config.approvalDiscoveryOpen) throw new Error(config.approvalPausedMessage);
    if (!product?.enabled) throw new Error("Enable Approval Desk in Admin > Products before running discovery.");
    if (!service.openaiApiKey || !service.openaiModel) throw new Error("AI scanning is not configured");
    if (config.paperReconciliationOpen) await reconcileApprovalPositions();
    const previousCompletion = lease.lastError ? 0 : lease.completedAt?.getTime() ?? 0;
    if (previousCompletion && Date.now() - previousCompletion < config.approvalScanCadenceMinutes * 60_000) {
      await ApprovalScanJob.updateOne({ key, runId }, { $set: { status: "completed", leaseUntil: new Date(0), combinations: 0, opportunitiesCreated: 0, lastError: "" } });
      return { alreadyRunning: false, skippedByCadence: true, combinations: 0, opportunitiesCreated: 0 };
    }
    const activeUserIds = new Set((await User.find({ _id: { $in: preferences.map(item => item.userId) }, status: "active", activatedAt: { $ne: null }, isDemo: false }).select("_id").lean()).map(item => String(item._id)));
    const eligible = preferences.filter(item => activeUserIds.has(String(item.userId)));
    const approvedStrategies = strategies.filter(strategy => config.approvalScanStrategySlugs.includes(strategy.slug));
    const combos = buildApprovalScanPlan(eligible, { symbols: config.approvalScanSymbols.filter(symbol => config.allowedScanSymbols.includes(symbol)), intervals: config.approvalScanIntervals, strategySlugs: approvedStrategies.map(strategy => strategy.slug), maxCombinations: config.approvalScanMaxCombinations }).filter(combo => scanSymbols.includes(combo.symbol as (typeof scanSymbols)[number]) && scanIntervals.includes(combo.interval as ScanInterval)).map(combo => ({ ...combo, symbol: combo.symbol as (typeof scanSymbols)[number], interval: combo.interval as ScanInterval }));
    await ApprovalScanJob.updateOne({ key, runId }, { $set: { eligibleUsers: eligible.length } });
    const offset = combos.length ? (lease.nextOffset ?? 0) % combos.length : 0;
    const rotated = [...combos.slice(offset), ...combos.slice(0, offset)];
    for (const combo of rotated) {
      if (Date.now() >= deadline) break;
      combinations++;
      const outcome = { symbol: combo.symbol, interval: combo.interval, strategy: combo.strategySlug, result: "no_setup" };
      outcomes.push(outcome);
      try {
      const { candles } = await getSharedClosedCandles(combo.symbol, combo.interval);
      const selection = resolveStrategySelection(candles, combo.strategySlug, approvedStrategies, "approval-desk");
      if (!selection.analysis.hasSetup || !selection.analysis.setupSide) continue;
      const strategy = { requestedSlug: selection.requested.slug, selectedSlug: selection.selected.slug, selectedName: selection.selected.name, version: selection.selected.version };
      const { evaluation } = await getSharedResearchDecision(combo.symbol, combo.interval, selection.analysis, service, strategy);
      if (evaluation.decision !== "publish") { outcome.result = "ai_declined"; continue; }
      const side = selection.analysis.setupSide === "buy" ? "BUY" : "SELL";
      const fingerprint = digest({ scope: "live", symbol: combo.symbol, interval: combo.interval, requested: combo.strategySlug, selected: strategy.selectedSlug, dataCutoff: selection.analysis.dataCutoff.toISOString() });
      const expiresAt = new Date(selection.analysis.dataCutoff.getTime() + opportunityLifetime(combo.interval));
      if (expiresAt <= new Date()) { outcome.result = "expired"; continue; }
      const result = await SharedOpportunity.updateOne({ scope: "live", fingerprint }, { $setOnInsert: { scope: "live", fingerprint, symbol: combo.symbol, interval: combo.interval, requestedStrategySlug: strategy.requestedSlug, strategySlug: strategy.selectedSlug, strategyName: strategy.selectedName, strategyVersion: strategy.version, side, status: "active", entry: selection.analysis.entry, stop: selection.analysis.stop, target: selection.analysis.target, confidence: evaluation.confidence, summary: evaluation.summary, thesis: evaluation.thesis, riskNote: evaluation.riskNote, marketFacts: selection.analysis.facts, invalidationDirection: side === "BUY" ? "below" : "above", invalidationPrice: selection.analysis.stop, invalidationInstruction: evaluation.riskNote, modelVersion: service.openaiModel, providerResponseId: evaluation.providerResponseId, dataCutoff: selection.analysis.dataCutoff, expiresAt } }, { upsert: true });
      if (!result.upsertedCount) { outcome.result = "already_published"; continue; }
      outcome.result = "published";
      opportunitiesCreated += 1;
      const metrics = calculateTradeMetrics(side, selection.analysis.entry, selection.analysis.stop, selection.analysis.target, 100);
      const recipients = eligible.filter(preference => preference.symbols.includes(combo.symbol) && preference.intervals.includes(combo.interval) && preference.strategySlugs.includes(combo.strategySlug) && evaluation.confidence >= preference.minConfidence && metrics.riskReward >= preference.minRiskReward);
      await Promise.all(recipients.slice(0, 200).map(preference => notifyUser({ userId: String(preference.userId), kind: "research", title: `${combo.symbol.replace("USDT", "/USDT")} ${side === "BUY" ? "long" : "short"} opportunity`, body: `${combo.interval} · ${strategy.selectedName} · Unlock the setup before ${expiresAt.toLocaleTimeString()}.`, href: "/dashboard/approval", sourceKey: `approval:${fingerprint}:${preference.userId}` }).catch(() => undefined)));
      } catch (error) {
        outcome.result = "failed";
        if (error instanceof Error && /AI provider unavailable \((401|403)\)/.test(error.message)) throw new Error("AI credential rejected. Update the OpenAI API key in Platform controls > AI, then retry discovery.");
        console.error("Approval combination failed", combo.symbol, combo.interval, error instanceof Error ? error.message : "Unknown error");
      }
    }
    const failed = outcomes.filter(item => item.result === "failed").length;
    const status = failed ? "failed" : "completed";
    await ApprovalScanJob.updateOne({ key, runId }, { $set: { status, leaseUntil: new Date(0), combinations, opportunitiesCreated, outcomes, nextOffset: combos.length ? (offset + combinations) % combos.length : 0, completedAt: new Date(), lastError: failed ? `${failed} market/AI evaluations failed. Inspect server logs and retry.` : "" } });
    return { alreadyRunning: false, status, combinations, opportunitiesCreated, eligibleUsers: eligible.length, failed, deferred: combos.length - combinations, outcomes };
  } catch (error) {
    await ApprovalScanJob.updateOne({ key, runId }, { $set: { status: "failed", leaseUntil: new Date(0), combinations, opportunitiesCreated, outcomes, lastError: error instanceof Error ? error.message.slice(0, 500) : "Unknown discovery failure" } });
    throw error;
  }
}
