import "server-only";
import { createHash, createHmac } from "node:crypto";
import { getBinanceSpotOrder, placeBinanceSpotMarketOrder } from "@/lib/binance-spot";
import type { ExchangeCredentials } from "@/lib/exchange-adapters";
import type { ExchangeProviderId } from "@/lib/exchange-catalog";

export type SpotOrderResult = {
  orderId: string;
  clientOrderId: string;
  status: "NEW" | "PARTIALLY_FILLED" | "FILLED" | "CANCELED" | "REJECTED";
  executedQty: string;
  cumulativeQuoteQty: string;
};

export class SpotOrderError extends Error {
  readonly status: number;
  readonly executionUnknown: boolean;
  constructor(message: string, status = 502, executionUnknown = false) {
    super(message);
    this.name = "SpotOrderError";
    this.status = status;
    this.executionUnknown = executionUnknown;
  }
}

type PlaceInput = {
  provider: ExchangeProviderId;
  credentials: ExchangeCredentials;
  symbol: string;
  side: "BUY" | "SELL";
  quoteAmount: number;
  referencePrice: number;
  clientOrderId: string;
};

type GetInput = Pick<PlaceInput, "provider" | "credentials" | "symbol" | "clientOrderId"> & { orderId?: string | null };

const providerNames: Record<ExchangeProviderId, string> = { binance: "Binance", bybit: "Bybit", okx: "OKX", kraken: "Kraken", kucoin: "KuCoin" };

function hmac(algorithm: string, secret: string | Buffer, value: string, encoding: "hex" | "base64" = "hex") {
  return createHmac(algorithm, secret).update(value).digest(encoding);
}

function decimal(value: number, places = 8) {
  return value.toFixed(places).replace(/\.?0+$/, "");
}

export function floorToIncrement(value: number, increment: string) {
  const step = Number(increment);
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(step) || step <= 0) throw new SpotOrderError("The exchange returned invalid market sizing rules.");
  const places = Math.min(18, Math.max(0, (increment.split(".")[1] ?? "").replace(/0+$/, "").length));
  return (Math.floor((value + Number.EPSILON) / step) * step).toFixed(places).replace(/\.?0+$/, "");
}

function mapStatus(value: unknown): SpotOrderResult["status"] {
  const status = String(value ?? "").toUpperCase().replaceAll("-", "_");
  if (["FILLED", "DONE", "CLOSED"].includes(status)) return "FILLED";
  if (["PARTIALLY_FILLED", "PARTIALLYFILLED", "PARTIAL_FILL", "PARTIAL"].includes(status)) return "PARTIALLY_FILLED";
  if (["CANCELED", "CANCELLED", "MMP_CANCELED", "EXPIRED", "DEACTIVATED"].includes(status)) return "CANCELED";
  if (["REJECTED", "FAILED"].includes(status)) return "REJECTED";
  return "NEW";
}

async function jsonRequest(url: string, init: RequestInit, provider: ExchangeProviderId, submission = false) {
  try {
    const response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(12_000) });
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok) {
      const message = typeof payload?.msg === "string" ? payload.msg : typeof payload?.message === "string" ? payload.message : `${providerNames[provider]} rejected the order request.`;
      const status = response.status === 401 || response.status === 403 ? 400 : response.status === 429 ? 429 : response.status >= 500 ? 503 : 400;
      throw new SpotOrderError(message, status, submission && response.status >= 500);
    }
    if (!payload) throw new SpotOrderError(`${providerNames[provider]} returned an unreadable response.`, 502, submission);
    return payload;
  } catch (error) {
    if (error instanceof SpotOrderError) throw error;
    throw new SpotOrderError(`${providerNames[provider]} did not confirm the order. Its status must be reconciled before another submission.`, 503, submission);
  }
}

function bybitHeaders(credentials: ExchangeCredentials, queryOrBody: string) {
  const timestamp = String(Date.now()); const recvWindow = "5000";
  return { "X-BAPI-API-KEY": credentials.apiKey, "X-BAPI-TIMESTAMP": timestamp, "X-BAPI-RECV-WINDOW": recvWindow, "X-BAPI-SIGN": hmac("sha256", credentials.apiSecret, `${timestamp}${credentials.apiKey}${recvWindow}${queryOrBody}`), "Content-Type": "application/json" };
}

async function bybitInstrument(symbol: string) {
  const payload = await jsonRequest(`https://api.bybit.com/v5/market/instruments-info?category=spot&symbol=${encodeURIComponent(symbol)}`, {}, "bybit");
  const result = payload.result as { list?: Array<{ lotSizeFilter?: Record<string, string> }> } | undefined;
  const filter = result?.list?.[0]?.lotSizeFilter;
  if (!filter) throw new SpotOrderError("Bybit did not return Spot sizing rules for this market.");
  return filter;
}

async function getBybit(input: GetInput): Promise<SpotOrderResult> {
  const query = `category=spot&orderLinkId=${encodeURIComponent(input.clientOrderId)}`;
  const payload = await jsonRequest(`https://api.bybit.com/v5/order/realtime?${query}`, { headers: bybitHeaders(input.credentials, query) }, "bybit");
  if (payload.retCode !== 0) throw new SpotOrderError(String(payload.retMsg ?? "Bybit could not query this order."), 400);
  const result = payload.result as { list?: Array<Record<string, unknown>> } | undefined;
  const order = result?.list?.[0];
  if (!order) throw new SpotOrderError("Bybit has not exposed this order for reconciliation yet.", 409);
  return { orderId: String(order.orderId ?? input.orderId ?? ""), clientOrderId: String(order.orderLinkId ?? input.clientOrderId), status: mapStatus(order.orderStatus), executedQty: String(order.cumExecQty ?? "0"), cumulativeQuoteQty: String(order.cumExecValue ?? "0") };
}

async function placeBybit(input: PlaceInput): Promise<SpotOrderResult> {
  const filter = await bybitInstrument(input.symbol);
  const qty = input.side === "BUY" ? decimal(input.quoteAmount) : floorToIncrement(input.quoteAmount / input.referencePrice, filter.basePrecision ?? filter.qtyStep ?? "0.00000001");
  if (Number(qty) < Number(input.side === "BUY" ? filter.minOrderAmt ?? "0" : filter.minOrderQty ?? "0")) throw new SpotOrderError("This order is below Bybit's minimum Spot order size.", 400);
  const body = JSON.stringify({ category: "spot", symbol: input.symbol, side: input.side === "BUY" ? "Buy" : "Sell", orderType: "Market", qty, marketUnit: input.side === "BUY" ? "quoteCoin" : "baseCoin", isLeverage: 0, orderFilter: "Order", orderLinkId: input.clientOrderId });
  const payload = await jsonRequest("https://api.bybit.com/v5/order/create", { method: "POST", headers: bybitHeaders(input.credentials, body), body }, "bybit", true);
  if (payload.retCode !== 0) throw new SpotOrderError(String(payload.retMsg ?? "Bybit rejected the order."), 400);
  const result = payload.result as Record<string, unknown> | undefined;
  const orderId = String(result?.orderId ?? "");
  if (!orderId) throw new SpotOrderError("Bybit accepted no identifiable order.", 502, true);
  try { return await getBybit({ ...input, orderId }); } catch { return { orderId, clientOrderId: input.clientOrderId, status: "NEW", executedQty: "0", cumulativeQuoteQty: "0" }; }
}

function okxHeaders(credentials: ExchangeCredentials, method: "GET" | "POST", requestPath: string, body = "") {
  const timestamp = new Date().toISOString();
  return { "OK-ACCESS-KEY": credentials.apiKey, "OK-ACCESS-SIGN": hmac("sha256", credentials.apiSecret, `${timestamp}${method}${requestPath}${body}`, "base64"), "OK-ACCESS-TIMESTAMP": timestamp, "OK-ACCESS-PASSPHRASE": credentials.passphrase ?? "", "Content-Type": "application/json" };
}

async function okxInstrument(symbol: string) {
  const instId = symbol.replace(/USDT$/, "-USDT");
  const payload = await jsonRequest(`https://www.okx.com/api/v5/public/instruments?instType=SPOT&instId=${encodeURIComponent(instId)}`, {}, "okx");
  const item = Array.isArray(payload.data) ? payload.data[0] as Record<string, unknown> | undefined : undefined;
  if (!item) throw new SpotOrderError("OKX did not return Spot sizing rules for this market.");
  return { instId, lotSz: String(item.lotSz ?? ""), minSz: String(item.minSz ?? "0") };
}

async function getOkx(input: GetInput): Promise<SpotOrderResult> {
  const instId = input.symbol.replace(/USDT$/, "-USDT");
  const path = `/api/v5/trade/order?instId=${encodeURIComponent(instId)}&clOrdId=${encodeURIComponent(input.clientOrderId)}`;
  const payload = await jsonRequest(`https://www.okx.com${path}`, { headers: okxHeaders(input.credentials, "GET", path) }, "okx");
  const order = Array.isArray(payload.data) ? payload.data[0] as Record<string, unknown> | undefined : undefined;
  if (payload.code !== "0" || !order) throw new SpotOrderError("OKX has not exposed this order for reconciliation yet.", 409);
  const calculatedQuote = order.accFillSz && order.avgPx ? Number(order.accFillSz) * Number(order.avgPx) : 0;
  return { orderId: String(order.ordId ?? input.orderId ?? ""), clientOrderId: String(order.clOrdId ?? input.clientOrderId), status: mapStatus(order.state), executedQty: String(order.accFillSz ?? "0"), cumulativeQuoteQty: String(order.fillNotionalUsd ?? calculatedQuote) };
}

async function placeOkx(input: PlaceInput): Promise<SpotOrderResult> {
  const market = await okxInstrument(input.symbol);
  const size = input.side === "BUY" ? decimal(input.quoteAmount) : floorToIncrement(input.quoteAmount / input.referencePrice, market.lotSz);
  if (input.side === "SELL" && Number(size) < Number(market.minSz)) throw new SpotOrderError("This order is below OKX's minimum Spot order size.", 400);
  const body = JSON.stringify({ instId: market.instId, tdMode: "cash", clOrdId: input.clientOrderId.slice(0, 32), side: input.side.toLowerCase(), ordType: "market", sz: size, tgtCcy: input.side === "BUY" ? "quote_ccy" : "base_ccy" });
  const path = "/api/v5/trade/order";
  const payload = await jsonRequest(`https://www.okx.com${path}`, { method: "POST", headers: okxHeaders(input.credentials, "POST", path, body), body }, "okx", true);
  const row = Array.isArray(payload.data) ? payload.data[0] as Record<string, unknown> | undefined : undefined;
  if (payload.code !== "0" || !row || row.sCode !== "0") throw new SpotOrderError(String(row?.sMsg ?? payload.msg ?? "OKX rejected the order."), 400);
  const orderId = String(row.ordId ?? "");
  try { return await getOkx({ ...input, orderId }); } catch { return { orderId, clientOrderId: input.clientOrderId.slice(0, 32), status: "NEW", executedQty: "0", cumulativeQuoteQty: "0" }; }
}

function krakenPair(symbol: string) { return symbol === "BTCUSDT" ? "XBTUSDT" : symbol; }

function krakenHeaders(credentials: ExchangeCredentials, path: string, nonce: string, body: string) {
  let decoded: Buffer;
  try { decoded = Buffer.from(credentials.apiSecret, "base64"); } catch { throw new SpotOrderError("The Kraken private key is not valid base64.", 400); }
  const digest = createHash("sha256").update(nonce + body).digest();
  return { "API-Key": credentials.apiKey, "API-Sign": createHmac("sha512", decoded).update(Buffer.concat([Buffer.from(path), digest])).digest("base64"), "Content-Type": "application/x-www-form-urlencoded" };
}

async function krakenPrivate(credentials: ExchangeCredentials, method: string, values: Record<string, string>, submission = false) {
  const path = `/0/private/${method}`; const nonce = String(Date.now() * 1000);
  const body = new URLSearchParams({ nonce, ...values }).toString();
  const payload = await jsonRequest(`https://api.kraken.com${path}`, { method: "POST", headers: krakenHeaders(credentials, path, nonce, body), body }, "kraken", submission);
  if (!Array.isArray(payload.error) || payload.error.length) throw new SpotOrderError(Array.isArray(payload.error) ? payload.error.join("; ") : "Kraken rejected the order request.", 400);
  return payload.result;
}

async function krakenInstrument(symbol: string) {
  const pair = krakenPair(symbol);
  const payload = await jsonRequest(`https://api.kraken.com/0/public/AssetPairs?pair=${encodeURIComponent(pair)}`, {}, "kraken");
  const values = payload.result && typeof payload.result === "object" ? Object.values(payload.result as Record<string, unknown>) : [];
  const item = values[0] as Record<string, unknown> | undefined;
  if (!item) throw new SpotOrderError("Kraken did not return Spot sizing rules for this market.");
  return { pair: String(item.altname ?? pair), increment: `0.${"0".repeat(Math.max(0, Number(item.lot_decimals ?? 8) - 1))}1`, minimum: String(item.ordermin ?? "0") };
}

async function getKraken(input: GetInput): Promise<SpotOrderResult> {
  if (!input.orderId) throw new SpotOrderError("Kraken has not supplied an exchange order ID for reconciliation yet.", 409);
  const result = await krakenPrivate(input.credentials, "QueryOrders", { txid: input.orderId });
  const order = result && typeof result === "object" ? (result as Record<string, Record<string, unknown>>)[input.orderId] : undefined;
  if (!order) throw new SpotOrderError("Kraken has not exposed this order for reconciliation yet.", 409);
  const executed = String(order.vol_exec ?? "0");
  const average = Number(order.price ?? 0);
  return { orderId: input.orderId, clientOrderId: input.clientOrderId, status: mapStatus(order.status), executedQty: executed, cumulativeQuoteQty: decimal((Number(executed) || 0) * average) };
}

async function placeKraken(input: PlaceInput): Promise<SpotOrderResult> {
  const market = await krakenInstrument(input.symbol);
  const isBuy = input.side === "BUY";
  const volume = isBuy ? decimal(input.quoteAmount) : floorToIncrement(input.quoteAmount / input.referencePrice, market.increment);
  if (!isBuy && Number(volume) < Number(market.minimum)) throw new SpotOrderError("This order is below Kraken's minimum Spot order size.", 400);
  const shortClientId = input.clientOrderId.slice(0, 18);
  const result = await krakenPrivate(input.credentials, "AddOrder", { pair: market.pair, type: input.side.toLowerCase(), ordertype: "market", volume, cl_ord_id: shortClientId, ...(isBuy ? { oflags: "viqc" } : {}) }, true) as { txid?: unknown } | undefined;
  const orderId = Array.isArray(result?.txid) ? String(result.txid[0] ?? "") : "";
  if (!orderId) throw new SpotOrderError("Kraken accepted no identifiable order.", 502, true);
  try { return await getKraken({ ...input, clientOrderId: shortClientId, orderId }); } catch { return { orderId, clientOrderId: shortClientId, status: "NEW", executedQty: "0", cumulativeQuoteQty: "0" }; }
}

function kucoinHeaders(credentials: ExchangeCredentials, method: "GET" | "POST", endpoint: string, body = "") {
  const timestamp = String(Date.now()); const secret = credentials.apiSecret;
  return { "KC-API-KEY": credentials.apiKey, "KC-API-SIGN": hmac("sha256", secret, `${timestamp}${method}${endpoint}${body}`, "base64"), "KC-API-TIMESTAMP": timestamp, "KC-API-PASSPHRASE": hmac("sha256", secret, credentials.passphrase ?? "", "base64"), "KC-API-KEY-VERSION": credentials.keyVersion || "3", "Content-Type": "application/json" };
}

async function kucoinInstrument(symbol: string) {
  const market = symbol.replace(/USDT$/, "-USDT");
  const payload = await jsonRequest(`https://api.kucoin.com/api/v2/symbols/${encodeURIComponent(market)}`, {}, "kucoin");
  const item = payload.data as Record<string, unknown> | undefined;
  if (payload.code !== "200000" || !item) throw new SpotOrderError("KuCoin did not return Spot sizing rules for this market.");
  return { market, baseIncrement: String(item.baseIncrement ?? ""), baseMinSize: String(item.baseMinSize ?? "0"), minFunds: String(item.minFunds ?? "0") };
}

async function getKucoin(input: GetInput): Promise<SpotOrderResult> {
  const market = input.symbol.replace(/USDT$/, "-USDT");
  const endpoint = `/api/v1/hf/orders/client-order/${encodeURIComponent(input.clientOrderId)}?symbol=${encodeURIComponent(market)}`;
  const payload = await jsonRequest(`https://api.kucoin.com${endpoint}`, { headers: kucoinHeaders(input.credentials, "GET", endpoint) }, "kucoin");
  const order = payload.data as Record<string, unknown> | undefined;
  if (payload.code !== "200000" || !order) throw new SpotOrderError("KuCoin has not exposed this order for reconciliation yet.", 409);
  const active = Boolean(order.active ?? order.isActive);
  const cancelled = Boolean(order.cancelExist ?? order.cancelled);
  const dealSize = String(order.dealSize ?? "0");
  const size = Number(order.size ?? 0);
  const status = active ? (Number(dealSize) > 0 ? "PARTIALLY_FILLED" : "NEW") : cancelled && Number(dealSize) < size ? "CANCELED" : "FILLED";
  return { orderId: String(order.id ?? order.orderId ?? input.orderId ?? ""), clientOrderId: String(order.clientOid ?? input.clientOrderId), status, executedQty: dealSize, cumulativeQuoteQty: String(order.dealFunds ?? "0") };
}

async function placeKucoin(input: PlaceInput): Promise<SpotOrderResult> {
  const market = await kucoinInstrument(input.symbol);
  const size = floorToIncrement(input.quoteAmount / input.referencePrice, market.baseIncrement);
  if (input.side === "SELL" && Number(size) < Number(market.baseMinSize)) throw new SpotOrderError("This order is below KuCoin's minimum Spot order size.", 400);
  if (input.side === "BUY" && input.quoteAmount < Number(market.minFunds)) throw new SpotOrderError("This order is below KuCoin's minimum Spot order funds.", 400);
  const body = JSON.stringify({ clientOid: input.clientOrderId, symbol: market.market, type: "market", side: input.side.toLowerCase(), ...(input.side === "BUY" ? { funds: decimal(input.quoteAmount) } : { size }) });
  const endpoint = "/api/v1/hf/orders";
  const payload = await jsonRequest(`https://api.kucoin.com${endpoint}`, { method: "POST", headers: kucoinHeaders(input.credentials, "POST", endpoint, body), body }, "kucoin", true);
  const row = payload.data as Record<string, unknown> | undefined;
  if (payload.code !== "200000" || !row?.orderId) throw new SpotOrderError(String(payload.msg ?? "KuCoin rejected the order."), 400);
  const orderId = String(row.orderId);
  try { return await getKucoin({ ...input, orderId }); } catch { return { orderId, clientOrderId: input.clientOrderId, status: "NEW", executedQty: "0", cumulativeQuoteQty: "0" }; }
}

export async function placeSpotMarketOrder(input: PlaceInput): Promise<SpotOrderResult> {
  if (input.provider === "binance") {
    try { const result = await placeBinanceSpotMarketOrder({ apiKey: input.credentials.apiKey, secret: input.credentials.apiSecret, symbol: input.symbol, side: input.side, quoteAmount: input.quoteAmount, referencePrice: input.referencePrice, clientOrderId: input.clientOrderId }); return { orderId: result.orderId, clientOrderId: result.clientOrderId, status: mapStatus(result.status), executedQty: result.executedQty, cumulativeQuoteQty: result.cummulativeQuoteQty }; }
    catch (error) { const value = error as Error & { status?: number; executionUnknown?: boolean }; throw new SpotOrderError(value.message, value.status ?? 502, Boolean(value.executionUnknown)); }
  }
  if (input.provider === "bybit") return placeBybit(input);
  if (input.provider === "okx") return placeOkx(input);
  if (input.provider === "kraken") return placeKraken(input);
  return placeKucoin(input);
}

export async function getSpotOrder(input: GetInput): Promise<SpotOrderResult> {
  if (input.provider === "binance") {
    try { const result = await getBinanceSpotOrder(input.credentials.apiKey, input.credentials.apiSecret, input.symbol, input.clientOrderId); return { orderId: result.orderId, clientOrderId: result.clientOrderId, status: mapStatus(result.status), executedQty: result.executedQty, cumulativeQuoteQty: result.cummulativeQuoteQty }; }
    catch (error) { const value = error as Error & { status?: number; executionUnknown?: boolean }; throw new SpotOrderError(value.message, value.status ?? 502, Boolean(value.executionUnknown)); }
  }
  if (input.provider === "bybit") return getBybit(input);
  if (input.provider === "okx") return getOkx(input);
  if (input.provider === "kraken") return getKraken(input);
  return getKucoin(input);
}
