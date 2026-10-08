import "server-only";
import { randomBytes } from "node:crypto";
import { decryptExchangeCredential } from "@/lib/exchange-credentials";
import { getSpotOrder, placeSpotMarketOrder, SpotOrderError, type SpotOrderResult } from "@/lib/exchange-spot-orders";
import { getExchangeProvider, type ExchangeProviderId } from "@/lib/exchange-catalog";
import { notifyUser } from "@/lib/notifications";
import { ApprovalUnlock } from "@/models/ApprovalUnlock";
import { ExchangeConnection } from "@/models/ExchangeConnection";
import { Order } from "@/models/Order";

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

function credentials(connection: { apiKeyCiphertext: string; apiSecretCiphertext: string; apiPassphraseCiphertext?: string | null; apiKeyVersion?: string | null; userId: unknown; provider: ExchangeProviderId }) {
  const userId = String(connection.userId); const provider = connection.provider;
  return {
    apiKey: decryptExchangeCredential(connection.apiKeyCiphertext, `${userId}:${provider}:apiKey`),
    apiSecret: decryptExchangeCredential(connection.apiSecretCiphertext, `${userId}:${provider}:apiSecret`),
    passphrase: connection.apiPassphraseCiphertext ? decryptExchangeCredential(connection.apiPassphraseCiphertext, `${userId}:${provider}:passphrase`) : undefined,
    keyVersion: connection.apiKeyVersion ?? undefined,
  };
}

export async function executeApprovalOnExchange(input: { provider: ExchangeProviderId; userId: string; approvalUnlockId: string; opportunityId: string; symbol: string; side: "BUY" | "SELL"; amountUsdt: number; referencePrice: number }) {
  await Order.init();
  const connection = await ExchangeConnection.findOne({ userId: input.userId, provider: input.provider, market: "spot", environment: "live", status: "connected", access: "spot_trade" }).select("+apiKeyCiphertext +apiSecretCiphertext +apiPassphraseCiphertext userId provider apiKeyVersion");
  const definition = getExchangeProvider(input.provider);
  if (!connection) throw new ApprovalExecutionError(`Connect ${definition.name} with Spot execution access before placing this order.`, 409);
  if (await Order.countDocuments({ userId: input.userId, source: "approval", createdAt: { $gt: new Date(Date.now() - 60_000) } }) >= 5) throw new ApprovalExecutionError("Too many live-order attempts. Wait one minute and try again.", 429);
  const activeKey = `approval:${input.approvalUnlockId}`;
  const existing = await Order.findOne({ activeKey }).lean();
  const key = credentials(connection as Parameters<typeof credentials>[0]);
  if (existing) {
    const existingProvider = existing.exchange.replace(/_spot$/, "") as ExchangeProviderId;
    if (existingProvider !== input.provider) throw new ApprovalExecutionError(`This setup already has a ${getExchangeProvider(existingProvider).name} order. It cannot be submitted to another exchange.`, 409);
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
    order = await Order.create({ userId: input.userId, connectionId: connection._id, approvalUnlockId: input.approvalUnlockId, opportunityId: input.opportunityId, source: "approval", exchange: `${input.provider}_spot`, symbol: input.symbol, side: input.side, quoteAmount: input.amountUsdt, clientOrderId: clientOrderId(input.approvalUnlockId), activeKey, status: "intent" });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new ApprovalExecutionError("This setup already has a live order in progress.", 409);
    throw error;
  }
  try {
    const result = await placeSpotMarketOrder({ provider: input.provider, credentials: key, symbol: input.symbol, side: input.side, quoteAmount: input.amountUsdt, referencePrice: input.referencePrice, clientOrderId: order.clientOrderId });
    const recorded = await persistResult(String(order._id), input.approvalUnlockId, input.provider, result);
    await notifyUser({ userId: input.userId, kind: "exchange", title: `${input.symbol} Spot order ${result.status.toLowerCase().replaceAll("_", " ")}`, body: `${input.side} order ${result.orderId} was accepted by ${definition.name}.`, href: "/dashboard/approval", sourceKey: `${input.provider}-order:${result.orderId}` }).catch(() => undefined);
    return { duplicate: false, ...recorded };
  } catch (error) {
    const uncertain = error instanceof SpotOrderError && error.executionUnknown;
    await Order.updateOne({ _id: order._id }, { $set: { status: uncertain ? "unknown" : "rejected", errorMessage: error instanceof Error ? error.message.slice(0, 300) : "Order failed", resolvedAt: uncertain ? null : new Date() }, ...(uncertain ? {} : { $unset: { activeKey: 1 } }) });
    if (uncertain) await ApprovalUnlock.updateOne({ _id: input.approvalUnlockId, status: "unlocked" }, { $set: { status: "exchange_pending", exchangeProvider: input.provider, exchangeClientOrderId: order.clientOrderId, exchangeOrderStatus: "UNKNOWN", amountUsdt: input.amountUsdt, decidedAt: new Date(), executionNote: `${definition.name} response was uncertain; duplicate execution is blocked until reconciled.` } });
    throw new ApprovalExecutionError(error instanceof Error ? error.message : `${definition.name} could not place the order.`, error instanceof SpotOrderError ? error.status : 503);
  }
}

export async function reconcilePendingApprovalOrders(userId: string) {
  const pending = await Order.find({ userId, source: "approval", status: { $in: ["intent", "unknown", "submitted", "partial"] } }).sort({ createdAt: 1 }).limit(5).lean();
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
