import "server-only";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { decryptExchangeCredential } from "@/lib/exchange-credentials";
import { getSpotOrder } from "@/lib/exchange-spot-orders";
import { getBinanceFunding, getBinanceTrackingSnapshot } from "@/lib/binance-tracking";
import { projectFuturesTrade } from "@/lib/trade-projection";
import { decimalAdd } from "@/lib/trade-decimal";
import { requireTradeTrackingIndexes } from "@/lib/trade-indexes";
import type { ExchangeProviderId } from "@/lib/exchange-catalog";
import { ApprovalUnlock } from "@/models/ApprovalUnlock";
import { AutopilotExecution } from "@/models/AutopilotExecution";
import { AutopilotProfile } from "@/models/AutopilotProfile";
import { ExchangeConnection } from "@/models/ExchangeConnection";
import { Order } from "@/models/Order";
import { TradeFill } from "@/models/TradeFill";

function orderState(status: string) {
  return status === "FILLED" ? "filled" : status === "PARTIALLY_FILLED" ? "partial" : status === "CANCELED" || status === "EXPIRED" ? "cancelled" : status === "REJECTED" ? "rejected" : "submitted";
}
function unlockState(status: string) {
  return status === "FILLED" ? "exchange_filled" : status === "PARTIALLY_FILLED" ? "exchange_partial" : status === "CANCELED" || status === "EXPIRED" ? "exchange_cancelled" : status === "REJECTED" ? "exchange_rejected" : "exchange_pending";
}
function credentials(connection: { userId: unknown; provider: string; market: string; apiKeyCiphertext: string; apiSecretCiphertext: string; apiPassphraseCiphertext?: string | null; apiKeyVersion?: string | null }) {
  const prefix = String(connection.userId) + ":" + connection.provider + ":" + (connection.market === "futures" ? "futures:" : "");
  return {
    apiKey: decryptExchangeCredential(connection.apiKeyCiphertext, prefix + "apiKey"),
    apiSecret: decryptExchangeCredential(connection.apiSecretCiphertext, prefix + "apiSecret"),
    passphrase: connection.apiPassphraseCiphertext ? decryptExchangeCredential(connection.apiPassphraseCiphertext, prefix + "passphrase") : undefined,
    keyVersion: connection.apiKeyVersion ?? undefined,
  };
}
async function persistFills(input: {
  orderId: string; userId: string; connectionId: string; provider: string; market: "spot" | "futures"; symbol: string;
  fills: Array<{ id: string; orderId: string; side: "BUY" | "SELL"; qty: string; price: string; quoteQty: string; commission: string; commissionAsset: string; realizedPnl: string | null; time: number }>;
}) {
  if (!input.fills.length) return;
  await TradeFill.bulkWrite(input.fills.map(fill => ({
    updateOne: {
      filter: { connectionId: new mongoose.Types.ObjectId(input.connectionId), market: input.market, symbol: input.symbol, exchangeTradeId: fill.id },
      update: { $setOnInsert: { userId: new mongoose.Types.ObjectId(input.userId), connectionId: new mongoose.Types.ObjectId(input.connectionId), orderId: new mongoose.Types.ObjectId(input.orderId), provider: input.provider, market: input.market, symbol: input.symbol, exchangeTradeId: fill.id, exchangeOrderId: fill.orderId, side: fill.side, quantity: fill.qty, price: fill.price, quoteQuantity: fill.quoteQty, commission: fill.commission, commissionAsset: fill.commissionAsset, realizedPnl: fill.realizedPnl, tradedAt: new Date(fill.time) } },
      upsert: true,
    },
  })), { ordered: false });
}

export async function trackOneOrder(orderId: string, ownerId?: string) {
  await connectDB();
  const now = new Date(), leaseId = randomUUID();
  const order = await Order.findOneAndUpdate({
    _id: orderId, ...(ownerId ? { userId: ownerId } : {}), source: { $in: ["approval", "autopilot"] },
    $or: [{ trackLeaseUntil: null }, { trackLeaseUntil: { $lt: now } }],
  }, { $set: { trackLeaseUntil: new Date(now.getTime() + 270_000), trackLeaseId: leaseId } }, { returnDocument: "after" }).lean();
  if (!order) return { state: "busy" };
  const provider = order.exchange.replace(/_(spot|futures)$/, "") as ExchangeProviderId;
  const baseFilter = { _id: order._id, userId: order.userId, trackLeaseId: leaseId };
  try {
    await requireTradeTrackingIndexes();
    const connection = await ExchangeConnection.findOne({ _id: order.connectionId, userId: order.userId, provider, market: order.market, environment: "live", status: "connected" }).select("+apiKeyCiphertext +apiSecretCiphertext +apiPassphraseCiphertext userId provider market apiKeyVersion").lean();
    if (!connection) throw new Error("Exchange connection is unavailable; reconnect it to resume tracking.");
    const key = credentials(connection);
    if (provider !== "binance" && order.market === "futures") {
      await Order.updateOne(baseFilter, { $set: { trackingStatus: "unsupported", trackingError: "Live Futures lifecycle tracking is not certified for this exchange.", nextTrackAt: new Date(now.getTime() + 24 * 60 * 60_000) }, $unset: { trackLeaseUntil: 1, trackLeaseId: 1 } });
      if (order.source === "autopilot") await AutopilotProfile.updateOne({ userId: order.userId, provider, status: "running" }, { $set: { status: "emergency_stopped", emergencyStoppedAt: now, lastDecision: "Futures position tracking is not certified for this exchange." }, $inc: { revision: 1 } });
      return { state: "unsupported" };
    }
    if (provider === "binance") {
      const snapshot = await getBinanceTrackingSnapshot({ market: order.market, credentials: key, symbol: order.symbol, clientOrderId: order.clientOrderId, exchangeOrderId: order.exchangeOrderId ?? null, stopOrderId: order.stopOrderId, targetOrderId: order.targetOrderId, createdAt: order.createdAt, accountTradeFromId: order.lastAccountTradeId, accountTradeSince: order.lastAccountSyncAt });
      const entryFills = snapshot.fills.map(fill => ({ ...fill, id: fill.id }));
      await persistFills({ orderId: String(order._id), userId: String(order.userId), connectionId: String(connection._id), provider, market: order.market, symbol: order.symbol, fills: entryFills });
      if (order.market === "futures") await persistFills({ orderId: String(order._id), userId: String(order.userId), connectionId: String(connection._id), provider, market: "futures", symbol: order.symbol, fills: snapshot.accountTrades });
      const averageFillPrice = Number(snapshot.quantity) > 0 ? Number(snapshot.quote) / Number(snapshot.quantity) : null;
      if (order.market === "spot") {
        const updated = await Order.updateOne(baseFilter, { $set: { status: orderState(snapshot.status), exchangeOrderId: snapshot.exchangeOrderId, filledQuantity: snapshot.quantity, filledQuoteAmount: snapshot.quote, averageFillPrice, trackingStatus: "current", trackingError: null, lastTrackedAt: now, nextTrackAt: new Date(now.getTime() + (snapshot.status === "NEW" || snapshot.status === "PARTIALLY_FILLED" ? 60_000 : 24 * 60 * 60_000)), trackAttempts: 0 } });
        if (updated.matchedCount !== 1) throw new Error("Tracking lease expired before Spot reconciliation.");
        if (order.approvalUnlockId) await ApprovalUnlock.updateOne({ _id: order.approvalUnlockId, userId: order.userId }, { $set: { status: unlockState(snapshot.status), exchangeOrderStatus: snapshot.status, executedQuantity: Number(snapshot.quantity), executedQuoteQuantity: Number(snapshot.quote), executionPrice: averageFillPrice } });
        await Order.updateOne(baseFilter, { $unset: { trackLeaseUntil: 1, trackLeaseId: 1 } });
        return { state: "current" };
      }
      const storedFills = await TradeFill.find({ orderId: order._id, userId: order.userId, market: "futures" }).select("exchangeTradeId exchangeOrderId side quantity commission commissionAsset realizedPnl").lean();
      const accountFills = storedFills.map(fill => ({ id: fill.exchangeTradeId, orderId: fill.exchangeOrderId, side: fill.side, qty: fill.quantity, commission: fill.commission, commissionAsset: fill.commissionAsset ?? "", realizedPnl: fill.realizedPnl ?? null }));
      const historyComplete = order.lastAccountSyncAt ? Boolean(order.accountHistoryComplete) : snapshot.complete;
      const latestTradeId = snapshot.accountTrades.reduce<string | null>((latest, fill) => latest === null || BigInt(fill.id) > BigInt(latest) ? fill.id : latest, order.lastAccountTradeId ?? null);
      const projection = projectFuturesTrade({
        side: order.side, entryOrderId: snapshot.exchangeOrderId, entryQuantity: snapshot.quantity,
        entryFills: snapshot.fills, accountFills,
        position: snapshot.position ? { quantity: snapshot.position.quantity, unrealized: snapshot.position.unrealized } : null,
        stopStatus: snapshot.stopStatus, targetStatus: snapshot.targetStatus, historyComplete,
      });
      const attributed = projection.attributed && Number(snapshot.quantity) > 0;
      const closed = projection.closed && attributed;
      const noFillTerminal = Number(snapshot.quantity) === 0 && ["CANCELED", "EXPIRED", "REJECTED"].includes(snapshot.status);
      const pendingEntry = Number(snapshot.quantity) === 0 && !noFillTerminal;
      const residualProtection = closed && (["NEW", "PENDING"].includes(snapshot.stopStatus ?? "") || ["NEW", "PENDING"].includes(snapshot.targetStatus ?? ""));
      const releasePositionGuard = (closed && !residualProtection) || noFillTerminal;
      const trackingStatus = pendingEntry ? "pending" : !attributed ? "attribution_uncertain" : closed ? "closed" : "current";
      const protection = projection.protection;
      const error = residualProtection ? "The position is closed but a protective order remains active at Binance. Cancel it before opening another trade in this market." : !attributed && !noFillTerminal && !pendingEntry ? "Position exposure cannot be attributed exclusively to this trade. Verify the account at Binance." : protection === "failed" && !closed && !pendingEntry ? "Stop-loss or take-profit is not active at Binance." : null;
      const grossRealized = attributed ? projection.realized : null;
      const grossUnrealized = attributed ? projection.unrealized : null;
      const refreshFunding = attributed && (!order.lastFundingAt || now.getTime() - order.lastFundingAt.getTime() > 15 * 60_000 || closed && !order.closedAt);
      const funding = refreshFunding ? await getBinanceFunding(key, order.symbol, order.createdAt) : { amount: order.fundingQuote ?? "0", complete: order.fundingQuote !== null };
      const pnlComplete = attributed && grossRealized !== null && projection.feesQuote !== null && funding.complete;
      const netPnl = pnlComplete ? decimalAdd([grossRealized!, grossUnrealized ?? "0", "-" + projection.feesQuote!, funding.amount]) : null;
      const finalSweepDone = (closed || noFillTerminal) && order.closedAt && now.getTime() - order.closedAt.getTime() > 3 * 24 * 60 * 60_000 && !residualProtection;
      const next = finalSweepDone ? new Date("2100-01-01T00:00:00.000Z") : new Date(now.getTime() + (closed || noFillTerminal ? 24 * 60 * 60_000 : 60_000));
      const updated = await Order.updateOne(baseFilter, { $set: { status: orderState(snapshot.status), exchangeOrderId: snapshot.exchangeOrderId, filledQuantity: snapshot.quantity, filledQuoteAmount: snapshot.quote, averageFillPrice, trackingStatus: noFillTerminal ? "closed" : trackingStatus, trackingError: error, lastTrackedAt: now, nextTrackAt: next, positionQuantity: attributed ? projection.quantity : null, markPrice: attributed && snapshot.position ? Number(snapshot.position.markPrice) : null, realizedPnl: grossRealized, unrealizedPnl: grossUnrealized, feesQuote: projection.feesQuote, fundingQuote: funding.complete ? funding.amount : null, lastFundingAt: refreshFunding ? now : order.lastFundingAt, netPnl, pnlComplete, protectionStatus: protection, closedAt: closed || noFillTerminal ? order.closedAt ?? now : null, trackAttempts: 0, lastAccountTradeId: latestTradeId, lastAccountSyncAt: now, accountHistoryComplete: historyComplete } });
      if (updated.matchedCount !== 1) throw new Error("Tracking lease expired before Futures reconciliation.");
      if (order.approvalUnlockId) await ApprovalUnlock.updateOne({ _id: order.approvalUnlockId, userId: order.userId }, { $set: { status: closed ? projection.closeReason : unlockState(snapshot.status), exchangeOrderStatus: snapshot.status, executedQuantity: Number(snapshot.quantity), executedQuoteQuantity: Number(snapshot.quote), executionPrice: averageFillPrice, markPrice: attributed && snapshot.position ? Number(snapshot.position.markPrice) : null, pnlUsdt: netPnl === null ? null : Number(netPnl), pnlPct: netPnl === null || !order.marginAmount ? null : Number(netPnl) / order.marginAmount * 100, protectionStatus: protection, ...(closed ? { closedAt: order.closedAt ?? now } : {}) } });
      if (order.source === "autopilot") {
        await AutopilotExecution.updateOne({ orderId: order._id, userId: order.userId }, { $set: { status: noFillTerminal ? "rejected" : closed ? projection.closeReason : protection === "failed" ? "protection_failed" : snapshot.status === "FILLED" ? "filled" : snapshot.status === "PARTIALLY_FILLED" ? "partial" : "submitted", protectionStatus: protection, pnlUsdt: netPnl === null ? null : Number(netPnl), pnlPct: netPnl === null || !order.marginAmount ? null : Number(netPnl) / order.marginAmount * 100, ...(closed ? { closedAt: order.closedAt ?? now } : {}) } });
        if ((!attributed && !pendingEntry && !noFillTerminal) || (protection === "failed" && !closed && !pendingEntry)) await AutopilotProfile.updateOne({ userId: order.userId, provider, status: "running" }, { $set: { status: "emergency_stopped", emergencyStoppedAt: now, lastDecision: error ?? "Exchange tracking needs review." }, $inc: { revision: 1 } });
      }
      await Order.updateOne(baseFilter, { $unset: { trackLeaseUntil: 1, trackLeaseId: 1, ...(releasePositionGuard ? { positionGuardKey: 1 } : {}) } });
      return { state: trackingStatus };
    }
    const spot = await getSpotOrder({ provider, credentials: key, symbol: order.symbol, clientOrderId: order.clientOrderId, orderId: order.exchangeOrderId });
    const qty = Number(spot.executedQty), quote = Number(spot.cumulativeQuoteQty);
    const updated = await Order.updateOne(baseFilter, { $set: { status: orderState(spot.status), exchangeOrderId: spot.orderId, filledQuantity: spot.executedQty, filledQuoteAmount: spot.cumulativeQuoteQty, averageFillPrice: qty > 0 ? quote / qty : null, trackingStatus: "current", trackingError: "Exchange order status verified; fill fees and position P&L are unavailable for this provider.", lastTrackedAt: now, nextTrackAt: new Date(now.getTime() + (spot.status === "NEW" || spot.status === "PARTIALLY_FILLED" ? 60_000 : 24 * 60 * 60_000)), trackAttempts: 0 } });
    if (updated.matchedCount !== 1) throw new Error("Tracking lease expired before Spot reconciliation.");
    if (order.approvalUnlockId) await ApprovalUnlock.updateOne({ _id: order.approvalUnlockId, userId: order.userId }, { $set: { status: unlockState(spot.status), exchangeOrderStatus: spot.status, executedQuantity: qty, executedQuoteQuantity: quote, executionPrice: qty > 0 ? quote / qty : null } });
    await Order.updateOne(baseFilter, { $unset: { trackLeaseUntil: 1, trackLeaseId: 1 } });
    return { state: "current" };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "Exchange tracking failed.";
    const attempts = (order.trackAttempts ?? 0) + 1;
    const retryMs = Math.min(60 * 60_000, 60_000 * 2 ** Math.min(attempts, 6));
    await Order.updateOne(baseFilter, { $set: { trackingStatus: "stale", trackingError: message, nextTrackAt: new Date(now.getTime() + retryMs), trackAttempts: attempts }, $unset: { trackLeaseUntil: 1, trackLeaseId: 1 } });
    if (order.source === "autopilot") await AutopilotProfile.updateOne({ userId: order.userId, provider, status: "running" }, { $set: { status: "emergency_stopped", emergencyStoppedAt: now, lastDecision: "Exchange tracking is stale: " + message }, $inc: { revision: 1 } });
    return { state: "stale", error: message };
  }
}

export async function runTradeTracking(limit = 12) {
  await connectDB();
  const due = await Order.find({ source: { $in: ["approval", "autopilot"] }, $and: [{ $or: [{ nextTrackAt: { $lte: new Date() } }, { nextTrackAt: { $exists: false } }] }, { $or: [{ trackLeaseUntil: null }, { trackLeaseUntil: { $lt: new Date() } }] }], trackingStatus: { $nin: ["unsupported"] } }).sort({ nextTrackAt: 1 }).limit(Math.min(30, limit)).select("_id").lean();
  const results = [];
  for (let index = 0; index < due.length; index += 3) results.push(...await Promise.all(due.slice(index, index + 3).map(order => trackOneOrder(String(order._id)))));
  return { processed: results.length, current: results.filter(item => item.state === "current" || item.state === "closed").length, attention: results.filter(item => item.state === "stale" || item.state === "attribution_uncertain" || item.state === "unsupported").length };
}
