import "server-only";
import { randomBytes } from "node:crypto";
import { decryptExchangeCredential } from "@/lib/exchange-credentials";
import { getSpotOrder, placeSpotMarketOrder, SpotOrderError, type SpotOrderResult } from "@/lib/exchange-spot-orders";
import { getExchangeProvider, type ExchangeProviderId } from "@/lib/exchange-catalog";
import { notifyUser } from "@/lib/notifications";
import { ApprovalUnlock } from "@/models/ApprovalUnlock";
import { ExchangeConnection } from "@/models/ExchangeConnection";
import { Order } from "@/models/Order";
import { FuturesOrderError, placeFuturesBracketOrder, type FuturesOrderResult } from "@/lib/exchange-futures-orders";
import type { ExchangeMarket, FuturesExecutionConfig } from "@/lib/exchange-futures-policy";

export class ApprovalExecutionError extends Error {
  readonly status: number;
  constructor(message: string, status = 409) { super(message); this.name = "ApprovalExecutionError"; this.status = status; }
}

function clientOrderId(unlockId: string) { return `env${unlockId.slice(-6)}${Date.now().toString(36).slice(-5)}${randomBytes(2).toString("hex")}`; }
function mappedState(status: SpotOrderResult["status"]) { return status === "FILLED" ? "filled" : status === "PARTIALLY_FILLED" ? "partial" : status === "CANCELED" ? "cancelled" : status === "REJECTED" ? "rejected" : "submitted"; }
function unlockStatus(status: SpotOrderResult["status"]) { return status === "FILLED" ? "exchange_filled" : status === "PARTIALLY_FILLED" ? "exchange_partial" : status === "CANCELED" ? "exchange_cancelled" : status === "REJECTED" ? "exchange_rejected" : "exchange_pending"; }

async function persistResult(orderId: string, approvalUnlockId: string, provider: ExchangeProviderId, result: SpotOrderResult) {
  const executedQuantity = Number(result.executedQty) || 0;
  const cumulativeQuoteQuantity = Number(result.cumulativeQuoteQty) || 0;
  const averageFillPrice = executedQuantity > 0 ? cumulativeQuoteQuantity / executedQuantity : null;
  const terminal = ["FILLED", "CANCELED", "REJECTED"].includes(result.status);
  await Promise.all([
    Order.updateOne({ _id: orderId }, { $set: { status: mappedState(result.status), exchangeOrderId: result.orderId, clientOrderId: result.clientOrderId, filledQuantity: result.executedQty, filledQuoteAmount: result.cumulativeQuoteQty, averageFillPrice, errorCode: null, errorMessage: null, resolvedAt: terminal ? new Date() : null } }),
    ApprovalUnlock.updateOne({ _id: approvalUnlockId }, { $set: { status: unlockStatus(result.status), exchangeProvider: provider, exchangeOrderId: result.orderId, exchangeClientOrderId: result.clientOrderId, exchangeOrderStatus: result.status, executedQuantity, executedQuoteQuantity: cumulativeQuoteQuantity, executionPrice: averageFillPrice, markPrice: averageFillPrice, decidedAt: new Date(), executionNote: `${getExchangeProvider(provider).name} Spot market order ${result.status.toLowerCase().replaceAll("_", " ")}.` } }),
  ]);
  return { state: mappedState(result.status), status: result.status, orderId: result.orderId, clientOrderId: result.clientOrderId, executedQuantity, cumulativeQuoteQuantity, averageFillPrice };
}

function credentials(connection: { apiKeyCiphertext: string; apiSecretCiphertext: string; apiPassphraseCiphertext?: string | null; apiKeyVersion?: string | null; userId: unknown; provider: ExchangeProviderId; market?: ExchangeMarket }) {
  const userId = String(connection.userId); const provider = connection.provider;
  const context = (field: string) => connection.market === "futures" ? `${userId}:${provider}:futures:${field}` : `${userId}:${provider}:${field}`;
  return {
    apiKey: decryptExchangeCredential(connection.apiKeyCiphertext, context("apiKey")),
    apiSecret: decryptExchangeCredential(connection.apiSecretCiphertext, context("apiSecret")),
    passphrase: connection.apiPassphraseCiphertext ? decryptExchangeCredential(connection.apiPassphraseCiphertext, context("passphrase")) : undefined,
    keyVersion: connection.apiKeyVersion ?? undefined,
  };
}

async function persistFuturesResult(orderId: string, approvalUnlockId: string, provider: ExchangeProviderId, input: { amountUsdt: number; config: FuturesExecutionConfig }, result: FuturesOrderResult) {
  const filledQuantity = Number(result.executedQty) || 0;
  const state = result.protectionStatus === "failed" ? "protection_failed" : result.status === "FILLED" ? "filled" : result.status === "PARTIALLY_FILLED" ? "partial" : "submitted";
  await Promise.all([
    Order.updateOne({ _id: orderId }, { $set: { status: state, exchangeOrderId: result.entryOrderId, clientOrderId: result.clientOrderId, filledQuantity: result.executedQty, averageFillPrice: result.averageFillPrice, stopOrderId: result.stopOrderId, targetOrderId: result.targetOrderId, protectionStatus: result.protectionStatus, errorCode: null, errorMessage: null, resolvedAt: null } }),
    ApprovalUnlock.updateOne({ _id: approvalUnlockId }, { $set: { status: result.status === "FILLED" ? "exchange_filled" : result.status === "PARTIALLY_FILLED" ? "exchange_partial" : "exchange_pending", exchangeProvider: provider, exchangeMarket: "futures", exchangeOrderId: result.entryOrderId, exchangeClientOrderId: result.clientOrderId, exchangeOrderStatus: result.status, executedQuantity: filledQuantity, executionPrice: result.averageFillPrice, markPrice: result.averageFillPrice, amountUsdt: input.amountUsdt, leverage: input.config.leverage, marginMode: input.config.marginMode, stopOrderId: result.stopOrderId, targetOrderId: result.targetOrderId, protectionStatus: result.protectionStatus, decidedAt: new Date(), executionNote: `${getExchangeProvider(provider).name} Futures position accepted at ${input.config.leverage}x with ${input.config.marginMode} margin and exchange-side TP/SL.` } }),
  ]);
  return { state, status: result.status, orderId: result.entryOrderId, clientOrderId: result.clientOrderId, executedQuantity: filledQuantity, cumulativeQuoteQuantity: 0, averageFillPrice: result.averageFillPrice, protectionStatus: result.protectionStatus };
}

export async function executeApprovalOnExchange(input: { provider: ExchangeProviderId; market?: ExchangeMarket; userId: string; approvalUnlockId: string; opportunityId: string; symbol: string; side: "BUY" | "SELL"; amountUsdt: number; referencePrice: number; stopPrice?: number; targetPrice?: number; futuresConfig?: FuturesExecutionConfig }) {
  await Order.init();
  const market = input.market ?? "spot"; const requiredAccess = market === "futures" ? "futures_trade" : "spot_trade";
  const connection = await ExchangeConnection.findOne({ userId: input.userId, provider: input.provider, market, environment: "live", status: "connected", access: requiredAccess }).select("+apiKeyCiphertext +apiSecretCiphertext +apiPassphraseCiphertext userId provider market apiKeyVersion");
  const definition = getExchangeProvider(input.provider);
  if (!connection) throw new ApprovalExecutionError(`Connect ${definition.name} with ${market === "futures" ? "Futures" : "Spot"} execution access before placing this order.`, 409);
  if (market === "futures" && (!input.futuresConfig || !input.stopPrice || !input.targetPrice)) throw new ApprovalExecutionError("Futures execution requires validated leverage, margin mode, stop-loss, and take-profit.", 400);
  if (await Order.countDocuments({ userId: input.userId, source: "approval", createdAt: { $gt: new Date(Date.now() - 60_000) } }) >= 5) throw new ApprovalExecutionError("Too many live-order attempts. Wait one minute and try again.", 429);
  const activeKey = `approval:${input.approvalUnlockId}`;
  const existing = await Order.findOne({ activeKey }).lean();
  const key = credentials(connection as Parameters<typeof credentials>[0]);
  if (existing) {
    const existingProvider = existing.exchange.replace(/_(spot|futures)$/, "") as ExchangeProviderId;
    if (existingProvider !== input.provider || existing.market !== market) throw new ApprovalExecutionError(`This setup already has a ${getExchangeProvider(existingProvider).name} ${existing.market} order. It cannot be submitted again.`, 409);
    if (market === "futures") throw new ApprovalExecutionError(`This Futures position already exists with status ${existing.status.replaceAll("_", " ")}. Duplicate submission is blocked.`, 409);
    try {
      const result = await getSpotOrder({ provider: existingProvider, credentials: key, symbol: existing.symbol, clientOrderId: existing.clientOrderId, orderId: existing.exchangeOrderId });
      return { duplicate: true, ...(await persistResult(String(existing._id), input.approvalUnlockId, existingProvider, result)) };
    } catch (error) {
      if (["unknown", "intent", "submitted", "partial"].includes(existing.status)) throw new ApprovalExecutionError(`This order has an uncertain ${getExchangeProvider(existingProvider).name} status. It will not be submitted again; refresh later or verify it at the exchange.`, 409);
      throw error;
    }
  }
  let order;
  try {
    order = await Order.create({ userId: input.userId, connectionId: connection._id, approvalUnlockId: input.approvalUnlockId, opportunityId: input.opportunityId, source: "approval", exchange: `${input.provider}_${market}`, market, symbol: input.symbol, side: input.side, quoteAmount: market === "spot" ? input.amountUsdt : input.amountUsdt * (input.futuresConfig?.leverage ?? 1), marginAmount: market === "futures" ? input.amountUsdt : null, leverage: input.futuresConfig?.leverage ?? null, marginMode: input.futuresConfig?.marginMode ?? null, positionMode: input.futuresConfig?.positionMode ?? null, stopPrice: input.stopPrice ?? null, targetPrice: input.targetPrice ?? null, protectionStatus: market === "futures" ? "pending" : "not_applicable", clientOrderId: clientOrderId(input.approvalUnlockId), activeKey, status: "intent" });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new ApprovalExecutionError("This setup already has a live order in progress.", 409);
    throw error;
  }
  try {
    if (market === "futures") {
      const result = await placeFuturesBracketOrder({ provider: input.provider, credentials: key, symbol: input.symbol, side: input.side, marginAmountUsdt: input.amountUsdt, referencePrice: input.referencePrice, stopPrice: input.stopPrice!, targetPrice: input.targetPrice!, clientOrderId: order.clientOrderId, config: input.futuresConfig! });
      const recorded = await persistFuturesResult(String(order._id), input.approvalUnlockId, input.provider, { amountUsdt: input.amountUsdt, config: input.futuresConfig! }, result);
      await notifyUser({ userId: input.userId, kind: "exchange", title: `${input.symbol} Futures position accepted`, body: `${definition.name} accepted the ${input.futuresConfig!.leverage}x position with exchange-side stop-loss and take-profit.`, href: "/dashboard/approval", sourceKey: `${input.provider}-futures:${result.entryOrderId}` }).catch(() => undefined);
      return { duplicate: false, ...recorded };
    }
    const result = await placeSpotMarketOrder({ provider: input.provider, credentials: key, symbol: input.symbol, side: input.side, quoteAmount: input.amountUsdt, referencePrice: input.referencePrice, clientOrderId: order.clientOrderId });
    const recorded = await persistResult(String(order._id), input.approvalUnlockId, input.provider, result);
    await notifyUser({ userId: input.userId, kind: "exchange", title: `${input.symbol} Spot order ${result.status.toLowerCase().replaceAll("_", " ")}`, body: `${input.side} order ${result.orderId} was accepted by ${definition.name}.`, href: "/dashboard/approval", sourceKey: `${input.provider}-order:${result.orderId}` }).catch(() => undefined);
    return { duplicate: false, ...recorded };
  } catch (error) {
    const uncertain = (error instanceof SpotOrderError || error instanceof FuturesOrderError) && error.executionUnknown;
    const partial = error instanceof FuturesOrderError ? error.partialResult : undefined;
    const protectionFailed = Boolean(partial?.entryOrderId);
    await Order.updateOne({ _id: order._id }, { $set: { status: protectionFailed ? "protection_failed" : uncertain ? "unknown" : "rejected", exchangeOrderId: partial?.entryOrderId ?? null, stopOrderId: partial?.stopOrderId ?? null, targetOrderId: partial?.targetOrderId ?? null, protectionStatus: protectionFailed ? "failed" : market === "futures" ? "pending" : "not_applicable", errorMessage: error instanceof Error ? error.message.slice(0, 300) : "Order failed", resolvedAt: uncertain || protectionFailed ? null : new Date() }, ...(uncertain || protectionFailed ? {} : { $unset: { activeKey: 1 } }) });
    if (uncertain || protectionFailed) await ApprovalUnlock.updateOne({ _id: input.approvalUnlockId, status: "unlocked" }, { $set: { status: "exchange_pending", exchangeProvider: input.provider, exchangeMarket: market, exchangeOrderId: partial?.entryOrderId ?? null, exchangeClientOrderId: order.clientOrderId, exchangeOrderStatus: protectionFailed ? "PROTECTION_FAILED" : "UNKNOWN", protectionStatus: protectionFailed ? "failed" : null, stopOrderId: partial?.stopOrderId ?? null, targetOrderId: partial?.targetOrderId ?? null, amountUsdt: input.amountUsdt, leverage: input.futuresConfig?.leverage ?? null, marginMode: input.futuresConfig?.marginMode ?? null, decidedAt: new Date(), executionNote: protectionFailed ? `${definition.name} accepted the entry but protective orders are incomplete. Immediate exchange-side action is required.` : `${definition.name} response was uncertain; duplicate execution is blocked until reconciled.` } });
    throw new ApprovalExecutionError(error instanceof Error ? error.message : `${definition.name} could not place the order.`, error instanceof SpotOrderError || error instanceof FuturesOrderError ? error.status : 503);
  }
}

export async function reconcilePendingApprovalOrders(userId: string) {
  const pending = await Order.find({ userId, source: "approval", market: { $ne: "futures" }, status: { $in: ["intent", "unknown", "submitted", "partial"] } }).sort({ createdAt: 1 }).limit(5).lean();
  if (!pending.length) return;
  const providers = [...new Set(pending.map(order => order.exchange.replace(/_spot$/, "") as ExchangeProviderId))];
  const connections = await ExchangeConnection.find({ userId, provider: { $in: providers }, status: "connected", access: "spot_trade" }).select("+apiKeyCiphertext +apiSecretCiphertext +apiPassphraseCiphertext userId provider apiKeyVersion");
  const connectionByProvider = new Map(connections.map(connection => [connection.provider, connection]));
  await Promise.all(pending.map(async order => {
    const provider = order.exchange.replace(/_spot$/, "") as ExchangeProviderId;
    const connection = connectionByProvider.get(provider);
    if (!connection || !order.approvalUnlockId) return;
    try {
      const result = await getSpotOrder({ provider, credentials: credentials(connection as Parameters<typeof credentials>[0]), symbol: order.symbol, clientOrderId: order.clientOrderId, orderId: order.exchangeOrderId });
      await persistResult(String(order._id), String(order.approvalUnlockId), provider, result);
    } catch { /* Preserve uncertain state; reconciliation never resubmits an order. */ }
  }));
}
