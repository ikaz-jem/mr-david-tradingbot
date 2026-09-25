export type MarketSnapshot = { symbol: string; price: number; change: number };
export type CandlePoint = { time: string; close: number };

const BASE = process.env.BINANCE_API_BASE_URL ?? "https://api.binance.com";

export async function getMarketSnapshot(): Promise<MarketSnapshot[]> {
  try {
    const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
    const response = await fetch(`${BASE}/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`Binance market data ${response.status}`);
    const rows = await response.json() as { symbol: string; lastPrice: string; priceChangePercent: string }[];
    return rows.map(row => ({ symbol: row.symbol, price: Number(row.lastPrice), change: Number(row.priceChangePercent) }));
  } catch { return []; }
}

export async function getMarketHistory(symbol = "BTCUSDT"): Promise<CandlePoint[]> {
  try {
    const response = await fetch(`${BASE}/api/v3/klines?symbol=${symbol}&interval=1d&limit=30`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`Binance candles ${response.status}`);
    const rows = await response.json() as [number, string, string, string, string, ...unknown[]][];
    return rows.map(row => ({ time: new Date(row[0]).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }), close: Number(row[4]) }));
  } catch { return []; }
}
