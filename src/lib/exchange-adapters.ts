import { createHash, createHmac } from "node:crypto";
import { assertFuturesTradingBinancePermissions, assertReadOnlyBinancePermissions, assertSpotTradingBinancePermissions, BinanceApiError, getBinancePermissions, getBinanceSpotBalances, signBinanceQuery } from "@/lib/binance-spot";
import type { ExchangeProviderId } from "@/lib/exchange-catalog";
import { bybitPermissionDecision, krakenPermissionDecision, kucoinPermissionDecision, okxPermissionDecision, type ExchangeAccess } from "@/lib/exchange-permission-policy";
import type { ExchangeMarket } from "@/lib/exchange-futures-policy";

export type ExchangeCredentials = { apiKey: string; apiSecret: string; passphrase?: string; keyVersion?: string };
export type ExchangeBalance = { asset: string; available: string; locked: string; account?: string };
export type ExchangeVerification = { ipRestricted: boolean; accountLabel?: string; keyVersion?: string; access: ExchangeAccess };

export class ExchangeApiError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) { super(message); this.status = status; }
}

function hmac(algorithm: string, secret: string | Buffer, value: string, encoding: "hex" | "base64" = "hex") {
  return createHmac(algorithm, secret).update(value).digest(encoding);
}

async function exchangeFetch(url: string, init: RequestInit, name: string) {
  try {
    const response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(12_000) });
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok) {
      const status = response.status === 401 || response.status === 403 ? 400 : response.status === 429 ? 429 : 502;
      throw new ExchangeApiError(`${name} rejected the credentials, key permissions, or this server's IP address.`, status);
    }
    return payload;
  } catch (error) {
    if (error instanceof ExchangeApiError) throw error;
    throw new ExchangeApiError(`${name} could not be reached from this server. Check exchange availability and try again.`);
  }
}

function validateBalance(asset: unknown, available: unknown, locked: unknown, account?: unknown): ExchangeBalance | null {
  const assetValue = typeof asset === "string" ? asset : "";
  const availableValue = typeof available === "string" && /^-?\d+(?:\.\d+)?$/.test(available) ? available : "0";
  const lockedValue = typeof locked === "string" && /^-?\d+(?:\.\d+)?$/.test(locked) ? locked : "0";
  if (!/^[A-Za-z0-9._-]{1,30}$/.test(assetValue)) return null;
  if (Number(availableValue) === 0 && Number(lockedValue) === 0) return null;
  return { asset: assetValue.toUpperCase(), available: availableValue, locked: lockedValue, account: typeof account === "string" ? account : undefined };
}

async function verifyBybit(credentials: ExchangeCredentials, requestedAccess: ExchangeAccess): Promise<ExchangeVerification> {
  const timestamp = String(Date.now());
  const recvWindow = "5000";
  const signature = hmac("sha256", credentials.apiSecret, `${timestamp}${credentials.apiKey}${recvWindow}`);
  const payload = await exchangeFetch("https://api.bybit.com/v5/user/query-api", { headers: { "X-BAPI-API-KEY": credentials.apiKey, "X-BAPI-TIMESTAMP": timestamp, "X-BAPI-RECV-WINDOW": recvWindow, "X-BAPI-SIGN": signature } }, "Bybit");
  if (payload?.retCode !== 0 || !payload.result || typeof payload.result !== "object") throw new ExchangeApiError("Bybit could not verify this API key.", 400);
  const result = payload.result as Record<string, unknown>;
  const permissions = result.permissions && typeof result.permissions === "object" ? result.permissions as Record<string, unknown> : {};
  const decision = bybitPermissionDecision(result.readOnly, permissions, requestedAccess);
  if (!decision.allowed) throw new ExchangeApiError(decision.reason, 400);
  const ips = result.ips;
  return { ipRestricted: Array.isArray(ips) ? ips.some(Boolean) : typeof ips === "string" && ips.trim().length > 0 && ips.trim() !== "*", access: requestedAccess };
}

async function balancesBybit(credentials: ExchangeCredentials): Promise<ExchangeBalance[]> {
  const query = "accountType=UNIFIED";
  const timestamp = String(Date.now()); const recvWindow = "5000";
  const signature = hmac("sha256", credentials.apiSecret, `${timestamp}${credentials.apiKey}${recvWindow}${query}`);
  const payload = await exchangeFetch(`https://api.bybit.com/v5/account/wallet-balance?${query}`, { headers: { "X-BAPI-API-KEY": credentials.apiKey, "X-BAPI-TIMESTAMP": timestamp, "X-BAPI-RECV-WINDOW": recvWindow, "X-BAPI-SIGN": signature } }, "Bybit");
  const list = payload?.result && typeof payload.result === "object" ? (payload.result as { list?: unknown }).list : null;
  const coins = Array.isArray(list) && list[0] && typeof list[0] === "object" ? (list[0] as { coin?: unknown }).coin : null;
  if (!Array.isArray(coins)) throw new ExchangeApiError("Bybit returned an unexpected balance response.");
  return coins.map((item) => item && typeof item === "object" ? validateBalance((item as Record<string, unknown>).coin, (item as Record<string, unknown>).walletBalance, (item as Record<string, unknown>).locked, "Unified") : null).filter((item): item is ExchangeBalance => Boolean(item)).slice(0, 150);
}

function okxHeaders(credentials: ExchangeCredentials, path: string) {
  const timestamp = new Date().toISOString();
  return { "OK-ACCESS-KEY": credentials.apiKey, "OK-ACCESS-SIGN": hmac("sha256", credentials.apiSecret, `${timestamp}GET${path}`, "base64"), "OK-ACCESS-TIMESTAMP": timestamp, "OK-ACCESS-PASSPHRASE": credentials.passphrase ?? "" };
}

async function verifyOkx(credentials: ExchangeCredentials, requestedAccess: ExchangeAccess): Promise<ExchangeVerification> {
  const path = "/api/v5/account/config";
  const payload = await exchangeFetch(`https://www.okx.com${path}`, { headers: okxHeaders(credentials, path) }, "OKX");
  const data = Array.isArray(payload?.data) ? payload.data[0] : null;
  if (payload?.code !== "0" || !data || typeof data !== "object") throw new ExchangeApiError("OKX could not verify this API key.", 400);
  const permissions = String((data as Record<string, unknown>).perm ?? "").toLowerCase().split(",").map((value) => value.trim()).filter(Boolean);
  const decision = okxPermissionDecision(permissions, requestedAccess);
  if (!decision.allowed) throw new ExchangeApiError(decision.reason, 400);
  const ip = String((data as Record<string, unknown>).ip ?? "").trim();
  return { ipRestricted: Boolean(ip), access: requestedAccess };
}

async function balancesOkx(credentials: ExchangeCredentials): Promise<ExchangeBalance[]> {
  const path = "/api/v5/account/balance";
  const payload = await exchangeFetch(`https://www.okx.com${path}`, { headers: okxHeaders(credentials, path) }, "OKX");
  const root = Array.isArray(payload?.data) ? payload.data[0] : null;
  const details = root && typeof root === "object" ? (root as { details?: unknown }).details : null;
  if (payload?.code !== "0" || !Array.isArray(details)) throw new ExchangeApiError("OKX returned an unexpected balance response.");
  return details.map((item) => item && typeof item === "object" ? validateBalance((item as Record<string, unknown>).ccy, (item as Record<string, unknown>).availBal, (item as Record<string, unknown>).frozenBal, "Trading") : null).filter((item): item is ExchangeBalance => Boolean(item)).slice(0, 150);
}

function krakenHeaders(credentials: ExchangeCredentials, path: string, nonce: string, body: string) {
  let decoded: Buffer;
  try { decoded = Buffer.from(credentials.apiSecret, "base64"); } catch { throw new ExchangeApiError("The Kraken private key is not valid base64.", 400); }
  const digest = createHash("sha256").update(nonce + body).digest();
  return { "API-Key": credentials.apiKey, "API-Sign": createHmac("sha512", decoded).update(Buffer.concat([Buffer.from(path), digest])).digest("base64"), "Content-Type": "application/x-www-form-urlencoded" };
}

async function krakenPrivate(credentials: ExchangeCredentials, method: "GetApiKeyInfo" | "Balance") {
  const path = `/0/private/${method}`; const nonce = String(Date.now() * 1000); const body = `nonce=${nonce}`;
  const payload = await exchangeFetch(`https://api.kraken.com${path}`, { method: "POST", headers: krakenHeaders(credentials, path, nonce, body), body }, "Kraken");
  if (!Array.isArray(payload?.error) || payload.error.length) throw new ExchangeApiError("Kraken rejected the credentials or API permissions.", 400);
  return payload.result;
}

async function verifyKraken(credentials: ExchangeCredentials, requestedAccess: ExchangeAccess): Promise<ExchangeVerification> {
  const result = await krakenPrivate(credentials, "GetApiKeyInfo");
  if (!result || typeof result !== "object") throw new ExchangeApiError("Kraken returned an unexpected permissions response.");
  const permissions = Array.isArray((result as { permissions?: unknown }).permissions) ? (result as { permissions: unknown[] }).permissions.map(String) : [];
  const decision = krakenPermissionDecision(permissions, requestedAccess);
  if (!decision.allowed) throw new ExchangeApiError(decision.reason, 400);
  const allowlist = (result as Record<string, unknown>).ipAllowlist;
  return { ipRestricted: Array.isArray(allowlist) ? allowlist.length > 0 : Boolean(allowlist), access: requestedAccess };
}

async function balancesKraken(credentials: ExchangeCredentials): Promise<ExchangeBalance[]> {
  const result = await krakenPrivate(credentials, "Balance");
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new ExchangeApiError("Kraken returned an unexpected balance response.");
  return Object.entries(result).map(([asset, value]) => validateBalance(asset, value, "0", "Funding")).filter((item): item is ExchangeBalance => Boolean(item)).slice(0, 150);
}

function kucoinHeaders(credentials: ExchangeCredentials, path: string) {
  const timestamp = String(Date.now()); const secret = credentials.apiSecret;
  return { "KC-API-KEY": credentials.apiKey, "KC-API-SIGN": hmac("sha256", secret, `${timestamp}GET${path}`, "base64"), "KC-API-TIMESTAMP": timestamp, "KC-API-PASSPHRASE": hmac("sha256", secret, credentials.passphrase ?? "", "base64"), "KC-API-KEY-VERSION": credentials.keyVersion || "3", "Content-Type": "application/json" };
}

async function kucoinGet(credentials: ExchangeCredentials, path: string) {
  const payload = await exchangeFetch(`https://api.kucoin.com${path}`, { headers: kucoinHeaders(credentials, path) }, "KuCoin");
  if (payload?.code !== "200000") throw new ExchangeApiError("KuCoin rejected the credentials, key version, passphrase, or server IP.", 400);
  return payload.data;
}

async function verifyKucoin(credentials: ExchangeCredentials, requestedAccess: ExchangeAccess): Promise<ExchangeVerification> {
  const result = await kucoinGet(credentials, "/api/v1/user/api-key");
  if (!result || typeof result !== "object") throw new ExchangeApiError("KuCoin returned an unexpected permissions response.");
  const permissions = String((result as Record<string, unknown>).permission ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  const decision = kucoinPermissionDecision(permissions, requestedAccess);
  if (!decision.allowed) throw new ExchangeApiError(decision.reason, 400);
  return { ipRestricted: false, accountLabel: String((result as Record<string, unknown>).remark ?? "") || undefined, keyVersion: String((result as Record<string, unknown>).apiVersion ?? credentials.keyVersion ?? "3"), access: requestedAccess };
}

async function balancesKucoin(credentials: ExchangeCredentials): Promise<ExchangeBalance[]> {
  const result = await kucoinGet(credentials, "/api/v1/accounts");
  if (!Array.isArray(result)) throw new ExchangeApiError("KuCoin returned an unexpected balance response.");
  return result.map((item) => item && typeof item === "object" ? validateBalance((item as Record<string, unknown>).currency, (item as Record<string, unknown>).available, (item as Record<string, unknown>).holds, String((item as Record<string, unknown>).type ?? "Account")) : null).filter((item): item is ExchangeBalance => Boolean(item)).slice(0, 150);
}

async function binanceFuturesRequest(credentials: ExchangeCredentials, path: string) {
  const query = new URLSearchParams({ recvWindow: "5000", timestamp: String(Date.now()) }).toString();
  return exchangeFetch(`https://fapi.binance.com${path}?${query}&signature=${signBinanceQuery(query, credentials.apiSecret)}`, { headers: { "X-MBX-APIKEY": credentials.apiKey } }, "Binance Futures");
}

async function balancesBinanceFutures(credentials: ExchangeCredentials): Promise<ExchangeBalance[]> {
  const payload = await binanceFuturesRequest(credentials, "/fapi/v2/balance");
  if (!Array.isArray(payload)) throw new ExchangeApiError("Binance Futures returned an unexpected balance response.");
  return payload.map(item => item && typeof item === "object" ? validateBalance((item as Record<string, unknown>).asset, (item as Record<string, unknown>).availableBalance, (item as Record<string, unknown>).crossUnPnl, "USD-M Futures") : null).filter((item): item is ExchangeBalance => Boolean(item)).slice(0, 150);
}

function krakenFuturesHeaders(credentials: ExchangeCredentials, path: string, query = "") {
  const nonce = String(Date.now());
  let decoded: Buffer;
  try { decoded = Buffer.from(credentials.apiSecret, "base64"); } catch { throw new ExchangeApiError("The Kraken Futures private key is not valid base64.", 400); }
  const digest = createHash("sha256").update(query + nonce + path).digest();
  return { APIKey: credentials.apiKey, Authent: createHmac("sha512", decoded).update(digest).digest("base64"), Nonce: nonce, Accept: "application/json" };
}

async function krakenFuturesCheck(credentials: ExchangeCredentials, requestedAccess: ExchangeAccess): Promise<ExchangeVerification> {
  const path = "/api/auth/v1/api-keys/v3/check";
  const payload = await exchangeFetch(`https://futures.kraken.com${path}`, { headers: krakenFuturesHeaders(credentials, path) }, "Kraken Futures");
  const permissions = payload?.permissions && typeof payload.permissions === "object" ? payload.permissions as Record<string, unknown> : {};
  const general = String(permissions.general ?? "").toUpperCase();
  const transfer = String(permissions.transfer ?? "").toUpperCase();
  if (requestedAccess === "futures_trade" && general !== "FULL_ACCESS") throw new ExchangeApiError("Kraken Futures execution requires General Full Access on a dedicated Futures key.", 400);
  if (requestedAccess === "read_only" && !["READ_ONLY", "FULL_ACCESS"].includes(general)) throw new ExchangeApiError("Kraken Futures read access is required.", 400);
  if (transfer !== "NO_ACCESS") throw new ExchangeApiError("Disable Kraken Futures transfer access before connecting this key.", 400);
  const allowlist = payload?.allowedCidrBlocks;
  return { ipRestricted: Array.isArray(allowlist) && allowlist.length > 0, accountLabel: "Kraken Futures", access: requestedAccess };
}

async function balancesKrakenFutures(credentials: ExchangeCredentials): Promise<ExchangeBalance[]> {
  const path = "/derivatives/api/v3/accounts";
  const payload = await exchangeFetch(`https://futures.kraken.com${path}`, { headers: krakenFuturesHeaders(credentials, path) }, "Kraken Futures");
  const accounts = payload?.accounts && typeof payload.accounts === "object" ? payload.accounts as Record<string, Record<string, unknown>> : {};
  return Object.entries(accounts).map(([account, value]) => validateBalance(String(value.currency ?? account), String(value.availableMargin ?? value.availableFunds ?? "0"), String(value.unrealizedFunding ?? "0"), "Futures")).filter((item): item is ExchangeBalance => Boolean(item)).slice(0, 50);
}

async function balancesKucoinFutures(credentials: ExchangeCredentials): Promise<ExchangeBalance[]> {
  const path = "/api/v1/account-overview?currency=USDT";
  const timestamp = String(Date.now()); const secret = credentials.apiSecret;
  const headers = { "KC-API-KEY": credentials.apiKey, "KC-API-SIGN": hmac("sha256", secret, `${timestamp}GET${path}`, "base64"), "KC-API-TIMESTAMP": timestamp, "KC-API-PASSPHRASE": hmac("sha256", secret, credentials.passphrase ?? "", "base64"), "KC-API-KEY-VERSION": credentials.keyVersion || "3", "Content-Type": "application/json" };
  const payload = await exchangeFetch(`https://api-futures.kucoin.com${path}`, { headers }, "KuCoin Futures");
  const value = payload?.data && typeof payload.data === "object" ? payload.data as Record<string, unknown> : null;
  if (payload?.code !== "200000" || !value) throw new ExchangeApiError("KuCoin Futures returned an unexpected balance response.");
  return [validateBalance("USDT", value.availableBalance, value.positionMargin, "Futures")].filter((item): item is ExchangeBalance => Boolean(item));
}

export async function verifyExchangeConnection(provider: ExchangeProviderId, credentials: ExchangeCredentials, requestedAccess: ExchangeAccess = "read_only", market: ExchangeMarket = "spot"): Promise<ExchangeVerification> {
  if (market === "futures" && requestedAccess === "spot_trade") throw new ExchangeApiError("Spot access cannot be stored as a Futures connection.", 400);
  if (market === "spot" && requestedAccess === "futures_trade") throw new ExchangeApiError("Futures access cannot be stored as a Spot connection.", 400);
  if (provider === "binance") {
    try { const permissions = await getBinancePermissions(credentials.apiKey, credentials.apiSecret); if (requestedAccess === "spot_trade") assertSpotTradingBinancePermissions(permissions); else if (requestedAccess === "futures_trade") assertFuturesTradingBinancePermissions(permissions); else assertReadOnlyBinancePermissions(permissions); return { ipRestricted: permissions.ipRestrict, accountLabel: market === "futures" ? "USD-M Futures" : "Spot", access: requestedAccess }; }
    catch (error) { if (error instanceof BinanceApiError) throw new ExchangeApiError(error.message, error.status); throw error; }
  }
  if (provider === "bybit") return verifyBybit(credentials, requestedAccess);
  if (provider === "okx") return verifyOkx(credentials, requestedAccess);
  if (provider === "kraken") return market === "futures" ? krakenFuturesCheck(credentials, requestedAccess) : verifyKraken(credentials, requestedAccess);
  return verifyKucoin(credentials, requestedAccess);
}

export async function getExchangeBalances(provider: ExchangeProviderId, credentials: ExchangeCredentials, market: ExchangeMarket = "spot"): Promise<ExchangeBalance[]> {
  if (market === "futures") {
    if (provider === "binance") return balancesBinanceFutures(credentials);
    if (provider === "bybit") return balancesBybit(credentials);
    if (provider === "okx") return balancesOkx(credentials);
    if (provider === "kraken") return balancesKrakenFutures(credentials);
    return balancesKucoinFutures(credentials);
  }
  if (provider === "binance") {
    try { return (await getBinanceSpotBalances(credentials.apiKey, credentials.apiSecret)).map((item) => ({ asset: item.asset, available: item.free, locked: item.locked, account: "Spot" })); }
    catch (error) { if (error instanceof BinanceApiError) throw new ExchangeApiError(error.message, error.status); throw error; }
  }
  if (provider === "bybit") return balancesBybit(credentials);
  if (provider === "okx") return balancesOkx(credentials);
  if (provider === "kraken") return balancesKraken(credentials);
  return balancesKucoin(credentials);
}
