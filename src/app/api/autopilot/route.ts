import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { workspaceActor } from "@/lib/workspace-access";
import { isSameOrigin } from "@/lib/request-origin";
import { getPlatformConfig } from "@/lib/platform-config";
import { getProductCatalog } from "@/lib/product-catalog";
import { getEnabledStrategies } from "@/lib/strategy-catalog";
import { getAccountCreditState } from "@/lib/credits";
import { regulatedAccess } from "@/lib/jurisdiction-policy";
import { writeSecurityAudit } from "@/lib/access-control";
import { scanIntervals, scanSymbols } from "@/lib/scan-markets";
import { exchangeProviderIds, getExchangeProvider } from "@/lib/exchange-catalog";
import { futuresCapabilities } from "@/lib/exchange-futures-policy";
import { decimalAdd } from "@/lib/trade-decimal";
import { AutopilotProfile } from "@/models/AutopilotProfile";
import { AutopilotExecution } from "@/models/AutopilotExecution";
import { AutopilotJob } from "@/models/AutopilotJob";
import { ExchangeConnection } from "@/models/ExchangeConnection";
import { Order } from "@/models/Order";
import { SecurityAttempt } from "@/models/SecurityAttempt";
import { SharedOpportunity } from "@/models/SharedOpportunity";
import { User } from "@/models/User";

export const runtime = "nodejs";
const settings = z.object({ action: z.literal("save_settings"), revision: z.number().int().min(0), provider: z.enum(exchangeProviderIds), market: z.literal("futures"), strategySlug: z.string().regex(/^[a-z][a-z0-9-]{1,39}$/), allowedSymbols: z.array(z.enum(scanSymbols)).min(1).max(10), allowedIntervals: z.array(z.enum(scanIntervals)).min(1).max(5), minConfidence: z.number().int().min(50).max(95), minRiskReward: z.number().min(1).max(5), maxPositionUsd: z.number().min(10).max(100000), maxDailyTrades: z.number().int().min(1).max(20), maxOpenPositions: z.number().int().min(1).max(10), dailyLossLimitPct: z.number().min(.25).max(20), leverage: z.number().int().min(1).max(20), marginMode: z.enum(["isolated", "cross"]), triggerPriceType: z.enum(["mark", "last"]) });
const status = z.object({ action: z.literal("set_status"), revision: z.number().int().min(0), status: z.enum(["running", "paused", "emergency_stopped"]), confirmation: z.string().max(40).optional(), currentPassword: z.string().max(200).optional() });
const input = z.discriminatedUnion("action", [settings, status]);

async function throttle(userId: string) {
  const bucket = Math.floor(Date.now() / 60_000);
  const row = await SecurityAttempt.findOneAndUpdate({ key: `autopilot-control:${userId}:${bucket}` }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * 60_000) } }, { upsert: true, returnDocument: "after" });
  return (row?.count ?? 0) <= 10;
}

async function ensureProfile(actor: NonNullable<Awaited<ReturnType<typeof workspaceActor>>>) {
  return AutopilotProfile.findOneAndUpdate({ userId: actor.id }, { $setOnInsert: { userId: actor.id, organizationId: actor.organizationId } }, { upsert: true, returnDocument: "after" });
}

function publicStatus(status: string) {
  if (["submitted", "filled", "partial", "submitting"].includes(status)) return "pending";
  if (status === "closed_target" || status === "closed_stop" || status === "closed_manual") return status;
  return "blocked";
}

async function state(actor: NonNullable<Awaited<ReturnType<typeof workspaceActor>>>, message?: string) {
  const profile = await ensureProfile(actor);
  const [wallet, products, strategies, operations, connections, executions, job] = await Promise.all([
    getAccountCreditState(actor.id), getProductCatalog(false), getEnabledStrategies(false, "autopilot"), getPlatformConfig(false),
    ExchangeConnection.find({ userId: actor.id, market: { $in: ["spot", "futures"] }, environment: "live", status: "connected", access: { $in: ["spot_trade", "futures_trade"] } }).select("provider market keyLast4 accountLabel ipRestricted").lean(),
    AutopilotExecution.find({ userId: actor.id }).sort({ createdAt: -1 }).limit(100).lean(), AutopilotJob.findOne({ key: "autopilot:live" }).lean(),
  ]);
  const opportunities = executions.length ? await SharedOpportunity.find({ _id: { $in: executions.map(item => item.opportunityId) } }).select("_id confidence strategyName").lean() : [];
  const opportunityById = new Map(opportunities.map(item => [String(item._id), item]));
  const trackedOrders = executions.length ? await Order.find({ userId: actor.id, _id: { $in: executions.map(item => item.orderId).filter(Boolean) } }).select("_id trackingStatus trackingError lastTrackedAt positionQuantity averageFillPrice markPrice realizedPnl unrealizedPnl feesQuote fundingQuote netPnl pnlComplete protectionStatus filledQuantity closedAt").lean() : [];
  const trackedById = new Map(trackedOrders.map(order => [String(order._id), order]));
  const providers = connections.map(connection => { const capability = futuresCapabilities[connection.provider]; return { id: connection.provider, market: connection.market, name: getExchangeProvider(connection.provider).name, keyLast4: connection.keyLast4, accountLabel: connection.accountLabel, ipRestricted: connection.ipRestricted, maxLeverage: capability.maxLeverage, marginModes: capability.marginModes, triggerPriceTypes: capability.triggerPriceTypes }; });
  return {
    ok: true, message,
    profile: { autopilotStatus: profile!.status, provider: profile!.provider, market: profile!.market ?? "futures", maxPositionUsd: profile!.maxPositionUsd, maxDailyTrades: profile!.maxDailyTrades, maxOpenPositions: profile!.maxOpenPositions, dailyLossLimitPct: profile!.dailyLossLimitPct, minConfidence: profile!.minConfidence, minRiskReward: profile!.minRiskReward, leverage: profile!.leverage, marginMode: profile!.marginMode, triggerPriceType: profile!.triggerPriceType, allowedSymbols: profile!.allowedSymbols, allowedIntervals: profile!.allowedIntervals, approvalStrategySlug: "ai-router", autopilotStrategySlug: profile!.strategySlug, lastEvaluatedAt: profile!.lastEvaluatedAt?.toISOString() ?? null, lastDecision: profile!.lastDecision, opportunities: [], autopilotTrades: executions.map(item => { const opportunity = opportunityById.get(String(item.opportunityId)); const order = item.orderId ? trackedById.get(String(item.orderId)) : null; const fresh = Boolean(order?.lastTrackedAt && Date.now() - order.lastTrackedAt.getTime() < 180_000); const confirmed = fresh && order?.trackingStatus === "current"; const mapped = order?.trackingStatus === "closed" ? publicStatus(item.status) : confirmed && Number(order?.positionQuantity ?? 0) > 0 ? "open" : publicStatus(item.status); const gross = order?.pnlComplete && order.netPnl != null ? Number(order.netPnl) : order?.realizedPnl != null && (order.unrealizedPnl != null || mapped !== "open") ? Number(decimalAdd([order.realizedPnl, order.unrealizedPnl ?? "0"])) : null; return { tradeId: String(item._id), symbol: item.symbol, side: item.side, status: mapped, entryPrice: order?.averageFillPrice ?? null, markPrice: confirmed ? order?.markPrice ?? null : null, exitPrice: null, stopPrice: item.stopPrice, targetPrice: item.targetPrice, amountUsdt: item.amountUsdt, quantity: confirmed || mapped.startsWith("closed") ? Number(order?.positionQuantity ?? order?.filledQuantity ?? 0) : null, pnlUsdt: gross, pnlPct: gross == null || !item.amountUsdt ? null : gross / item.amountUsdt * 100, pnlComplete: order?.pnlComplete ?? false, trackingStatus: order?.trackingStatus ?? "pending", trackingError: order?.trackingError ?? null, lastTrackedAt: order?.lastTrackedAt?.toISOString() ?? null, feesQuote: order?.feesQuote ?? null, fundingQuote: order?.fundingQuote ?? null, openedAt: (item.openedAt ?? item.createdAt).toISOString(), closedAt: order?.closedAt?.toISOString() ?? item.closedAt?.toISOString() ?? null, exchange: getExchangeProvider(item.provider).name + (item.market === "spot" ? " Spot" : " Futures"), strategySlug: item.strategySlug, strategyName: opportunity?.strategyName ?? item.strategySlug, strategyVersion: 1, reason: item.reason, protectionStatus: order?.protectionStatus ?? item.protectionStatus, exchangeOrderId: item.exchangeOrderId }; }), revision: profile!.revision },
    wallet, products: products.filter(item => ["signals", "approval-desk", "autopilot"].includes(item.slug)).map(item => ({ slug: item.slug, name: item.name, description: item.description, enabled: item.enabled, cost: item.cost })), strategies: strategies.map(item => ({ slug: item.slug, name: item.name, description: item.description, experimental: item.experimental, products: item.products, version: item.version })),
    operations: { approvalOpen: !operations.maintenanceMode && operations.approvalDiscoveryOpen, autopilotOpen: !operations.maintenanceMode && operations.autopilotOpen, approvalMessage: operations.maintenanceMode ? operations.maintenanceMessage : operations.approvalPausedMessage, autopilotMessage: operations.maintenanceMode ? operations.maintenanceMessage : operations.autopilotPausedMessage, allowedSymbols: operations.approvalScanSymbols, allowedIntervals: operations.approvalScanIntervals },
    execution: { certified: process.env.EXCHANGE_EXECUTION_CERTIFIED === "true", providers }, worker: { status: job?.status ?? "idle", lastRunAt: job?.completedAt?.toISOString() ?? null, evaluated: job?.profilesEvaluated ?? 0, accepted: job?.ordersAccepted ?? 0 },
  };
}

export async function GET() {
  const actor = await workspaceActor();
  if (!actor || actor.isDemo || actor.organizationKind !== "customer") return NextResponse.json({ error: "Sign in with a live customer account." }, { status: 401 });
  await connectDB();
  return NextResponse.json(await state(actor), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const actor = await workspaceActor();
  if (!actor || actor.isDemo || actor.organizationKind !== "customer") return NextResponse.json({ error: "Sign in with a live customer account." }, { status: 401 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Review the Autopilot settings and try again." }, { status: 400 });
  await connectDB();
  if (!await throttle(actor.id)) return NextResponse.json({ error: "Too many Autopilot control changes. Wait one minute and retry." }, { status: 429 });
  const profile = await ensureProfile(actor);
  if (!profile || profile.revision !== parsed.data.revision) return NextResponse.json({ error: "Autopilot settings changed elsewhere. Refresh and retry." }, { status: 409 });
  if (parsed.data.action === "save_settings") {
    const settingsData = parsed.data;
    if (profile.status === "running" && (profile.market !== settingsData.market || profile.provider !== settingsData.provider)) return NextResponse.json({ error: "Pause Autopilot before changing its exchange or trading market." }, { status: 409 });
    const [strategies, controls] = await Promise.all([getEnabledStrategies(false, "autopilot"), getPlatformConfig(false)]);
    if (!strategies.some(item => item.slug === settingsData.strategySlug)) return NextResponse.json({ error: "Choose an enabled Autopilot strategy." }, { status: 400 });
    if (settingsData.allowedSymbols.some(symbol => !controls.approvalScanSymbols.includes(symbol)) || settingsData.allowedIntervals.some(interval => !controls.approvalScanIntervals.includes(interval))) return NextResponse.json({ error: "Autopilot can use only pairs and timeframes approved for the shared scanner." }, { status: 400 });
    const capability = futuresCapabilities[settingsData.provider];
    if (settingsData.market === "futures" && (settingsData.leverage > capability.maxLeverage || !capability.marginModes.includes(settingsData.marginMode) || !capability.triggerPriceTypes.includes(settingsData.triggerPriceType))) return NextResponse.json({ error: "These Futures settings are unsupported by the selected exchange." }, { status: 400 });
    const changed = await AutopilotProfile.updateOne({ _id: profile._id, userId: actor.id, revision: settingsData.revision }, { $set: { provider: settingsData.provider, market: settingsData.market, strategySlug: settingsData.strategySlug, allowedSymbols: settingsData.allowedSymbols, allowedIntervals: settingsData.allowedIntervals, minConfidence: settingsData.minConfidence, minRiskReward: settingsData.minRiskReward, maxPositionUsd: settingsData.maxPositionUsd, maxDailyTrades: settingsData.maxDailyTrades, maxOpenPositions: settingsData.maxOpenPositions, dailyLossLimitPct: settingsData.dailyLossLimitPct, leverage: settingsData.leverage, marginMode: settingsData.marginMode, triggerPriceType: settingsData.triggerPriceType }, $inc: { revision: 1 } });
    if (!changed.modifiedCount) return NextResponse.json({ error: "Autopilot settings changed elsewhere. Refresh and retry." }, { status: 409 });
    await writeSecurityAudit({ actor, action: "autopilot.settings.update", resource: "orders", targetType: "AutopilotProfile", targetId: String(profile._id), previousValue: { provider: profile.provider, market: profile.market }, newValue: { provider: settingsData.provider, market: settingsData.market, symbols: settingsData.allowedSymbols, intervals: settingsData.allowedIntervals, leverage: settingsData.leverage, maxPositionUsd: settingsData.maxPositionUsd }, outcome: "success", reason: "Customer updated owner-scoped automation policy", request });
    return NextResponse.json(await state(actor, "Autopilot strategy and risk controls saved."));
  }
  if (parsed.data.status === "running") {
    if (profile.market !== "futures") return NextResponse.json({ error: "Spot Autopilot cannot be armed until automatic protective exits and tracking are certified for this exchange. Switch to Futures or keep it paused." }, { status: 409 });
    if (profile.provider !== "binance") return NextResponse.json({ error: "Live Futures tracking is currently certified only for Binance." }, { status: 409 });
    const [user, controls, product, connection] = await Promise.all([User.findById(actor.id).select("+passwordHash countryCode activatedAt").lean(), getPlatformConfig(false), getProductCatalog(false).then(items => items.find(item => item.slug === "autopilot")), ExchangeConnection.findOne({ userId: actor.id, provider: profile.provider, market: "futures", environment: "live", status: "connected", access: "futures_trade" }).select("_id").lean()]);
    const jurisdiction = regulatedAccess({ isDemo: false, countryCode: user?.countryCode, action: "exchange_execution" });
    if (process.env.EXCHANGE_EXECUTION_CERTIFIED !== "true") return NextResponse.json({ error: "Autopilot cannot be armed until exchange execution is certified in this deployment." }, { status: 503 });
    if (!controls.autopilotOpen || controls.maintenanceMode || !product?.enabled) return NextResponse.json({ error: controls.maintenanceMode ? controls.maintenanceMessage : controls.autopilotPausedMessage }, { status: 503 });
    if (!user?.activatedAt || !jurisdiction.allowed || !connection) return NextResponse.json({ error: !jurisdiction.allowed ? jurisdiction.reason : !connection ? "Connect the selected exchange with Futures execution access first." : "Activate your account first." }, { status: !jurisdiction.allowed ? jurisdiction.status : 409 });
    if (parsed.data.confirmation !== "ENABLE AUTOPILOT" || !parsed.data.currentPassword || !user.passwordHash || !await bcrypt.compare(parsed.data.currentPassword, user.passwordHash)) {
      await writeSecurityAudit({ actor, action: "autopilot.enable.denied", resource: "orders", targetType: "AutopilotProfile", targetId: String(profile._id), outcome: "denied", reason: "Step-up password or confirmation phrase failed", request }).catch(() => undefined);
      return NextResponse.json({ error: "Type ENABLE AUTOPILOT and confirm your current password." }, { status: 403 });
    }
  }
  const changed = await AutopilotProfile.updateOne({ _id: profile._id, userId: actor.id, revision: parsed.data.revision }, { $set: { status: parsed.data.status, enabledAt: parsed.data.status === "running" ? new Date() : profile.enabledAt, emergencyStoppedAt: parsed.data.status === "emergency_stopped" ? new Date() : null, lastDecision: parsed.data.status === "running" ? "Armed; waiting for the next shared opportunity." : parsed.data.status === "paused" ? "Paused by the account owner." : "Emergency stop engaged by the account owner." }, $inc: { revision: 1 } });
  if (!changed.modifiedCount) return NextResponse.json({ error: "Autopilot status changed elsewhere. Refresh and retry." }, { status: 409 });
  await writeSecurityAudit({ actor, action: `autopilot.${parsed.data.status}`, resource: "orders", targetType: "AutopilotProfile", targetId: String(profile._id), previousValue: { status: profile.status }, newValue: { status: parsed.data.status }, outcome: "success", reason: parsed.data.status === "running" ? "Step-up authenticated enablement" : "Owner safety control", request });
  return NextResponse.json(await state(actor, parsed.data.status === "running" ? "Autopilot armed. The worker will evaluate shared opportunities against your limits." : parsed.data.status === "paused" ? "Autopilot paused. Existing exchange positions remain managed by their exchange-side protection." : "Emergency stop engaged. No new positions will be opened."));
}
