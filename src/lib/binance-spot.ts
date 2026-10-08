import { createHmac } from "node:crypto";

const BINANCE_BASE = "https://api.binance.com";
type SignedPath = "/sapi/v1/account/apiRestrictions" | "/api/v3/account";

export type BinancePermissions = {
  enableReading: boolean;
  enableWithdrawals: boolean;
  enableInternalTransfer: boolean;
  permitsUniversalTransfer: boolean;
  enableSpotAndMarginTrading: boolean;
  enableMargin: boolean;
  enableFutures: boolean;
  ipRestrict: boolean;
};
export type SpotBalance = { asset: string; free: string; locked: string };

export class BinanceApiError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) { super(message); this.status = status; }
}

export function signBinanceQuery(query: string, secret: string) {
  return createHmac("sha256", secret).update(query).digest("hex");
}

async function signedGet(path: SignedPath, apiKey: string, secret: string, extra: Record<string, string> = {}) {
  const query = new URLSearchParams({ ...extra, recvWindow: "5000", timestamp: String(Date.now()) }).toString();
  const signature = signBinanceQuery(query, secret);
  let response: Response;
  try {
    response = await fetch(`${BINANCE_BASE}${path}?${query}&signature=${signature}`, {
      headers: { "X-MBX-APIKEY": apiKey }, cache: "no-store", signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new BinanceApiError("Binance could not be reached from this server. Check exchange availability and try again.");
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { code?: number } | null;
    if (payload?.code === -2015 || response.status === 401) throw new BinanceApiError("Binance rejected the API key, its permissions, or this server's IP address.", 400);
    if (payload?.code === -1021) throw new BinanceApiError("This server's clock is out of sync with Binance. Try again shortly.");
    if (response.status === 403 || response.status === 451) throw new BinanceApiError("Binance is not available from this server or account location.", 403);
    if (response.status === 429 || response.status === 418) throw new BinanceApiError("Binance rate limited the connection check. Please wait and try again.", 429);
    throw new BinanceApiError("Binance could not verify this connection. Please try again later.");
  }
  return response.json() as Promise<unknown>;
}

export async function getBinancePermissions(apiKey: string, secret: string): Promise<BinancePermissions> {
  const data = await signedGet("/sapi/v1/account/apiRestrictions", apiKey, secret);
  if (!data || typeof data !== "object") throw new BinanceApiError("Binance returned an unexpected permissions response.");
  const permissions = data as Record<string, unknown>;
  const fields = ["enableReading", "enableWithdrawals", "enableInternalTransfer", "permitsUniversalTransfer", "enableSpotAndMarginTrading", "enableMargin", "enableFutures", "ipRestrict"] as const;
  if (fields.some(field => typeof permissions[field] !== "boolean")) throw new BinanceApiError("Binance did not return enough information to verify key permissions.");
  return Object.fromEntries(fields.map(field => [field, permissions[field]])) as BinancePermissions;
}

export function assertReadOnlyBinancePermissions(permissions: BinancePermissions) {
  if (!permissions.enableReading) throw new BinanceApiError("Enable reading on the Binance key before connecting.", 400);
  if (permissions.enableWithdrawals || permissions.enableInternalTransfer || permissions.permitsUniversalTransfer || permissions.enableSpotAndMarginTrading || permissions.enableMargin || permissions.enableFutures) {
    throw new BinanceApiError("Use a read-only key. Disable trading, withdrawals, transfers, margin, and futures permissions before connecting.", 400);
  }
}

export function assertSpotTradingBinancePermissions(permissions: BinancePermissions) {
  if (!permissions.enableReading || !permissions.enableSpotAndMarginTrading) throw new BinanceApiError("Enable reading and Spot trading on the Binance key before connecting.", 400);
  if (permissions.enableWithdrawals || permissions.enableInternalTransfer || permissions.permitsUniversalTransfer || permissions.enableMargin || permissions.enableFutures) throw new BinanceApiError("Disable withdrawals, transfers, margin, and futures. Approval Desk requires only reading and Spot trading.", 400);
}

export function assertFuturesTradingBinancePermissions(permissions: BinancePermissions) {
  if (!permissions.enableReading || !permissions.enableFutures) throw new BinanceApiError("Enable reading and USD-M Futures trading on the Binance key before connecting.", 400);
  if (permissions.enableWithdrawals || permissions.enableInternalTransfer || permissions.permitsUniversalTransfer || permissions.enableSpotAndMarginTrading || permissions.enableMargin) throw new BinanceApiError("Use a dedicated Binance Futures key. Disable withdrawals, transfers, Spot, and Margin permissions.", 400);
}

export type BinanceSpotOrder = { symbol: string; orderId: string; clientOrderId: string; status: string; side: "BUY" | "SELL"; executedQty: string; cummulativeQuoteQty: string };

function parseOrder(value: unknown): BinanceSpotOrder {
  if (!value || typeof value !== "object") throw new BinanceApiError("Binance returned an unexpected order response.");
  const row = value as Record<string, unknown>;
  if (typeof row.symbol !== "string" || (typeof row.orderId !== "number" && typeof row.orderId !== "string") || typeof row.clientOrderId !== "string" || typeof row.status !== "string" || (row.side !== "BUY" && row.side !== "SELL") || typeof row.executedQty !== "string" || typeof row.cummulativeQuoteQty !== "string") throw new BinanceApiError("Binance returned an incomplete order response.");
  return { symbol: row.symbol, orderId: String(row.orderId), clientOrderId: row.clientOrderId, status: row.status, side: row.side, executedQty: row.executedQty, cummulativeQuoteQty: row.cummulativeQuoteQty };
}

async function signedOrderRequest(method: "GET" | "POST", apiKey: string, secret: string, params: Record<string, string>) {
  const query = new URLSearchParams({ ...params, recvWindow: "5000", timestamp: String(Date.now()) }).toString();
  const signature = signBinanceQuery(query, secret);
  let response: Response;
  try { response = await fetch(`${BINANCE_BASE}/api/v3/order?${query}&signature=${signature}`, { method, headers: { "X-MBX-APIKEY": apiKey }, cache: "no-store", signal: AbortSignal.timeout(10_000) }); }
  catch { const error = new BinanceApiError("Binance order status is uncertain because the exchange did not respond. Do not submit another order until this one is reconciled.", 503) as BinanceApiError & { executionUnknown?: boolean }; error.executionUnknown = true; throw error; }
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) {
    const code = typeof payload?.code === "number" ? payload.code : null;
    const message = typeof payload?.msg === "string" ? payload.msg.slice(0, 180) : "Order rejected";
    if (code === -2015 || response.status === 401) throw new BinanceApiError("Binance rejected the key, Spot trading permission, or server IP.", 400);
    if (code === -2010) throw new BinanceApiError(`Binance rejected the order: ${message}`, 409);
    if (code === -1021) throw new BinanceApiError("The server clock is out of sync with Binance.", 503);
    if (response.status === 429 || response.status === 418) throw new BinanceApiError("Binance rate limited order placement. Wait before retrying.", 429);
    if (response.status >= 500) { const error = new BinanceApiError("Binance returned an uncertain server response. Do not submit another order until this one is reconciled.", 503) as BinanceApiError & { executionUnknown?: boolean }; error.executionUnknown = true; throw error; }
    throw new BinanceApiError(`Binance rejected the order: ${message}`, 409);
  }
  return parseOrder(payload);
}

function decimalPlaces(value: string) { const normalized = value.replace(/0+$/, ""); return normalized.includes(".") ? normalized.length - normalized.indexOf(".") - 1 : 0; }
export function floorBinanceQuantity(quantity: number, stepSize: string) {
  const step = Number(stepSize);
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(step) || step <= 0) throw new BinanceApiError("Binance returned invalid quantity rules.");
  const factor = 10 ** decimalPlaces(stepSize);
  return (Math.floor((quantity * factor + 1e-9) / (step * factor)) * step).toFixed(decimalPlaces(stepSize));
}

async function binanceMarketRules(symbol: string) {
  let response: Response;
  try { response = await fetch(`${BINANCE_BASE}/api/v3/exchangeInfo?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) }); } catch { throw new BinanceApiError("Binance symbol rules could not be loaded."); }
  const payload = await response.json().catch(() => null) as { symbols?: { status?: string; isSpotTradingAllowed?: boolean; filters?: Record<string, unknown>[] }[] } | null;
  const row = payload?.symbols?.[0];
  if (!response.ok || !row || row.status !== "TRADING" || row.isSpotTradingAllowed === false) throw new BinanceApiError("This symbol is not available for Binance Spot trading.", 409);
  const lot = row.filters?.find(item => item.filterType === "MARKET_LOT_SIZE") ?? row.filters?.find(item => item.filterType === "LOT_SIZE");
  if (!lot || typeof lot.stepSize !== "string" || typeof lot.minQty !== "string" || typeof lot.maxQty !== "string") throw new BinanceApiError("Binance did not return market quantity rules.");
  return { stepSize: lot.stepSize, minQty: Number(lot.minQty), maxQty: Number(lot.maxQty) };
}

export async function placeBinanceSpotMarketOrder(input: { apiKey: string; secret: string; symbol: string; side: "BUY" | "SELL"; quoteAmount: number; referencePrice: number; clientOrderId: string }) {
  if (!/^[A-Z0-9]{5,20}$/.test(input.symbol) || !/^[A-Za-z0-9_-]{1,36}$/.test(input.clientOrderId) || !Number.isFinite(input.quoteAmount) || input.quoteAmount < 10) throw new BinanceApiError("Invalid Spot order request.", 400);
  const params: Record<string, string> = { symbol: input.symbol, side: input.side, type: "MARKET", newClientOrderId: input.clientOrderId, newOrderRespType: "FULL" };
  if (input.side === "BUY") params.quoteOrderQty = input.quoteAmount.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
  else {
    const rules = await binanceMarketRules(input.symbol);
    const quantity = floorBinanceQuantity(input.quoteAmount / input.referencePrice, rules.stepSize);
    if (Number(quantity) < rules.minQty || Number(quantity) > rules.maxQty) throw new BinanceApiError("The sell size is outside Binance market quantity limits.", 409);
    params.quantity = quantity;
  }
  return signedOrderRequest("POST", input.apiKey, input.secret, params);
}

export async function getBinanceSpotOrder(apiKey: string, secret: string, symbol: string, clientOrderId: string) { return signedOrderRequest("GET", apiKey, secret, { symbol, origClientOrderId: clientOrderId }); }

export async function getBinanceSpotBalances(apiKey: string, secret: string): Promise<SpotBalance[]> {
  const data = await signedGet("/api/v3/account", apiKey, secret, { omitZeroBalances: "true" });
  if (!data || typeof data !== "object" || !Array.isArray((data as { balances?: unknown }).balances)) throw new BinanceApiError("Binance returned an unexpected account response.");
  return (data as { balances: unknown[] }).balances.filter((item): item is SpotBalance => {
    if (!item || typeof item !== "object") return false;
    const balance = item as Record<string, unknown>;
    return typeof balance.asset === "string" && /^[A-Z0-9]{1,20}$/.test(balance.asset) && typeof balance.free === "string" && typeof balance.locked === "string" && /^\d+(?:\.\d+)?$/.test(balance.free) && /^\d+(?:\.\d+)?$/.test(balance.locked);
  }).filter(balance => Number(balance.free) > 0 || Number(balance.locked) > 0).slice(0, 100);
}
