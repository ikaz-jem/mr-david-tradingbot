import "server-only";
import { createHmac } from "node:crypto";
import type { ExchangeCredentials } from "@/lib/exchange-adapters";
import { decimalAdd } from "@/lib/trade-decimal";

type Row = Record<string, unknown>;
export type BinanceTrackedFill = {
  id: string; orderId: string; side: "BUY" | "SELL"; price: string; qty: string;
  quoteQty: string; commission: string; commissionAsset: string;
  realizedPnl: string | null; time: number;
};

function parseRows(value: unknown, label: string): Row[] {
  if (!Array.isArray(value) || !value.every(row => row && typeof row === "object" && !Array.isArray(row))) throw new Error("Binance returned invalid " + label + ".");
  return value as Row[];
}
function numeric(value: unknown, label: string): string {
  const text = String(value ?? "");
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) throw new Error("Binance returned invalid " + label + ".");
  return text;
}
async function signedGet(market: "spot" | "futures", path: string, params: Record<string, string>, credentials: ExchangeCredentials): Promise<unknown> {
  const query = new URLSearchParams({ ...params, recvWindow: "5000", timestamp: String(Date.now()) }).toString();
  const signature = createHmac("sha256", credentials.apiSecret).update(query).digest("hex");
  const host = market === "futures" ? "https://fapi.binance.com" : "https://api.binance.com";
  const response = await fetch(host + path + "?" + query + "&signature=" + signature, {
    headers: { "X-MBX-APIKEY": credentials.apiKey }, cache: "no-store", signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json().catch(() => null) as Row | Row[] | null;
  if (!response.ok) {
    const code = !Array.isArray(body) && body && typeof body === "object" ? body.code : null;
    if (response.status === 429 || response.status === 418) throw new Error("Binance tracking is rate limited.");
    if (code === -2013) throw new Error("Binance has not exposed this order yet.");
    throw new Error("Binance tracking request failed (" + response.status + ").");
  }
  if (body == null) throw new Error("Binance tracking response was empty.");
  return body;
}
function asRow(value: unknown, label: string): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Binance returned invalid " + label + ".");
  return value as Row;
}
function asFill(row: Row, futures: boolean): BinanceTrackedFill {
  const side = futures ? row.side : row.isBuyer === true ? "BUY" : "SELL";
  if (side !== "BUY" && side !== "SELL") throw new Error("Binance returned a trade without a side.");
  const time = Number(row.time);
  if (!Number.isFinite(time) || time <= 0) throw new Error("Binance returned an invalid trade time.");
  return {
    id: String(row.id), orderId: String(row.orderId), side,
    price: numeric(row.price, "trade price"), qty: numeric(row.qty, "trade quantity"),
    quoteQty: numeric(row.quoteQty, "trade quote amount"),
    commission: numeric(row.commission, "trade commission"),
    commissionAsset: String(row.commissionAsset ?? ""),
    realizedPnl: futures ? numeric(row.realizedPnl, "realized P&L") : null, time,
  };
}

export async function getBinanceTrackingSnapshot(input: {
  market: "spot" | "futures"; credentials: ExchangeCredentials; symbol: string;
  clientOrderId: string; exchangeOrderId: string | null; stopOrderId?: string | null;
  targetOrderId?: string | null; createdAt: Date;
  accountTradeFromId?: string | null;
  accountTradeSince?: Date | null;
}) {
  if (!/^[A-Z0-9]{5,20}$/.test(input.symbol) || !/^[A-Za-z0-9_-]{1,36}$/.test(input.clientOrderId)) throw new Error("Invalid stored Binance order identity.");
  const futures = input.market === "futures";
  const orderPath = futures ? "/fapi/v1/order" : "/api/v3/order";
  const order = asRow(await signedGet(input.market, orderPath, { symbol: input.symbol, origClientOrderId: input.clientOrderId }, input.credentials), "order");
  const exchangeOrderId = String(order.orderId ?? "");
  if (!exchangeOrderId || (input.exchangeOrderId && exchangeOrderId !== input.exchangeOrderId) || String(order.clientOrderId) !== input.clientOrderId) throw new Error("Binance order identity does not match the stored order.");
  const status = String(order.status ?? "");
  if (!["NEW", "PARTIALLY_FILLED", "FILLED", "CANCELED", "EXPIRED", "REJECTED"].includes(status)) throw new Error("Binance returned an unknown order status.");
  const quantity = numeric(order.executedQty, "executed quantity");
  const quote = numeric(futures ? order.cumQuote : order.cummulativeQuoteQty, "executed quote amount");
  const tradePath = futures ? "/fapi/v1/userTrades" : "/api/v3/myTrades";
  const tradeRows = parseRows(await signedGet(input.market, tradePath, { symbol: input.symbol, orderId: exchangeOrderId, limit: "1000" }, input.credentials), "order trades");
  if (tradeRows.length === 1000) throw new Error("Order trade history needs pagination before it can be reconciled.");
  const fills = tradeRows.map(row => asFill(row, futures));
  if (fills.some(fill => fill.orderId !== exchangeOrderId)) throw new Error("Binance returned fills for a different order.");
  const entryFillQty = fills.reduce((sum, fill) => sum + Number(fill.qty), 0);
  if (Math.abs(entryFillQty - Number(quantity)) > Math.max(1e-8, Number(quantity) * 1e-7)) throw new Error("Binance order fills do not match the executed quantity.");

  if (!futures) return { status, exchangeOrderId, quantity, quote, fills, position: null, stopStatus: null, targetStatus: null, accountTrades: [] as BinanceTrackedFill[], funding: null as string | null, complete: true };

  const positionRows = parseRows(await signedGet("futures", "/fapi/v3/positionRisk", { symbol: input.symbol }, input.credentials), "position risk");
  const position = positionRows.find(row => row.symbol === input.symbol && row.positionSide === "BOTH") ?? null;
  const stopStatus = input.stopOrderId && /^\d+$/.test(input.stopOrderId) ? String(asRow(await signedGet("futures", "/fapi/v1/algoOrder", { algoId: input.stopOrderId }, input.credentials), "stop order").algoStatus ?? "") : null;
  const targetStatus = input.targetOrderId && /^\d+$/.test(input.targetOrderId) ? String(asRow(await signedGet("futures", "/fapi/v1/algoOrder", { algoId: input.targetOrderId }, input.credentials), "target order").algoStatus ?? "") : null;
  // A cursor avoids re-reading the account's entire history on every poll.
  const start = input.accountTradeSince ? input.accountTradeSince.getTime() - 60_000 : input.createdAt.getTime();
  let fromId: string | null = input.accountTradeFromId ? String(BigInt(input.accountTradeFromId) + 1n) : null;
  const accountTrades: BinanceTrackedFill[] = [];
  if (fromId) {
    for (let page = 0; page < 10; page++) {
      const rows = parseRows(await signedGet("futures", tradePath, { symbol: input.symbol, fromId, limit: "1000" }, input.credentials), "account trades");
      accountTrades.push(...rows.map(row => asFill(row, true)));
      if (rows.length < 1000) break;
      if (page === 9) throw new Error("Binance trade history exceeds the bounded reconciliation window.");
      fromId = String(BigInt(String(rows[rows.length - 1].id)) + 1n);
    }
  } else if (start >= Date.now() - 89 * 24 * 60 * 60_000) {
    for (let windowStart = start; windowStart < Date.now(); windowStart += 6 * 24 * 60 * 60_000) {
      const rows = parseRows(await signedGet("futures", tradePath, { symbol: input.symbol, startTime: String(windowStart), endTime: String(Math.min(Date.now(), windowStart + 6 * 24 * 60 * 60_000 - 1)), limit: "1000" }, input.credentials), "account trades");
      if (rows.length === 1000) throw new Error("Binance trade history window is full and needs a larger backfill.");
      accountTrades.push(...rows.map(row => asFill(row, true)));
    }
  }
  return { status, exchangeOrderId, quantity, quote, fills, position: position && {
    quantity: numeric(position.positionAmt, "position quantity"), entryPrice: numeric(position.entryPrice, "position entry"),
    markPrice: numeric(position.markPrice, "mark price"), unrealized: numeric(position.unRealizedProfit, "unrealized P&L"),
  }, stopStatus, targetStatus, accountTrades, funding: null as string | null, complete: input.createdAt.getTime() >= Date.now() - 89 * 24 * 60 * 60_000 };
}

export async function getBinanceFuturesExposure(credentials: ExchangeCredentials, symbol: string): Promise<string> {
  if (!/^[A-Z0-9]{5,20}$/.test(symbol)) throw new Error("Invalid Futures symbol.");
  const rows = parseRows(await signedGet("futures", "/fapi/v3/positionRisk", { symbol }, credentials), "position risk");
  const position = rows.find(row => row.symbol === symbol && row.positionSide === "BOTH");
  return position ? numeric(position.positionAmt, "position quantity") : "0";
}

export async function getBinanceFunding(credentials: ExchangeCredentials, symbol: string, since: Date): Promise<{ amount: string; complete: boolean }> {
  if (!/^[A-Z0-9]{5,20}$/.test(symbol)) throw new Error("Invalid Futures symbol.");
  const oldest = Date.now() - 89 * 24 * 60 * 60_000;
  if (since.getTime() < oldest) return { amount: "0", complete: false };
  const amounts: string[] = [];
  for (let page = 1; page <= 10; page++) {
    const rows = parseRows(await signedGet("futures", "/fapi/v1/income", { symbol, incomeType: "FUNDING_FEE", startTime: String(since.getTime()), endTime: String(Date.now()), page: String(page), limit: "1000" }, credentials), "funding history");
    for (const row of rows) {
      if (row.asset !== "USDT") return { amount: "0", complete: false };
      amounts.push(numeric(row.income, "funding amount"));
    }
    if (rows.length < 1000) return { amount: decimalAdd(amounts), complete: true };
  }
  return { amount: "0", complete: false };
}
