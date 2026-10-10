import { createHash, createHmac } from "node:crypto";
import type { ExchangeCredentials } from "@/lib/exchange-adapters";
import type { ExchangeProviderId } from "@/lib/exchange-catalog";
import { futuresNotional, validateFuturesExecutionConfig, type FuturesExecutionConfig } from "@/lib/exchange-futures-policy";
import { signBinanceQuery } from "@/lib/binance-spot";

export type FuturesOrderStatus = "NEW" | "PARTIALLY_FILLED" | "FILLED" | "CANCELED" | "REJECTED" | "UNKNOWN";
export type FuturesOrderResult = {
  entryOrderId: string;
  clientOrderId: string;
  status: FuturesOrderStatus;
  executedQty: string;
  averageFillPrice: number | null;
  stopOrderId: string;
  targetOrderId: string;
  protectionStatus: "active" | "failed";
};
export type FuturesPlaceInput = {
  provider: ExchangeProviderId;
  credentials: ExchangeCredentials;
  symbol: string;
  side: "BUY" | "SELL";
  marginAmountUsdt: number;
  referencePrice: number;
  stopPrice: number;
  targetPrice: number;
  clientOrderId: string;
  config: FuturesExecutionConfig;
};

export class FuturesOrderError extends Error {
  readonly status: number;
  readonly executionUnknown: boolean;
  readonly partialResult?: Partial<FuturesOrderResult>;
  constructor(message: string, status = 502, executionUnknown = false, partialResult?: Partial<FuturesOrderResult>) {
    super(message); this.status = status; this.executionUnknown = executionUnknown; this.partialResult = partialResult;
  }
}

const decimal = (value: number) => value.toFixed(12).replace(/0+$/, "").replace(/\.$/, "");
function hmac(algorithm: string, secret: string | Buffer, value: string, encoding: "hex" | "base64" = "hex") { return createHmac(algorithm, secret).update(value).digest(encoding); }
function places(value: string) { const normalized = value.replace(/0+$/, ""); return normalized.includes(".") ? normalized.length - normalized.indexOf(".") - 1 : 0; }
function floorIncrement(value: number, increment: string) { const step = Number(increment); if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(step) || step <= 0) throw new FuturesOrderError("The exchange returned invalid futures sizing rules."); const factor = 10 ** places(increment); return (Math.floor((value * factor + 1e-9) / (step * factor)) * step).toFixed(places(increment)); }
function mapStatus(value: unknown): FuturesOrderStatus { const status = String(value ?? "").toUpperCase(); if (["FILLED", "CLOSED"].includes(status)) return "FILLED"; if (["PARTIALLY_FILLED", "PARTIALLYFILLED", "PARTIAL"].includes(status)) return "PARTIALLY_FILLED"; if (["CANCELLED", "CANCELED", "EXPIRED", "DEACTIVATED"].includes(status)) return "CANCELED"; if (["REJECTED", "FAILED"].includes(status)) return "REJECTED"; if (["NEW", "CREATED", "OPEN", "UNTRIGGERED"].includes(status)) return "NEW"; return "UNKNOWN"; }
function validate(input: FuturesPlaceInput) { if (!/^[A-Z0-9]{5,20}$/.test(input.symbol) || !/^[A-Za-z0-9_-]{1,32}$/.test(input.clientOrderId) || !Number.isFinite(input.referencePrice) || input.referencePrice <= 0 || !Number.isFinite(input.stopPrice) || !Number.isFinite(input.targetPrice)) throw new FuturesOrderError("Invalid Futures execution request.", 400); const config = validateFuturesExecutionConfig(input.provider, input.config); if (!config.allowed) throw new FuturesOrderError(config.reason, 400); const long = input.side === "BUY"; if ((long && !(input.stopPrice < input.referencePrice && input.targetPrice > input.referencePrice)) || (!long && !(input.stopPrice > input.referencePrice && input.targetPrice < input.referencePrice))) throw new FuturesOrderError("Stop-loss and take-profit prices are invalid for this trade direction.", 409); return futuresNotional(input.marginAmountUsdt, input.config.leverage); }

async function request(url: string, init: RequestInit, provider: string, submission = false) {
  let response: Response;
  try { response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(12_000) }); }
  catch { throw new FuturesOrderError(submission ? provider + " did not confirm the Futures request. Do not retry until the order is reconciled." : provider + " could not be reached.", 503, submission); }
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) { const message = typeof payload?.msg === "string" ? payload.msg : typeof payload?.retMsg === "string" ? payload.retMsg : provider + " rejected the request."; throw new FuturesOrderError(message.slice(0, 220), response.status === 429 ? 429 : response.status >= 500 ? 503 : 409, submission && response.status >= 500); }
  return payload ?? {};
}

async function binanceSigned(input: FuturesPlaceInput, path: string, params: Record<string, string>, submission = false) {
  const query = new URLSearchParams({ ...params, recvWindow: "5000", timestamp: String(Date.now()) }).toString();
  return request(`https://fapi.binance.com${path}?${query}&signature=${signBinanceQuery(query, input.credentials.apiSecret)}`, { method: "POST", headers: { "X-MBX-APIKEY": input.credentials.apiKey } }, "Binance Futures", submission);
}
async function placeBinance(input: FuturesPlaceInput, notional: number): Promise<FuturesOrderResult> {
  const info = await request(`https://fapi.binance.com/fapi/v1/exchangeInfo?symbol=${encodeURIComponent(input.symbol)}`, {}, "Binance Futures");
  const row = Array.isArray(info.symbols) ? info.symbols[0] as Record<string, unknown> : null; const filters = Array.isArray(row?.filters) ? row.filters as Record<string, unknown>[] : [];
  const lot = filters.find(item => item.filterType === "MARKET_LOT_SIZE") ?? filters.find(item => item.filterType === "LOT_SIZE"); if (!lot) throw new FuturesOrderError("Binance Futures did not return quantity rules.");
  const quantity = floorIncrement(notional / input.referencePrice, String(lot.stepSize ?? "")); if (Number(quantity) < Number(lot.minQty ?? 0)) throw new FuturesOrderError("This position is below Binance Futures minimum size.", 409);
  await binanceSigned(input, "/fapi/v1/leverage", { symbol: input.symbol, leverage: String(input.config.leverage) });
  try { await binanceSigned(input, "/fapi/v1/marginType", { symbol: input.symbol, marginType: input.config.marginMode.toUpperCase() }); } catch (error) { if (!(error instanceof FuturesOrderError) || !/no need to change/i.test(error.message)) throw error; }
  const entry = await binanceSigned(input, "/fapi/v1/order", { symbol: input.symbol, side: input.side, type: "MARKET", quantity, newClientOrderId: input.clientOrderId, newOrderRespType: "RESULT", positionSide: "BOTH" }, true);
  const entryOrderId = String(entry.orderId ?? ""); if (!entryOrderId) throw new FuturesOrderError("Binance accepted no identifiable entry order.", 503, true);
  const closeSide = input.side === "BUY" ? "SELL" : "BUY"; const workingType = input.config.triggerPriceType === "mark" ? "MARK_PRICE" : "CONTRACT_PRICE";
  const base = { algoType: "CONDITIONAL", symbol: input.symbol, side: closeSide, closePosition: "true", positionSide: "BOTH", workingType };
  let stopOrderId = ""; let targetOrderId = "";
  try {
    const stop = await binanceSigned(input, "/fapi/v1/algoOrder", { ...base, type: "STOP_MARKET", triggerPrice: decimal(input.stopPrice), clientAlgoId: (input.clientOrderId + "S").slice(0, 32) }, true); stopOrderId = String(stop.algoId ?? "");
    const target = await binanceSigned(input, "/fapi/v1/algoOrder", { ...base, type: "TAKE_PROFIT_MARKET", triggerPrice: decimal(input.targetPrice), clientAlgoId: (input.clientOrderId + "T").slice(0, 32) }, true); targetOrderId = String(target.algoId ?? "");
  } catch { throw new FuturesOrderError("Entry was accepted, but Binance protection could not be fully confirmed. Manage this position immediately.", 503, true, { entryOrderId, clientOrderId: input.clientOrderId, stopOrderId, targetOrderId, protectionStatus: "failed" }); }
  return { entryOrderId, clientOrderId: String(entry.clientOrderId ?? input.clientOrderId), status: mapStatus(entry.status), executedQty: String(entry.executedQty ?? quantity), averageFillPrice: Number(entry.avgPrice ?? 0) || null, stopOrderId, targetOrderId, protectionStatus: stopOrderId && targetOrderId ? "active" : "failed" };
}

function bybitHeaders(input: FuturesPlaceInput, payload: string) { const timestamp = String(Date.now()), window = "5000"; return { "X-BAPI-API-KEY": input.credentials.apiKey, "X-BAPI-TIMESTAMP": timestamp, "X-BAPI-RECV-WINDOW": window, "X-BAPI-SIGN": hmac("sha256", input.credentials.apiSecret, `${timestamp}${input.credentials.apiKey}${window}${payload}`), "Content-Type": "application/json" }; }
async function bybitPost(input: FuturesPlaceInput, path: string, body: Record<string, unknown>, submission = false) { const text = JSON.stringify(body); const payload = await request(`https://api.bybit.com${path}`, { method: "POST", headers: bybitHeaders(input, text), body: text }, "Bybit", submission); if (payload.retCode !== 0) throw new FuturesOrderError(String(payload.retMsg ?? "Bybit rejected the request."), 409, submission); return payload.result as Record<string, unknown> | undefined; }
async function placeBybit(input: FuturesPlaceInput, notional: number): Promise<FuturesOrderResult> {
  const info = await request(`https://api.bybit.com/v5/market/instruments-info?category=linear&symbol=${encodeURIComponent(input.symbol)}`, {}, "Bybit"); const result = info.result as { list?: Array<Record<string, unknown>> } | undefined; const lot = result?.list?.[0]?.lotSizeFilter as Record<string, unknown> | undefined; if (!lot) throw new FuturesOrderError("Bybit did not return linear-contract sizing rules.");
  const quantity = floorIncrement(notional / input.referencePrice, String(lot.qtyStep ?? "")); if (Number(quantity) < Number(lot.minOrderQty ?? 0)) throw new FuturesOrderError("This position is below Bybit minimum size.", 409);
  await bybitPost(input, "/v5/position/set-leverage", { category: "linear", symbol: input.symbol, buyLeverage: String(input.config.leverage), sellLeverage: String(input.config.leverage) });
  const trigger = input.config.triggerPriceType === "mark" ? "MarkPrice" : "LastPrice";
  const entry = await bybitPost(input, "/v5/order/create", { category: "linear", symbol: input.symbol, side: input.side === "BUY" ? "Buy" : "Sell", orderType: "Market", qty: quantity, positionIdx: 0, orderLinkId: input.clientOrderId, reduceOnly: false, takeProfit: decimal(input.targetPrice), stopLoss: decimal(input.stopPrice), tpTriggerBy: trigger, slTriggerBy: trigger, tpslMode: "Full", tpOrderType: "Market", slOrderType: "Market" }, true);
  const entryOrderId = String(entry?.orderId ?? ""); if (!entryOrderId) throw new FuturesOrderError("Bybit accepted no identifiable entry order.", 503, true);
  return { entryOrderId, clientOrderId: input.clientOrderId, status: "NEW", executedQty: "0", averageFillPrice: null, stopOrderId: "attached:" + entryOrderId, targetOrderId: "attached:" + entryOrderId, protectionStatus: "active" };
}

function okxHeaders(input: FuturesPlaceInput, method: "GET" | "POST", path: string, body = "") { const timestamp = new Date().toISOString(); return { "OK-ACCESS-KEY": input.credentials.apiKey, "OK-ACCESS-SIGN": hmac("sha256", input.credentials.apiSecret, `${timestamp}${method}${path}${body}`, "base64"), "OK-ACCESS-TIMESTAMP": timestamp, "OK-ACCESS-PASSPHRASE": input.credentials.passphrase ?? "", "Content-Type": "application/json" }; }
async function okxPost(input: FuturesPlaceInput, path: string, value: Record<string, unknown>, submission = false) { const body = JSON.stringify(value); const payload = await request(`https://www.okx.com${path}`, { method: "POST", headers: okxHeaders(input, "POST", path, body), body }, "OKX", submission); const row = Array.isArray(payload.data) ? payload.data[0] as Record<string, unknown> : undefined; if (payload.code !== "0" || (row?.sCode && row.sCode !== "0")) throw new FuturesOrderError(String(row?.sMsg ?? payload.msg ?? "OKX rejected the request."), 409, submission); return row ?? {}; }
async function placeOkx(input: FuturesPlaceInput, notional: number): Promise<FuturesOrderResult> {
  const instId = input.symbol.replace(/USDT$/, "-USDT-SWAP"); const path = `/api/v5/public/instruments?instType=SWAP&instId=${encodeURIComponent(instId)}`; const info = await request(`https://www.okx.com${path}`, {}, "OKX"); const instrument = Array.isArray(info.data) ? info.data[0] as Record<string, unknown> : null; if (!instrument) throw new FuturesOrderError("OKX did not return swap sizing rules.");
  const contractValue = Number(instrument.ctVal ?? 0); const lot = String(instrument.lotSz ?? ""); const size = floorIncrement(notional / (input.referencePrice * contractValue), lot); if (Number(size) < Number(instrument.minSz ?? 0)) throw new FuturesOrderError("This position is below OKX minimum swap size.", 409);
  await okxPost(input, "/api/v5/account/set-leverage", { instId, lever: String(input.config.leverage), mgnMode: input.config.marginMode });
  const trigger = input.config.triggerPriceType; const stopClient = (input.clientOrderId + "S").slice(0, 32), targetClient = (input.clientOrderId + "T").slice(0, 32);
  const entry = await okxPost(input, "/api/v5/trade/order", { instId, tdMode: input.config.marginMode, clOrdId: input.clientOrderId, side: input.side.toLowerCase(), posSide: "net", ordType: "market", sz: size, attachAlgoOrds: [{ attachAlgoClOrdId: targetClient, tpTriggerPx: decimal(input.targetPrice), tpOrdPx: "-1", tpTriggerPxType: trigger, slTriggerPx: decimal(input.stopPrice), slOrdPx: "-1", slTriggerPxType: trigger }] }, true);
  const entryOrderId = String(entry.ordId ?? ""); if (!entryOrderId) throw new FuturesOrderError("OKX accepted no identifiable entry order.", 503, true);
  return { entryOrderId, clientOrderId: input.clientOrderId, status: "NEW", executedQty: "0", averageFillPrice: null, stopOrderId: stopClient, targetOrderId: targetClient, protectionStatus: "active" };
}

function kucoinHeaders(input: FuturesPlaceInput, method: "GET" | "POST", endpoint: string, body = "") { const timestamp = String(Date.now()), secret = input.credentials.apiSecret; return { "KC-API-KEY": input.credentials.apiKey, "KC-API-SIGN": hmac("sha256", secret, `${timestamp}${method}${endpoint}${body}`, "base64"), "KC-API-TIMESTAMP": timestamp, "KC-API-PASSPHRASE": hmac("sha256", secret, input.credentials.passphrase ?? "", "base64"), "KC-API-KEY-VERSION": input.credentials.keyVersion || "3", "Content-Type": "application/json" }; }
async function placeKucoin(input: FuturesPlaceInput, notional: number): Promise<FuturesOrderResult> {
  const symbol = input.symbol === "BTCUSDT" ? "XBTUSDTM" : input.symbol.replace(/USDT$/, "USDTM"); const info = await request(`https://api-futures.kucoin.com/api/v1/contracts/${encodeURIComponent(symbol)}`, {}, "KuCoin Futures"); const contract = info.data as Record<string, unknown> | undefined; if (info.code !== "200000" || !contract) throw new FuturesOrderError("KuCoin Futures did not return contract sizing rules.");
  const multiplier = Number(contract.multiplier ?? 0); const size = Math.floor(notional / (input.referencePrice * multiplier)); if (!Number.isInteger(size) || size < Number(contract.lotSize ?? 1)) throw new FuturesOrderError("This position is below KuCoin Futures minimum size.", 409);
  const bodyValue = { clientOid: input.clientOrderId, symbol, side: input.side.toLowerCase(), type: "market", size, leverage: input.config.leverage, marginMode: input.config.marginMode.toUpperCase(), positionSide: "BOTH", reduceOnly: false, triggerStopUpPrice: decimal(input.side === "BUY" ? input.targetPrice : input.stopPrice), triggerStopDownPrice: decimal(input.side === "BUY" ? input.stopPrice : input.targetPrice), stopPriceType: input.config.triggerPriceType === "mark" ? "MP" : "TP" }; const body = JSON.stringify(bodyValue); const endpoint = "/api/v1/st-orders";
  const payload = await request(`https://api-futures.kucoin.com${endpoint}`, { method: "POST", headers: kucoinHeaders(input, "POST", endpoint, body), body }, "KuCoin Futures", true); const data = payload.data as Record<string, unknown> | undefined; if (payload.code !== "200000" || !data?.orderId) throw new FuturesOrderError(String(payload.msg ?? "KuCoin Futures rejected the order."), 409);
  const orderId = String(data.orderId); return { entryOrderId: orderId, clientOrderId: input.clientOrderId, status: "NEW", executedQty: "0", averageFillPrice: null, stopOrderId: "attached:" + orderId, targetOrderId: "attached:" + orderId, protectionStatus: "active" };
}

function krakenHeaders(input: FuturesPlaceInput, path: string, query: string) { const nonce = String(Date.now()); let secret: Buffer; try { secret = Buffer.from(input.credentials.apiSecret, "base64"); } catch { throw new FuturesOrderError("Kraken Futures secret is not valid base64.", 400); } const digest = createHash("sha256").update(query + nonce + path).digest(); return { APIKey: input.credentials.apiKey, Authent: createHmac("sha512", secret).update(digest).digest("base64"), Nonce: nonce, "Content-Type": "application/x-www-form-urlencoded" }; }
async function krakenPost(input: FuturesPlaceInput, params: Record<string, string>, submission = false) { const path = "/derivatives/api/v3/sendorder"; const query = new URLSearchParams(params).toString(); const payload = await request(`https://futures.kraken.com${path}?${query}`, { method: "POST", headers: krakenHeaders(input, path, query) }, "Kraken Futures", submission); if (payload.result !== "success") throw new FuturesOrderError(String(payload.error ?? "Kraken Futures rejected the order."), 409, submission); return payload.sendStatus as Record<string, unknown> | undefined; }
async function placeKraken(input: FuturesPlaceInput, notional: number): Promise<FuturesOrderResult> {
  const symbol = input.symbol === "BTCUSDT" ? "PF_XBTUSD" : "PF_" + input.symbol.replace("USDT", "USD"); const size = decimal(notional / input.referencePrice); const side = input.side.toLowerCase(); const closeSide = input.side === "BUY" ? "sell" : "buy";
  const entry = await krakenPost(input, { orderType: "mkt", symbol, side, size, cliOrdId: input.clientOrderId }, true); const entryOrderId = String(entry?.order_id ?? entry?.orderId ?? ""); if (!entryOrderId) throw new FuturesOrderError("Kraken Futures accepted no identifiable entry order.", 503, true);
  let stopOrderId = "", targetOrderId = "";
  try { const stop = await krakenPost(input, { orderType: "stp", symbol, side: closeSide, size, stopPrice: decimal(input.stopPrice), reduceOnly: "true", triggerSignal: input.config.triggerPriceType === "mark" ? "mark" : "last", cliOrdId: (input.clientOrderId + "S").slice(0, 32) }, true); stopOrderId = String(stop?.order_id ?? stop?.orderId ?? ""); const target = await krakenPost(input, { orderType: "take_profit", symbol, side: closeSide, size, stopPrice: decimal(input.targetPrice), reduceOnly: "true", triggerSignal: input.config.triggerPriceType === "mark" ? "mark" : "last", cliOrdId: (input.clientOrderId + "T").slice(0, 32) }, true); targetOrderId = String(target?.order_id ?? target?.orderId ?? ""); } catch { throw new FuturesOrderError("Entry was accepted, but Kraken Futures protection could not be fully confirmed. Manage this position immediately.", 503, true, { entryOrderId, clientOrderId: input.clientOrderId, stopOrderId, targetOrderId, protectionStatus: "failed" }); }
  return { entryOrderId, clientOrderId: input.clientOrderId, status: "NEW", executedQty: size, averageFillPrice: null, stopOrderId, targetOrderId, protectionStatus: stopOrderId && targetOrderId ? "active" : "failed" };
}

export async function placeFuturesBracketOrder(input: FuturesPlaceInput): Promise<FuturesOrderResult> {
  const notional = validate(input);
  if (input.provider === "binance") return placeBinance(input, notional);
  if (input.provider === "bybit") return placeBybit(input, notional);
  if (input.provider === "okx") return placeOkx(input, notional);
  if (input.provider === "kraken") return placeKraken(input, notional);
  return placeKucoin(input, notional);
}
