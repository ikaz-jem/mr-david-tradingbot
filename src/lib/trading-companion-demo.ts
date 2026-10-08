import "server-only";
import { createHash } from "node:crypto";
import { TradingCompanionProfile } from "@/models/TradingCompanionProfile";
import { User } from "@/models/User";
import { calculatePositionPnl, calculateTradeMetrics } from "@/lib/trade-math";

const fixtures = [
  { symbol: "BTCUSDT", interval: "4h", side: "BUY", entry: 64120, stop: 62196, target: 67967, confidence: 78, rationale: "Synthetic breakout retest with expanding volume and a defined structure invalidation." },
  { symbol: "ETHUSDT", interval: "1h", side: "BUY", entry: 2814, stop: 2730, target: 2983, confidence: 72, rationale: "Synthetic higher-low continuation after price reclaimed the session value area." },
  { symbol: "SOLUSDT", interval: "15m", side: "SELL", entry: 146.4, stop: 151.1, target: 137.8, confidence: 68, rationale: "Synthetic failed range breakout with momentum divergence and bounded downside target." },
] as const;

const executionPrices: Record<string, number> = { BTCUSDT: 64120, ETHUSDT: 2814, SOLUSDT: 146.4, BNBUSDT: 580, XRPUSDT: .62, LINKUSDT: 13.2 };

function pnl(side: "BUY" | "SELL", entry: number, price: number, amountUsdt: number) {
  return calculatePositionPnl(side, entry, price, amountUsdt);
}

function approvalValidity(fixture: typeof fixtures[number], createdAt = new Date()) {
  const direction = fixture.side === "BUY" ? "below" as const : "above" as const;
  return {
    invalidationDirection: direction,
    invalidationPrice: fixture.stop,
    invalidationInstruction: `Invalidate if the market trades ${direction} ${fixture.stop.toLocaleString()} before entry, or when the validity window closes.`,
    invalidationReason: null,
    expiresAt: new Date(createdAt.getTime() + 2 * 3600000),
  };
}

function seedApprovalHistory(userId: string) {
  const now = Date.now();
  const expiredFixture = fixtures[0];
  const invalidatedFixture = fixtures[2];
  const expiredAt = new Date(now - 7 * 3600000);
  const invalidatedAt = new Date(now - 5 * 3600000);
  return [
    {
      ...expiredFixture,
      ...calculateTradeMetrics(expiredFixture.side, expiredFixture.entry, expiredFixture.stop, expiredFixture.target, 300),
      ...approvalValidity(expiredFixture, expiredAt),
      opportunityId: createHash("sha256").update(`approval-history:${userId}:expired`).digest("hex").slice(0, 16),
      status: "expired" as const,
      markPrice: expiredFixture.entry,
      exitPrice: null,
      positionPnlUsdt: null,
      pnlPct: null,
      realizedPnlUsdt: null,
      invalidationReason: "The two-hour approval window elapsed before a decision was made.",
      createdAt: expiredAt,
      decidedAt: new Date(expiredAt.getTime() + 2 * 3600000),
      openedAt: null,
      closedAt: null,
    },
    {
      ...invalidatedFixture,
      ...calculateTradeMetrics(invalidatedFixture.side, invalidatedFixture.entry, invalidatedFixture.stop, invalidatedFixture.target, 250),
      ...approvalValidity(invalidatedFixture, invalidatedAt),
      opportunityId: createHash("sha256").update(`approval-history:${userId}:invalidated`).digest("hex").slice(0, 16),
      status: "invalidated" as const,
      markPrice: 152.2,
      exitPrice: null,
      positionPnlUsdt: null,
      pnlPct: null,
      realizedPnlUsdt: null,
      invalidationReason: "AI rule triggered: SOL traded above 151.1 before approval.",
      createdAt: invalidatedAt,
      decidedAt: new Date(invalidatedAt.getTime() + 42 * 60000),
      openedAt: null,
      closedAt: null,
    },
  ];
}

function seedAutopilotTrades(userId: string) {
  const now = Date.now();
  const rows = [
    { symbol: "BTCUSDT", side: "BUY", status: "open", entryPrice: 64120, price: 65480, amountUsdt: 500, openedAt: new Date(now - 42 * 60000), closedAt: null },
    { symbol: "ETHUSDT", side: "SELL", status: "open", entryPrice: 2814, price: 2766, amountUsdt: 250, openedAt: new Date(now - 3 * 3600000), closedAt: null },
    { symbol: "SOLUSDT", side: "BUY", status: "closed_target", entryPrice: 141, price: 149.4, amountUsdt: 300, openedAt: new Date(now - 27 * 3600000), closedAt: new Date(now - 22 * 3600000) },
    { symbol: "BNBUSDT", side: "BUY", status: "closed_stop", entryPrice: 580, price: 562.6, amountUsdt: 250, openedAt: new Date(now - 52 * 3600000), closedAt: new Date(now - 49 * 3600000) },
    { symbol: "XRPUSDT", side: "SELL", status: "closed_manual", entryPrice: .62, price: .59, amountUsdt: 400, openedAt: new Date(now - 78 * 3600000), closedAt: new Date(now - 72 * 3600000) },
    { symbol: "LINKUSDT", side: "BUY", status: "cancelled", entryPrice: 13.2, price: 13.2, amountUsdt: 200, openedAt: new Date(now - 102 * 3600000), closedAt: new Date(now - 101 * 3600000) },
  ] as const;
  return rows.map((row, index) => {
    const outcome = row.status === "cancelled" ? { pnlUsdt: 0, pnlPct: 0 } : pnl(row.side, row.entryPrice, row.price, row.amountUsdt);
    return { tradeId: createHash("sha256").update(`autopilot-demo:${userId}:${index}`).digest("hex").slice(0, 16), symbol: row.symbol, side: row.side, status: row.status, entryPrice: row.entryPrice, markPrice: row.status === "open" ? row.price : null, exitPrice: row.status === "open" ? null : row.price, stopPrice: Number((row.entryPrice * (row.side === "BUY" ? .97 : 1.03)).toFixed(6)), targetPrice: Number((row.entryPrice * (row.side === "BUY" ? 1.06 : .94)).toFixed(6)), amountUsdt: row.amountUsdt, quantity: Number((row.amountUsdt / row.entryPrice).toFixed(8)), ...outcome, openedAt: row.openedAt, closedAt: row.closedAt, exchange: "Binance Spot · Demo" };
  });
}

export async function ensureCompanionDemo(userId: string) {
  if (!await User.exists({ _id: userId, isDemo: true })) throw new Error("Trading Companion demo access is unavailable");
  const opportunities = fixtures.slice(0, 2).map((fixture, index) => {
    const createdAt = new Date(Date.now() - index * 3600000);
    const closed = index === 1;
    return { ...fixture, ...calculateTradeMetrics(fixture.side, fixture.entry, fixture.stop, fixture.target, index === 0 ? 500 : 250), ...approvalValidity(fixture, createdAt), opportunityId: createHash("sha256").update(`companion-demo:${userId}:${index}`).digest("hex").slice(0, 16), strategySlug: "ai-router", strategyName: "AI Strategy Router", strategyVersion: 1, status: closed ? "simulated_fill" : "pending", markPrice: closed ? null : fixture.entry, exitPrice: closed ? 2974.4 : null, positionPnlUsdt: closed ? 14.25 : null, pnlPct: closed ? 5.7 : null, realizedPnlUsdt: closed ? 14.25 : null, createdAt, decidedAt: closed ? new Date(Date.now() - 3000000) : null, openedAt: closed ? new Date(createdAt.getTime() + 12 * 60000) : null, closedAt: closed ? new Date(Date.now() - 3000000) : null };
  });
  await TradingCompanionProfile.updateOne({ userId }, { $setOnInsert: { userId, isDemo: true, opportunities } }, { upsert: true });
  await TradingCompanionProfile.updateOne({ userId, "autopilotTrades.0": { $exists: false } }, { $set: { autopilotTrades: seedAutopilotTrades(userId) } });
  const completedId = createHash("sha256").update(`companion-demo:${userId}:1`).digest("hex").slice(0, 16);
  const completedMetrics = calculateTradeMetrics("BUY", 2814, 2730, 2983, 250);
  await TradingCompanionProfile.updateOne({ userId }, { $set: { "opportunities.$[item].amountUsdt": 250, "opportunities.$[item].estimatedQuantity": completedMetrics.estimatedQuantity, "opportunities.$[item].potentialProfitUsdt": completedMetrics.potentialProfitUsdt, "opportunities.$[item].potentialLossUsdt": completedMetrics.potentialLossUsdt, "opportunities.$[item].riskReward": completedMetrics.riskReward, "opportunities.$[item].status": "simulated_fill", "opportunities.$[item].exitPrice": 2974.4, "opportunities.$[item].positionPnlUsdt": 14.25, "opportunities.$[item].pnlPct": 5.7, "opportunities.$[item].realizedPnlUsdt": 14.25 } }, { arrayFilters: [{ "item.opportunityId": completedId, "item.status": { $in: ["accepted", "simulated_fill"] } }] });

  const profile = await TradingCompanionProfile.findOne({ userId });
  if (!profile) return null;
  const now = new Date();
  let changed = false;
  const rows = profile.opportunities.map((document) => {
    const row = document.toObject();
    const createdAt = new Date(row.createdAt);
    const direction = row.side === "BUY" ? "below" as const : "above" as const;
    if (!row.expiresAt) { row.expiresAt = new Date(now.getTime() + 2 * 3600000); changed = true; }
    if (!row.invalidationDirection) { row.invalidationDirection = direction; changed = true; }
    if (!row.invalidationPrice) { row.invalidationPrice = row.stop; changed = true; }
    if (!row.invalidationInstruction) { row.invalidationInstruction = `Invalidate if the market trades ${direction} ${row.stop.toLocaleString()} before entry, or when the validity window closes.`; changed = true; }
    if (row.markPrice == null && row.status === "pending") { row.markPrice = row.entry; changed = true; }
    if (row.status === "accepted") {
      const markPrice = row.markPrice ?? Number((row.entry * (row.side === "BUY" ? 1.012 : .988)).toFixed(6));
      const outcome = calculatePositionPnl(row.side, row.entry, markPrice, row.amountUsdt ?? 250);
      if (row.markPrice == null || row.positionPnlUsdt == null || row.pnlPct == null || !row.openedAt) changed = true;
      row.markPrice = markPrice;
      row.positionPnlUsdt = outcome.pnlUsdt;
      row.pnlPct = outcome.pnlPct;
      row.openedAt ??= row.decidedAt ?? createdAt;
    }
    const expiresAt = new Date(row.expiresAt);
    const priceInvalid = row.status === "pending" && row.markPrice != null && (row.invalidationDirection === "below" ? row.markPrice < row.invalidationPrice : row.markPrice > row.invalidationPrice);
    if (row.status === "pending" && expiresAt <= now) {
      row.status = "expired";
      row.decidedAt = now;
      row.invalidationReason = "The approval window elapsed before a decision was made.";
      changed = true;
    } else if (priceInvalid) {
      row.status = "invalidated";
      row.decidedAt = now;
      row.invalidationReason = `AI rule triggered: market traded ${row.invalidationDirection} ${row.invalidationPrice.toLocaleString()} before approval.`;
      changed = true;
    }
    return row;
  });
  const history = seedApprovalHistory(userId).filter((item) => !rows.some((row) => row.opportunityId === item.opportunityId));
  if (history.length) changed = true;
  if (changed) {
    await TradingCompanionProfile.updateOne({ _id: profile._id, revision: profile.revision }, { $set: { opportunities: [...rows, ...history] }, $inc: { revision: 1 } });
    return TradingCompanionProfile.findById(profile._id);
  }
  return profile;
}

export function nextDemoOpportunity(userId: string, count: number) {
  const fixture = fixtures[count % fixtures.length];
  const createdAt = new Date();
  return { ...fixture, ...calculateTradeMetrics(fixture.side, fixture.entry, fixture.stop, fixture.target, 250), ...approvalValidity(fixture, createdAt), opportunityId: createHash("sha256").update(`companion-demo:${userId}:${count}:${Date.now()}`).digest("hex").slice(0, 16), status: "pending" as const, markPrice: fixture.entry, exitPrice: null, positionPnlUsdt: null, pnlPct: null, realizedPnlUsdt: null, createdAt, decidedAt: null, openedAt: null, closedAt: null };
}

export function nextDemoAutopilotTrade(userId: string, count: number, maxPositionUsd: number, allowedSymbols: string[]) {
  const symbol = allowedSymbols[count % allowedSymbols.length] ?? "BTCUSDT";
  const side = count % 2 === 0 ? "BUY" as const : "SELL" as const;
  const entryPrice = executionPrices[symbol] ?? 100;
  const move = count % 3 === 0 ? .006 : -.004;
  const markPrice = Number((entryPrice * (1 + move)).toFixed(6));
  const amountUsdt = Math.min(maxPositionUsd, 250);
  return {
    tradeId: createHash("sha256").update(`autopilot-run:${userId}:${count}:${Date.now()}`).digest("hex").slice(0, 16),
    symbol,
    side,
    status: "open" as const,
    entryPrice,
    markPrice,
    exitPrice: null,
    stopPrice: Number((entryPrice * (side === "BUY" ? .97 : 1.03)).toFixed(6)),
    targetPrice: Number((entryPrice * (side === "BUY" ? 1.06 : .94)).toFixed(6)),
    amountUsdt,
    quantity: Number((amountUsdt / entryPrice).toFixed(8)),
    ...pnl(side, entryPrice, markPrice, amountUsdt),
    openedAt: new Date(),
    closedAt: null,
    exchange: "Binance Spot · Demo",
  };
}
