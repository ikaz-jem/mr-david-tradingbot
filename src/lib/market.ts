import { absoluteHttpsOrigin } from "./binance-data-origin.ts";

export type MarketSnapshot = { symbol: string; price: number; change: number; updatedAt: number };
export type CandlePoint = { time: string; close: number };
export type MarketOverview = { markets: MarketSnapshot[]; history: CandlePoint[]; fetchedAt: number };

function marketBase() { return absoluteHttpsOrigin(process.env.BINANCE_API_BASE_URL, "https://api.binance.com", "BINANCE_API_BASE_URL"); }
const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
let cached: MarketOverview | undefined;
let pending: Promise<MarketOverview> | undefined;

export function parseSnapshot(input: unknown, now = Date.now()): MarketSnapshot[] {
  if (!Array.isArray(input)) return [];
  return symbols.flatMap(symbol => {
    const row = input.find(item => item?.symbol === symbol);
    const price = Number(row?.lastPrice), change = Number(row?.priceChangePercent), updatedAt = Number(row?.closeTime);
    if (!row || row.priceChangePercent == null || !Number.isFinite(price) || price <= 0 || !Number.isFinite(change) || !Number.isFinite(updatedAt) || updatedAt <= 0 || updatedAt > now + 60_000 || now - updatedAt > 120_000) return [];
    return [{ symbol, price, change, updatedAt }];
  });
}

export function parseHistory(input: unknown, now = Date.now()): CandlePoint[] {
  if (!Array.isArray(input)) return [];
  const rows = input.filter(row => Array.isArray(row) && Number.isFinite(row[0]) && Number.isFinite(row[6]) && row[0] < row[6] && row[6] < now && Number.isFinite(Number(row[4])) && Number(row[4]) > 0).sort((a, b) => a[0] - b[0]);
  const unique = new Map<number, CandlePoint>();
  for (const row of rows) unique.set(row[0], { time: new Date(row[0]).toISOString().slice(0, 10), close: Number(row[4]) });
  const latest = rows.at(-1);
  return latest && now - latest[6] < 86_400_000 ? [...unique.values()].slice(-30) : [];
}

export async function getMarketOverview(): Promise<MarketOverview> {
  if (cached && Date.now() - cached.fetchedAt < 15_000) return cached;
  if (pending) return pending;
  pending = (async () => {
    async function read(path: string) {
      try {
        const response = await fetch(marketBase() + path, { cache: "no-store", signal: AbortSignal.timeout(8000) });
        return response.ok ? await response.json() : null;
      } catch { return null; }
    }
    const [ticker, candles] = await Promise.all([
      read("/api/v3/ticker/24hr?symbols=" + encodeURIComponent(JSON.stringify(symbols))),
      read("/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=31"),
    ]);
    const now = Date.now();
    cached = { markets: parseSnapshot(ticker, now), history: parseHistory(candles, now), fetchedAt: now };
    return cached;
  })();
  try { return await pending; } finally { pending = undefined; }
}

export async function getMarketSnapshot(): Promise<MarketSnapshot[]> {
  try {
    const response = await fetch(`${marketBase()}/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`Binance market data ${response.status}`);
    const rows = await response.json() as { symbol: string; lastPrice: string; priceChangePercent: string }[];
    return parseSnapshot(rows);
  } catch { return []; }
}
export async function getMarketHistory(symbol = "BTCUSDT"): Promise<CandlePoint[]> {
  try {
    const response = await fetch(`${marketBase()}/api/v3/klines?symbol=${symbol}&interval=1d&limit=30`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`Binance candles ${response.status}`);
    const rows = await response.json() as [number, string, string, string, string, ...unknown[]][];
    return rows.map(row => ({ time: new Date(row[0]).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }), close: Number(row[4]) }));
  } catch { return []; }
}
