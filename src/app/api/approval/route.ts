import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { isSameOrigin } from "@/lib/request-origin";
import { ensureDemoWorkspace } from "@/lib/demo-workspace";
import { ensureApprovalPreference, expireApprovalOpportunities, latestClosedPrice, seedDemoApprovalOpportunities, validateOpportunityNow } from "@/lib/approval-engine";
import { getProductCatalog } from "@/lib/product-catalog";
import { getPlatformConfig } from "@/lib/platform-config";
import { getEnabledStrategies } from "@/lib/strategy-catalog";
import { scanIntervals, scanSymbols } from "@/lib/scan-markets";
import { calculatePositionPnl, calculateTradeMetrics } from "@/lib/trade-math";
import { PLATFORM_CREDIT_ID, getAccountCreditState } from "@/lib/credits";
import { ApprovalPreference } from "@/models/ApprovalPreference";
import { ApprovalScanJob } from "@/models/ApprovalScanJob";
import { ApprovalUnlock } from "@/models/ApprovalUnlock";
import { CreditEntry } from "@/models/CreditEntry";
import { DemoWorkspace } from "@/models/DemoWorkspace";
import { SharedOpportunity } from "@/models/SharedOpportunity";
import { User } from "@/models/User";
import { approvalDiscoveryStatus } from "@/lib/approval-discovery-status";
import { reconcileApprovalPositions } from "@/lib/approval-reconciliation";
import { ApprovalExecutionError, executeApprovalOnExchange, reconcilePendingApprovalOrders } from "@/lib/approval-execution";
import { resolveEffectivePermissions, writeSecurityAudit } from "@/lib/access-control";
import { ExchangeConnection } from "@/models/ExchangeConnection";
import { approvalExecutionAccess } from "@/lib/approval-execution-policy";
import { exchangeProviderIds, getExchangeProvider } from "@/lib/exchange-catalog";
import { futuresCapabilities } from "@/lib/exchange-futures-policy";

export const runtime = "nodejs";
const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save_preferences"), enabled: z.boolean(), symbols: z.array(z.enum(scanSymbols)).min(1).max(10), intervals: z.array(z.enum(scanIntervals)).min(1).max(5), strategySlugs: z.array(z.string().regex(/^[a-z][a-z0-9-]{1,39}$/)).min(1).max(4), minConfidence: z.number().int().min(50).max(95), minRiskReward: z.number().min(1).max(5), defaultNotionalUsdt: z.number().min(10).max(100000), revision: z.number().int().min(0) }),
  z.object({ action: z.literal("unlock"), opportunityId: objectId }),
  z.object({ action: z.enum(["paper_execute", "mark_external"]), opportunityId: objectId, amountUsdt: z.number().min(10).max(100000) }),
  z.object({ action: z.literal("execute_cex"), opportunityId: objectId, amountUsdt: z.number().min(10).max(100000), provider: z.enum(exchangeProviderIds), market: z.enum(["spot", "futures"]).default("spot"), leverage: z.number().int().min(1).max(20).optional(), marginMode: z.enum(["isolated", "cross"]).optional(), triggerPriceType: z.enum(["mark", "last"]).optional(), confirmation: z.string().max(32) }),
  z.object({ action: z.literal("dismiss"), opportunityId: objectId }),
  z.object({ action: z.literal("close_paper"), opportunityId: objectId }),
]);

async function currentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = await User.findOne({ _id: session.user.id, status: "active" }).select("_id isDemo activatedAt creditBalance").lean();
  return user ? { session, user, scope: (user.isDemo ? "demo" : "live") as "demo" | "live" } : null;
}

async function serializeState(userId: string, isDemo: boolean, message?: string) {
  const scope: "demo" | "live" = isDemo ? "demo" : "live";
  if (isDemo) { await ensureDemoWorkspace(userId); await seedDemoApprovalOpportunities(userId); }
  await expireApprovalOpportunities(scope);
  if (!isDemo && (await getPlatformConfig(false)).paperReconciliationOpen) await reconcileApprovalPositions(userId);
  if (!isDemo) await reconcilePendingApprovalOrders(userId);
  const preference = await ensureApprovalPreference(userId);
  const [catalog, allStrategies, platform, wallet, unlocks, scanJob, tradingConnections] = await Promise.all([
    getProductCatalog(isDemo),
    getEnabledStrategies(isDemo, "approval-desk"),
    getPlatformConfig(isDemo),
    getAccountCreditState(userId),
    ApprovalUnlock.find({ userId }).sort({ updatedAt: -1 }).limit(100).lean(),
    ApprovalScanJob.findOne({ key: "approval-discovery:live" }).lean(),
    isDemo ? [] : ExchangeConnection.find({ userId, market: { $in: ["spot", "futures"] }, environment: "live", status: "connected" }).select("provider market access").lean(),
  ]);
  const strategies = allStrategies.filter(item => platform.approvalScanStrategySlugs.includes(item.slug));
  const effectiveSymbols = preference!.symbols.filter(symbol => platform.approvalScanSymbols.includes(symbol));
  const effectiveIntervals = preference!.intervals.filter(interval => platform.approvalScanIntervals.includes(interval));
  const effectiveStrategySlugs = preference!.strategySlugs.filter(slug => strategies.some(item => item.slug === slug));
  const product = catalog.find(item => item.slug === "approval-desk");
  const unlockedIds = unlocks.map(item => item.opportunityId);
  const opportunityQuery = { scope, $or: [
    { _id: { $in: unlockedIds } },
    { status: "active" as const, expiresAt: { $gt: new Date() }, symbol: { $in: effectiveSymbols }, interval: { $in: effectiveIntervals }, requestedStrategySlug: { $in: effectiveStrategySlugs } },
  ] };
  const opportunities = await SharedOpportunity.find(opportunityQuery).sort({ createdAt: -1 }).limit(100).lean();
  const interactionByOpportunity = new Map(unlocks.map(item => [String(item.opportunityId), item]));
  const openSymbols = [...new Set(unlocks.filter(item => item.status === "paper_open").map(item => String(opportunities.find(opp => String(opp._id) === String(item.opportunityId))?.symbol ?? "")).filter(Boolean))];
  const marks = new Map<string, number>();
  await Promise.all(openSymbols.map(async symbol => { try { const opportunity = opportunities.find(item => item.symbol === symbol); marks.set(symbol, isDemo && opportunity ? opportunity.entry * 1.008 : await latestClosedPrice(symbol)); } catch {} }));
  const rows = opportunities.flatMap(opportunity => {
    const interaction = interactionByOpportunity.get(String(opportunity._id));
    const metrics = calculateTradeMetrics(opportunity.side, opportunity.entry, opportunity.stop, opportunity.target, interaction?.amountUsdt || preference!.defaultNotionalUsdt);
    if (!interaction && (opportunity.confidence < preference!.minConfidence || metrics.riskReward < preference!.minRiskReward)) return [];
    const unlocked = Boolean(interaction && interaction.creditCost > 0);
    const markPrice = interaction?.status === "paper_open" ? marks.get(opportunity.symbol) ?? interaction.markPrice ?? interaction.executionPrice ?? opportunity.entry : interaction?.markPrice ?? null;
    const pnl = interaction?.status === "paper_open" && markPrice ? calculatePositionPnl(opportunity.side, interaction.executionPrice || opportunity.entry, markPrice, interaction.amountUsdt) : { pnlUsdt: interaction?.pnlUsdt ?? null, pnlPct: interaction?.pnlPct ?? null };
    return [{ id: String(opportunity._id), symbol: opportunity.symbol, interval: opportunity.interval, side: opportunity.side, strategyName: opportunity.strategyName, strategySlug: opportunity.strategySlug, confidence: opportunity.confidence, summary: unlocked ? opportunity.summary : `${opportunity.side === "BUY" ? "Long" : "Short"} candidate. Unlock to inspect the research and trade levels.`, status: interaction?.status === "unlocked" && opportunity.status !== "active" ? "expired" : interaction?.status ?? "locked", unlocked, unlockCost: product?.cost ?? 0, createdAt: opportunity.createdAt.toISOString(), expiresAt: opportunity.expiresAt.toISOString(), dataCutoff: opportunity.dataCutoff.toISOString(), ...(unlocked ? { entry: opportunity.entry, stop: opportunity.stop, target: opportunity.target, thesis: opportunity.thesis, riskNote: opportunity.riskNote, invalidationDirection: opportunity.invalidationDirection, invalidationPrice: opportunity.invalidationPrice, invalidationInstruction: opportunity.invalidationInstruction, amountUsdt: interaction?.amountUsdt || preference!.defaultNotionalUsdt, metrics, executionPrice: interaction?.executionPrice ?? null, markPrice, exitPrice: interaction?.exitPrice ?? null, pnlUsdt: pnl.pnlUsdt, pnlPct: pnl.pnlPct, decidedAt: interaction?.decidedAt?.toISOString() ?? null, closedAt: interaction?.closedAt?.toISOString() ?? null, exchangeProvider: interaction?.exchangeProvider ?? null, exchangeMarket: interaction?.exchangeMarket ?? "spot", exchangeOrderId: interaction?.exchangeOrderId ?? null, exchangeClientOrderId: interaction?.exchangeClientOrderId ?? null, exchangeOrderStatus: interaction?.exchangeOrderStatus ?? null, executedQuantity: interaction?.executedQuantity ?? null, executedQuoteQuantity: interaction?.executedQuoteQuantity ?? null, leverage: interaction?.leverage ?? null, marginMode: interaction?.marginMode ?? null, stopOrderId: interaction?.stopOrderId ?? null, targetOrderId: interaction?.targetOrderId ?? null, protectionStatus: interaction?.protectionStatus ?? null } : {}) }];
  });
  const executionProviders = exchangeProviderIds.map(id => { const spot = tradingConnections.some(connection => connection.provider === id && connection.market === "spot" && connection.access === "spot_trade"); const futures = tradingConnections.some(connection => connection.provider === id && connection.market === "futures" && connection.access === "futures_trade"); const capability = futuresCapabilities[id]; return { id, name: getExchangeProvider(id).name, spotEnabled: spot, futuresEnabled: futures, futures: { maxLeverage: capability.maxLeverage, marginModes: capability.marginModes, triggerPriceTypes: capability.triggerPriceTypes } }; }).filter(item => item.spotEnabled || item.futuresEnabled);
  return { ok: true, message, discovery: approvalDiscoveryStatus({ operationsOpen: !platform.maintenanceMode && platform.scansOpen && platform.approvalDiscoveryOpen, productEnabled: Boolean(product?.enabled), preferenceEnabled: preference!.enabled, demo: isDemo, cadenceMinutes: platform.approvalScanCadenceMinutes, job: scanJob }), operations: { open: !platform.maintenanceMode && platform.approvalDiscoveryOpen, message: platform.maintenanceMode ? platform.maintenanceMessage : platform.approvalPausedMessage }, product: { enabled: Boolean(product?.enabled), cost: product?.cost ?? 0 }, wallet, preferences: { enabled: preference!.enabled, symbols: effectiveSymbols, intervals: effectiveIntervals, strategySlugs: effectiveStrategySlugs, minConfidence: preference!.minConfidence, minRiskReward: preference!.minRiskReward, defaultNotionalUsdt: preference!.defaultNotionalUsdt, revision: preference!.revision }, strategies: strategies.map(item => ({ slug: item.slug, name: item.name, description: item.description, experimental: item.experimental })), supported: { symbols: platform.approvalScanSymbols, intervals: platform.approvalScanIntervals }, opportunities: rows, execution: { providers: executionProviders }, scanner: { status: isDemo ? "simulation" : scanJob?.status ?? "waiting", lastRunAt: scanJob?.completedAt?.toISOString() ?? null, combinations: scanJob?.combinations ?? 0, created: scanJob?.opportunitiesCreated ?? 0 } };
}

export async function GET() {
  await connectDB();
  const actor = await currentUser();
  if (!actor) return NextResponse.json({ error: "Sign in to use Approval Desk." }, { status: 401 });
  return NextResponse.json(await serializeState(actor.session.user.id, Boolean(actor.user.isDemo)), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  await connectDB();
  const actor = await currentUser();
  if (!actor) return NextResponse.json({ error: "Sign in to use Approval Desk." }, { status: 401 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Review the Approval Desk request and try again." }, { status: 400 });
  const userId = actor.session.user.id;
  const isDemo = Boolean(actor.user.isDemo);
  const scope: "demo" | "live" = isDemo ? "demo" : "live";
  const operations = await getPlatformConfig(isDemo);
  const safetyAction = parsed.data.action === "dismiss" || parsed.data.action === "close_paper";
  if (operations.maintenanceMode && !safetyAction) return NextResponse.json({ error: operations.maintenanceMessage }, { status: 503 });
  if (!operations.approvalDiscoveryOpen && ["unlock", "paper_execute", "mark_external", "execute_cex"].includes(parsed.data.action)) return NextResponse.json({ error: operations.approvalPausedMessage }, { status: 503 });
  if (parsed.data.action === "save_preferences") {
    const [enabledStrategies, platform] = await Promise.all([getEnabledStrategies(isDemo, "approval-desk"), getPlatformConfig(isDemo)]);
    if (parsed.data.symbols.some(symbol => !platform.approvalScanSymbols.includes(symbol)) || parsed.data.intervals.some(interval => !platform.approvalScanIntervals.includes(interval))) return NextResponse.json({ error: "One or more markets or timeframes are outside the approved scan pool." }, { status: 400 });
    if (parsed.data.strategySlugs.some(slug => !platform.approvalScanStrategySlugs.includes(slug))) return NextResponse.json({ error: "One or more strategies are outside the approved scan pool." }, { status: 400 });
    if (parsed.data.strategySlugs.some(slug => !enabledStrategies.some(item => item.slug === slug))) return NextResponse.json({ error: "One or more strategies are unavailable." }, { status: 400 });
    const result = await ApprovalPreference.updateOne({ userId, revision: parsed.data.revision }, { $set: { enabled: parsed.data.enabled, symbols: parsed.data.symbols, intervals: parsed.data.intervals, strategySlugs: parsed.data.strategySlugs, minConfidence: parsed.data.minConfidence, minRiskReward: parsed.data.minRiskReward, defaultNotionalUsdt: parsed.data.defaultNotionalUsdt }, $inc: { revision: 1 } });
    if (!result.modifiedCount) return NextResponse.json({ error: "Settings changed elsewhere. Refresh and try again." }, { status: 409 });
    return NextResponse.json(await serializeState(userId, isDemo, parsed.data.enabled ? "Automatic opportunity scanning enabled." : "Automatic opportunity scanning paused."));
  }
  const opportunity = await SharedOpportunity.findOne({ _id: parsed.data.opportunityId, scope });
  if (!opportunity) return NextResponse.json({ error: "This opportunity is unavailable." }, { status: 404 });
  if (parsed.data.action === "unlock") {
    const existing = await ApprovalUnlock.findOne({ userId, opportunityId: opportunity._id });
    if (existing?.creditCost) return NextResponse.json(await serializeState(userId, isDemo, "This setup was already unlocked; no additional credit was charged."));
    const validity = await validateOpportunityNow(opportunity);
    if (!validity.valid) return NextResponse.json({ error: validity.reason }, { status: 409 });
    const product = (await getProductCatalog(isDemo)).find(item => item.slug === "approval-desk");
    if (!product?.enabled) return NextResponse.json({ error: "Approval Desk unlocking is temporarily paused." }, { status: 503 });
    if (isDemo) await ensureDemoWorkspace(userId);
    const mongoSession = await mongoose.startSession();
    try {
      await mongoSession.withTransaction(async () => {
        if (!await SharedOpportunity.exists({ _id: opportunity._id, scope, status: "active", expiresAt: { $gt: new Date() } }).session(mongoSession)) throw new Error("SETUP_EXPIRED");
        await ApprovalUnlock.create([{ userId, opportunityId: opportunity._id, status: "unlocked", creditCost: product.cost, unlockedAt: new Date() }], { session: mongoSession });
        if (isDemo) {
          const workspace = await DemoWorkspace.findOneAndUpdate({ userId, activatedAt: { $ne: null }, creditBalance: { $gte: product.cost } }, { $inc: { creditBalance: -product.cost, revision: 1 }, $push: { activity: { productId: "approval-desk", amount: -product.cost, note: `${opportunity.symbol} setup unlocked`, createdAt: new Date() } } }, { session: mongoSession, returnDocument: "after" });
          if (!workspace) throw new Error("INSUFFICIENT_CREDITS");
        } else {
          const user = await User.findOneAndUpdate({ _id: userId, status: "active", activatedAt: { $ne: null }, creditBalance: { $gte: product.cost } }, { $inc: { creditBalance: -product.cost } }, { session: mongoSession, returnDocument: "after" });
          if (!user) throw new Error("INSUFFICIENT_CREDITS");
          await CreditEntry.create([{ userId, productId: PLATFORM_CREDIT_ID, amount: -product.cost, kind: "capture", sourceKey: `approval-unlock:${userId}:${opportunity.id}`, note: `${opportunity.symbol} Approval Desk setup unlock` }], { session: mongoSession });
        }
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000 && await ApprovalUnlock.exists({ userId, opportunityId: opportunity._id })) return NextResponse.json(await serializeState(userId, isDemo, "This setup was already unlocked; no additional credit was charged."));
      if (error instanceof Error && error.message === "INSUFFICIENT_CREDITS") return NextResponse.json({ error: `You need ${product.cost} credits to unlock this setup.` }, { status: 402 });
      if (error instanceof Error && error.message === "SETUP_EXPIRED") return NextResponse.json({ error: "This setup expired before it could be unlocked. No credits were charged." }, { status: 409 });
      throw error;
    } finally { await mongoSession.endSession(); }
    return NextResponse.json(await serializeState(userId, isDemo, `Setup unlocked for ${product.cost} credits.`));
  }
  const interaction = await ApprovalUnlock.findOne({ userId, opportunityId: opportunity._id, creditCost: { $gt: 0 } });
  if (!interaction) return NextResponse.json({ error: "Unlock this setup before choosing what to do with it." }, { status: 403 });
  if (parsed.data.action === "execute_cex") {
    const definition = getExchangeProvider(parsed.data.provider);
    const market = parsed.data.market;
    const expectedConfirmation = market === "futures" ? "EXECUTE FUTURES" : "EXECUTE";
    const executionConnection = isDemo ? null : await ExchangeConnection.findOne({ userId, provider: parsed.data.provider, market, environment: "live", status: "connected" }).select("access").lean();
    const access = approvalExecutionAccess({ authenticated: true, active: true, isDemo, ownsUnlock: Boolean(interaction), requestedMarket: market, explicitlyConfirmed: parsed.data.confirmation === expectedConfirmation, operationsOpen: operations.exchangeConnectionsOpen && !operations.maintenanceMode, connectionAccess: executionConnection?.access ?? null });
    if (!access.allowed) return NextResponse.json({ error: access.reason === "Exchange execution is currently paused." ? operations.exchangeConnectionsPausedMessage : access.reason }, { status: access.status });
    if (interaction.status !== "unlocked" && interaction.status !== "exchange_pending") return NextResponse.json({ error: "This setup already has an execution decision." }, { status: 409 });
    const validity = await validateOpportunityNow(opportunity);
    if (!validity.valid) return NextResponse.json({ error: validity.reason }, { status: 409 });
    const actor = await resolveEffectivePermissions(userId);
    try {
      const futuresConfig = market === "futures" ? { leverage: parsed.data.leverage ?? 1, marginMode: parsed.data.marginMode ?? "isolated", positionMode: "one_way" as const, triggerPriceType: parsed.data.triggerPriceType ?? "mark" } : undefined;
      const result = await executeApprovalOnExchange({ provider: parsed.data.provider, market, userId, approvalUnlockId: String(interaction._id), opportunityId: String(opportunity._id), symbol: opportunity.symbol, side: opportunity.side, amountUsdt: parsed.data.amountUsdt, referencePrice: validity.markPrice ?? opportunity.entry, stopPrice: opportunity.stop, targetPrice: opportunity.target, futuresConfig });
      const protectionStatus = "protectionStatus" in result ? result.protectionStatus : undefined;
      await writeSecurityAudit({ actor, action: "exchange.order.execute", resource: "orders", targetType: "ApprovalUnlock", targetId: String(interaction._id), previousValue: { status: interaction.status }, newValue: { provider: parsed.data.provider, market, symbol: opportunity.symbol, side: opportunity.side, amountUsdt: parsed.data.amountUsdt, leverage: futuresConfig?.leverage, marginMode: futuresConfig?.marginMode, orderId: result.orderId, status: result.status, protectionStatus }, outcome: "success", reason: `User explicitly confirmed live ${definition.name} ${market} execution`, request });
      const label = result.state === "filled" ? "filled" : result.state === "partial" ? "partially filled" : "accepted";
      return NextResponse.json(await serializeState(userId, false, `${definition.name} ${market === "futures" ? "Futures position" : "Spot order"} ${label}. Order ${result.orderId}.`));
    } catch (error) {
      await writeSecurityAudit({ actor, action: "exchange.order.execute", resource: "orders", targetType: "ApprovalUnlock", targetId: String(interaction._id), previousValue: { status: interaction.status }, newValue: { provider: parsed.data.provider, market, symbol: opportunity.symbol, side: opportunity.side, amountUsdt: parsed.data.amountUsdt }, outcome: "failed", reason: error instanceof Error ? error.message : "Exchange execution failed", request }).catch(() => undefined);
      if (error instanceof ApprovalExecutionError) return NextResponse.json({ error: error.message }, { status: error.status });
      console.error("Approval Desk exchange execution failed", error);
      return NextResponse.json({ error: `The exchange order could not be completed. Check ${definition.name} before retrying.` }, { status: 503 });
    }
  }
  if (parsed.data.action === "dismiss") {
    if (!["unlocked"].includes(interaction.status)) return NextResponse.json({ error: "This setup already has an execution decision." }, { status: 409 });
    const dismissed = await ApprovalUnlock.updateOne({ _id: interaction._id, userId, status: "unlocked" }, { $set: { status: "dismissed", decidedAt: new Date() } });
    if (!dismissed.modifiedCount) return NextResponse.json({ error: "This setup already has a decision. Refresh the queue." }, { status: 409 });
    return NextResponse.json(await serializeState(userId, isDemo, "Setup dismissed and retained in history."));
  }
  if (parsed.data.action === "paper_execute" || parsed.data.action === "mark_external") {
    if (interaction.status !== "unlocked") return NextResponse.json({ error: "This setup already has an execution decision." }, { status: 409 });
    const validity = await validateOpportunityNow(opportunity);
    if (!validity.valid) return NextResponse.json({ error: validity.reason }, { status: 409 });
    const executionPrice = validity.markPrice ?? opportunity.entry;
    interaction.status = parsed.data.action === "paper_execute" ? "paper_open" : "external";
    interaction.amountUsdt = parsed.data.amountUsdt;
    interaction.executionPrice = executionPrice;
    interaction.markPrice = executionPrice;
    interaction.decidedAt = new Date();
    interaction.executionNote = parsed.data.action === "paper_execute" ? "Paper position opened; no exchange order was placed." : "User reported external execution; no exchange order was placed by Enrivea.";
    const decided = await ApprovalUnlock.updateOne({ _id: interaction._id, userId, status: "unlocked" }, { $set: { status: interaction.status, amountUsdt: interaction.amountUsdt, executionPrice, markPrice: executionPrice, decidedAt: interaction.decidedAt, executionNote: interaction.executionNote } });
    if (!decided.modifiedCount) return NextResponse.json({ error: "This setup already has a decision. Refresh the queue." }, { status: 409 });
    return NextResponse.json(await serializeState(userId, isDemo, parsed.data.action === "paper_execute" ? "Paper position opened." : "External trade recorded."));
  }
  if (parsed.data.action === "close_paper") {
    if (interaction.status !== "paper_open") return NextResponse.json({ error: "This paper position is not open." }, { status: 409 });
    const exitPrice = isDemo ? (interaction.markPrice || opportunity.entry * 1.008) : await latestClosedPrice(opportunity.symbol);
    const pnl = calculatePositionPnl(opportunity.side, interaction.executionPrice || opportunity.entry, exitPrice, interaction.amountUsdt);
    const closed = await ApprovalUnlock.updateOne({ _id: interaction._id, userId, status: "paper_open" }, { $set: { status: "closed_manual", exitPrice, markPrice: exitPrice, ...pnl, closedAt: new Date() } });
    if (!closed.modifiedCount) return NextResponse.json({ error: "This position has already closed. Refresh history." }, { status: 409 });
    return NextResponse.json(await serializeState(userId, isDemo, "Paper position closed and P&L recorded."));
  }
  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
