import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { ensureCompanionDemo, nextDemoAutopilotTrade, nextDemoOpportunity } from "@/lib/trading-companion-demo";
import { isSameOrigin } from "@/lib/request-origin";
import { workspaceActor } from "@/lib/workspace-access";
import { TradingCompanionProfile } from "@/models/TradingCompanionProfile";
import { calculatePositionPnl, calculateTradeMetrics } from "@/lib/trade-math";
import { ensureDemoWorkspace } from "@/lib/demo-workspace";
import { getProductCatalog } from "@/lib/product-catalog";
import { DemoWorkspace } from "@/models/DemoWorkspace";
import { getEnabledStrategies, getStrategyCatalog } from "@/lib/strategy-catalog";
import { getPlatformConfig } from "@/lib/platform-config";

const actionInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("find_opportunity"), requestId: z.string().uuid(), strategySlug: z.string().min(2).max(64) }),
  z.object({ action: z.literal("decide"), opportunityId: z.string().min(8).max(64), decision: z.enum(["accepted", "rejected"]), amountUsdt: z.number().min(10).max(100000) }),
  z.object({ action: z.literal("close_approval_position"), opportunityId: z.string().min(8).max(64) }),
  z.object({ action: z.literal("autopilot_run"), requestId: z.string().uuid() }),
  z.object({ action: z.literal("autopilot_status"), status: z.enum(["paused", "emergency_stopped"]) }),
  z.object({ action: z.literal("autopilot_settings"), maxPositionUsd: z.number().min(10).max(100000), maxDailyTrades: z.number().int().min(1).max(50), dailyLossLimitPct: z.number().min(.25).max(20), allowedSymbols: z.array(z.enum(["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "LINKUSDT"])).min(1).max(6), strategySlug: z.string().min(2).max(64) }),
]);

function serialize(profile: NonNullable<Awaited<ReturnType<typeof ensureCompanionDemo>>>) {
  return { autopilotStatus: profile.autopilotStatus, maxPositionUsd: profile.maxPositionUsd, maxDailyTrades: profile.maxDailyTrades, dailyLossLimitPct: profile.dailyLossLimitPct, allowedSymbols: profile.allowedSymbols, approvalStrategySlug: profile.approvalStrategySlug, autopilotStrategySlug: profile.autopilotStrategySlug, opportunities: [...profile.opportunities].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()), autopilotTrades: [...(profile.autopilotTrades ?? [])].sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime()), revision: profile.revision };
}

async function state(userId: string, profile: NonNullable<Awaited<ReturnType<typeof ensureCompanionDemo>>>) {
  const [workspace, catalog, strategies, operations] = await Promise.all([ensureDemoWorkspace(userId), getProductCatalog(true), getStrategyCatalog(true), getPlatformConfig(true)]);
  return {
    profile: serialize(profile),
    wallet: { balance: workspace?.creditBalance ?? 0, activated: Boolean(workspace?.activatedAt) },
    products: catalog.filter((item) => ["signals", "approval-desk", "autopilot"].includes(item.slug)).map((item) => ({ slug: item.slug, name: item.name, description: item.description, enabled: item.enabled, cost: item.cost })),
    strategies: strategies.filter((item) => item.enabled).map((item) => ({ slug: item.slug, name: item.name, description: item.description, experimental: item.experimental, products: item.products, version: item.version })),
    operations: { approvalOpen: !operations.maintenanceMode && operations.approvalDiscoveryOpen, autopilotOpen: !operations.maintenanceMode && operations.autopilotOpen, approvalMessage: operations.maintenanceMode ? operations.maintenanceMessage : operations.approvalPausedMessage, autopilotMessage: operations.maintenanceMode ? operations.maintenanceMessage : operations.autopilotPausedMessage },
  };
}

class CreditActionError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function chargeRun(userId: string, slug: "approval-desk" | "autopilot", requestId: string, itemId: string, note: string) {
  const [workspace, product] = await Promise.all([
    ensureDemoWorkspace(userId),
    getProductCatalog(true).then((items) => items.find((item) => item.slug === slug)),
  ]);
  if (!workspace) throw new CreditActionError("Demo workspace unavailable.", 503);
  if (!product?.enabled) throw new CreditActionError(`${product?.name ?? "This product"} is paused by operations. No credit was charged.`, 503);
  const previous = workspace.receipts.find((item) => item.requestId === requestId);
  if (previous) {
    if (previous.productId !== slug || previous.itemId !== itemId) throw new CreditActionError("This request ID was already used for another action.", 409);
    return { cost: Math.abs(previous.credits ?? product.cost), duplicate: true };
  }
  if (!workspace.activatedAt) throw new CreditActionError("Activate the demo account before using Trading Companion products.", 402);
  if (workspace.creditBalance < product.cost) throw new CreditActionError(`You need ${product.cost} platform credit${product.cost === 1 ? "" : "s"} for this ${slug === "autopilot" ? "Autopilot run" : "Approval Desk run"}.`, 402);
  if (workspace.receipts.length >= 500) throw new CreditActionError("Demo activity limit reached.", 409);
  const result = await DemoWorkspace.updateOne(
    { _id: workspace._id, activatedAt: { $ne: null }, creditBalance: { $gte: product.cost }, "receipts.requestId": { $ne: requestId } },
    {
      $inc: { creditBalance: -product.cost, revision: 1 },
      $push: {
        receipts: { requestId, kind: "product_run", productId: slug, itemId, amount: 0, credits: -product.cost, createdAt: new Date() },
        activity: { $each: [{ productId: slug, amount: -product.cost, note, createdAt: new Date() }], $slice: -200 },
      },
    },
  );
  if (!result.modifiedCount) {
    const fresh = await DemoWorkspace.findById(workspace._id).lean();
    const raced = fresh?.receipts.find((item) => item.requestId === requestId);
    if (raced?.productId === slug && raced.itemId === itemId) return { cost: Math.abs(raced.credits ?? product.cost), duplicate: true };
    throw new CreditActionError("Your credit balance changed. Review it and retry.", 409);
  }
  return { cost: product.cost, duplicate: false };
}

async function refundRun(userId: string, requestId: string, cost: number, slug: string) {
  await DemoWorkspace.updateOne(
    { userId, "receipts.requestId": requestId },
    {
      $inc: { creditBalance: cost, revision: 1 },
      $pull: { receipts: { requestId } },
      $push: { activity: { $each: [{ productId: slug, amount: cost, note: "Failed product run refunded", createdAt: new Date() }], $slice: -200 } },
    },
  );
}

export async function GET() {
  const actor = await workspaceActor();
  if (!actor?.isDemo) return NextResponse.json({ error: "Demo accounts only." }, { status: 403 });
  await connectDB();
  const profile = await ensureCompanionDemo(actor.id);
  return NextResponse.json(await state(actor.id, profile!), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const actor = await workspaceActor();
  if (!actor?.isDemo) return NextResponse.json({ error: "Demo accounts only." }, { status: 403 });
  const parsed = actionInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the Trading Companion controls and try again." }, { status: 400 });
  await connectDB();
  const operations = await getPlatformConfig(true);
  const safetyAction = parsed.data.action === "close_approval_position" || parsed.data.action === "autopilot_status";
  if (operations.maintenanceMode && !safetyAction) return NextResponse.json({ error: operations.maintenanceMessage }, { status: 503 });
  if (!operations.approvalDiscoveryOpen && ["find_opportunity", "decide"].includes(parsed.data.action)) return NextResponse.json({ error: operations.approvalPausedMessage }, { status: 503 });
  if (!operations.autopilotOpen && ["autopilot_run", "autopilot_settings"].includes(parsed.data.action)) return NextResponse.json({ error: operations.autopilotPausedMessage }, { status: 503 });
  const profile = await ensureCompanionDemo(actor.id);
  if (!profile) return NextResponse.json({ error: "Demo profile unavailable." }, { status: 503 });
  const filter = { _id: profile._id, revision: profile.revision };
  let update: Record<string, unknown>;
  let message: string;
  if (parsed.data.action === "find_opportunity") {
    const requestedStrategySlug = parsed.data.strategySlug;
    const active = profile.opportunities.filter((item) => item.status === "pending").length;
    if (active >= 5) return NextResponse.json({ error: "Review a pending opportunity before adding another." }, { status: 409 });
    const strategies = await getEnabledStrategies(true, "approval-desk");
    const strategy = strategies.find((item) => item.slug === requestedStrategySlug);
    if (!strategy) return NextResponse.json({ error: "This strategy is not available for Approval Desk." }, { status: 409 });
    const opportunity = { ...nextDemoOpportunity(actor.id, profile.opportunities.length), strategySlug: strategy.slug, strategyName: strategy.name, strategyVersion: strategy.version };
    let charge: Awaited<ReturnType<typeof chargeRun>>;
    try { charge = await chargeRun(actor.id, "approval-desk", parsed.data.requestId, `approval-cycle:${strategy.slug}:v${strategy.version}`, `Approval Desk run · ${strategy.name}`); }
    catch (error) { return error instanceof CreditActionError ? NextResponse.json({ error: error.message }, { status: error.status }) : NextResponse.json({ error: "Credit processing failed. No action was completed." }, { status: 503 }); }
    if (charge.duplicate) return NextResponse.json({ ok: true, message: `This Approval Desk run was already completed. ${charge.cost} credits were charged once.`, ...await state(actor.id, profile) });
    update = { $set: { approvalStrategySlug: strategy.slug }, $push: { opportunities: { $each: [opportunity], $position: 0, $slice: 12 } }, $inc: { revision: 1 } };
    const result = await TradingCompanionProfile.updateOne(filter, update);
    if (!result.modifiedCount) {
      await refundRun(actor.id, parsed.data.requestId, charge.cost, "approval-desk");
      return NextResponse.json({ error: "The queue changed. Your credits were restored; retry the run." }, { status: 409 });
    }
    const fresh = await TradingCompanionProfile.findById(profile._id);
    return NextResponse.json({ ok: true, message: `A synthetic opportunity was added. ${charge.cost} credit${charge.cost === 1 ? "" : "s"} consumed.`, ...await state(actor.id, fresh!) });
  } else if (parsed.data.action === "decide") {
    const { opportunityId, decision, amountUsdt } = parsed.data;
    const opportunity = profile.opportunities.find((item) => item.opportunityId === opportunityId);
    if (!opportunity || opportunity.status !== "pending") return NextResponse.json({ error: "This opportunity is no longer awaiting a decision." }, { status: 409 });
    if (opportunity.expiresAt <= new Date()) {
      await TradingCompanionProfile.updateOne(filter, { $set: { "opportunities.$[item].status": "expired", "opportunities.$[item].decidedAt": new Date(), "opportunities.$[item].invalidationReason": "The approval window elapsed before a decision was made." }, $inc: { revision: 1 } }, { arrayFilters: [{ "item.opportunityId": opportunityId, "item.status": "pending" }] });
      const fresh = await TradingCompanionProfile.findById(profile._id);
      return NextResponse.json({ error: "This trade idea expired before it was approved.", ...await state(actor.id, fresh!) }, { status: 409 });
    }
    const metrics = calculateTradeMetrics(opportunity.side, opportunity.entry, opportunity.stop, opportunity.target, amountUsdt);
    const markPrice = Number((opportunity.entry * (opportunity.side === "BUY" ? 1.012 : .988)).toFixed(6));
    const outcome = calculatePositionPnl(opportunity.side, opportunity.entry, markPrice, amountUsdt);
    const decidedAt = new Date();
    update = { $set: { "opportunities.$[item].status": decision, "opportunities.$[item].decidedAt": decidedAt, "opportunities.$[item].amountUsdt": metrics.amountUsdt, "opportunities.$[item].estimatedQuantity": metrics.estimatedQuantity, "opportunities.$[item].potentialProfitUsdt": metrics.potentialProfitUsdt, "opportunities.$[item].potentialLossUsdt": metrics.potentialLossUsdt, "opportunities.$[item].riskReward": metrics.riskReward, ...(decision === "accepted" ? { "opportunities.$[item].openedAt": decidedAt, "opportunities.$[item].markPrice": markPrice, "opportunities.$[item].positionPnlUsdt": outcome.pnlUsdt, "opportunities.$[item].pnlPct": outcome.pnlPct } : {}) }, $inc: { revision: 1 } };
    const result = await TradingCompanionProfile.updateOne(filter, update, { arrayFilters: [{ "item.opportunityId": opportunityId, "item.status": "pending" }] });
    if (!result.modifiedCount) return NextResponse.json({ error: "The queue changed. Refresh and retry." }, { status: 409 });
    const fresh = await TradingCompanionProfile.findById(profile._id);
    return NextResponse.json({ ok: true, message: decision === "accepted" ? "Trade approved and moved to Open positions. No real order was sent and no additional credit was charged." : "Opportunity rejected and retained in trade history. No additional credit was charged.", ...await state(actor.id, fresh!) });
  } else if (parsed.data.action === "close_approval_position") {
    const opportunityId = parsed.data.opportunityId;
    const opportunity = profile.opportunities.find((item) => item.opportunityId === opportunityId);
    if (!opportunity || opportunity.status !== "accepted") return NextResponse.json({ error: "This Approval Desk position is no longer open." }, { status: 409 });
    const exitPrice = opportunity.markPrice ?? opportunity.entry;
    const outcome = calculatePositionPnl(opportunity.side, opportunity.entry, exitPrice, opportunity.amountUsdt ?? 250);
    const closedAt = new Date();
    const result = await TradingCompanionProfile.updateOne(filter, { $set: { "opportunities.$[item].status": "closed_manual", "opportunities.$[item].exitPrice": exitPrice, "opportunities.$[item].markPrice": null, "opportunities.$[item].positionPnlUsdt": outcome.pnlUsdt, "opportunities.$[item].pnlPct": outcome.pnlPct, "opportunities.$[item].realizedPnlUsdt": outcome.pnlUsdt, "opportunities.$[item].closedAt": closedAt }, $inc: { revision: 1 } }, { arrayFilters: [{ "item.opportunityId": opportunityId, "item.status": "accepted" }] });
    if (!result.modifiedCount) return NextResponse.json({ error: "The position changed. Refresh and retry." }, { status: 409 });
    const fresh = await TradingCompanionProfile.findById(profile._id);
    return NextResponse.json({ ok: true, message: `Position closed at ${exitPrice.toLocaleString()}. Its simulated P&L is now recorded in history.`, ...await state(actor.id, fresh!) });
  } else if (parsed.data.action === "autopilot_run") {
    const strategies = await getEnabledStrategies(true, "autopilot");
    const strategy = strategies.find((item) => item.slug === profile.autopilotStrategySlug);
    if (!strategy) return NextResponse.json({ error: "The selected Autopilot strategy is disabled. Choose another strategy in risk controls." }, { status: 409 });
    let charge: Awaited<ReturnType<typeof chargeRun>>;
    try { charge = await chargeRun(actor.id, "autopilot", parsed.data.requestId, `autopilot-cycle:${strategy.slug}:v${strategy.version}`, `Guarded Autopilot run · ${strategy.name}`); }
    catch (error) { return error instanceof CreditActionError ? NextResponse.json({ error: error.message }, { status: error.status }) : NextResponse.json({ error: "Credit processing failed. No action was completed." }, { status: 503 }); }
    if (charge.duplicate) return NextResponse.json({ ok: true, message: `This Autopilot run was already started. ${charge.cost} credits were charged once.`, ...await state(actor.id, profile) });
    const trade = { ...nextDemoAutopilotTrade(actor.id, profile.autopilotTrades?.length ?? 0, profile.maxPositionUsd, profile.allowedSymbols), strategySlug: strategy.slug, strategyName: strategy.name, strategyVersion: strategy.version };
    const result = await TradingCompanionProfile.updateOne(filter, { $set: { autopilotStatus: "running" }, $push: { autopilotTrades: { $each: [trade], $position: 0, $slice: 100 } }, $inc: { revision: 1 } });
    if (!result.modifiedCount) {
      await refundRun(actor.id, parsed.data.requestId, charge.cost, "autopilot");
      return NextResponse.json({ error: "Autopilot state changed. Your credits were restored; retry the run." }, { status: 409 });
    }
    const fresh = await TradingCompanionProfile.findById(profile._id);
    return NextResponse.json({ ok: true, message: `Autopilot run started in simulation. ${charge.cost} credits consumed.`, ...await state(actor.id, fresh!) });
  } else if (parsed.data.action === "autopilot_status") {
    update = { $set: { autopilotStatus: parsed.data.status }, $inc: { revision: 1 } };
    message = parsed.data.status === "emergency_stopped" ? "Emergency stop engaged. No new demo actions can queue." : "Demo Autopilot paused.";
  } else {
    const requestedStrategySlug = parsed.data.strategySlug;
    const strategies = await getEnabledStrategies(true, "autopilot");
    if (!strategies.some((item) => item.slug === requestedStrategySlug)) return NextResponse.json({ error: "This strategy is not available for Autopilot." }, { status: 409 });
    update = { $set: { maxPositionUsd: parsed.data.maxPositionUsd, maxDailyTrades: parsed.data.maxDailyTrades, dailyLossLimitPct: parsed.data.dailyLossLimitPct, allowedSymbols: parsed.data.allowedSymbols, autopilotStrategySlug: requestedStrategySlug }, $inc: { revision: 1 } };
    message = "Autopilot risk controls saved.";
  }
  const result = await TradingCompanionProfile.updateOne(filter, update);
  if (!result.modifiedCount) return NextResponse.json({ error: "The companion profile changed. Refresh and retry." }, { status: 409 });
  const fresh = await TradingCompanionProfile.findById(profile._id);
  return NextResponse.json({ ok: true, message, ...await state(actor.id, fresh!) });
}
