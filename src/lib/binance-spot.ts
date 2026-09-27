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

export async function getBinanceSpotBalances(apiKey: string, secret: string): Promise<SpotBalance[]> {
  const data = await signedGet("/api/v3/account", apiKey, secret, { omitZeroBalances: "true" });
  if (!data || typeof data !== "object" || !Array.isArray((data as { balances?: unknown }).balances)) throw new BinanceApiError("Binance returned an unexpected account response.");
  return (data as { balances: unknown[] }).balances.filter((item): item is SpotBalance => {
    if (!item || typeof item !== "object") return false;
    const balance = item as Record<string, unknown>;
    return typeof balance.asset === "string" && /^[A-Z0-9]{1,20}$/.test(balance.asset) && typeof balance.free === "string" && typeof balance.locked === "string" && /^\d+(?:\.\d+)?$/.test(balance.free) && /^\d+(?:\.\d+)?$/.test(balance.locked);
  }).filter(balance => Number(balance.free) > 0 || Number(balance.locked) > 0).slice(0, 100);
}
