import { z } from "zod";

export const scanSymbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"] as const;
export const scanInput = z.object({ symbol: z.enum(scanSymbols), requestId: z.uuid() });
export type ScanCandle = { openTime: number; closeTime: number; open: number; high: number; low: number; close: number; volume: number };

const DATA_BASE = process.env.BINANCE_DATA_BASE_URL ?? "https://data-api.binance.vision";
const INTERVAL_MS = 4 * 60 * 60 * 1000;

export async function getClosedCandles(symbol: (typeof scanSymbols)[number]): Promise<ScanCandle[]> {
  const response = await fetch(`${DATA_BASE}/api/v3/klines?symbol=${symbol}&interval=4h&limit=100`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Market data unavailable (${response.status})`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error("Invalid market data");
  const candles = rows.map((row): ScanCandle => ({ openTime: Number(row[0]), open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]), volume: Number(row[5]), closeTime: Number(row[6]) })).filter(row => row.closeTime < Date.now());
  if (candles.length < 50 || candles.some(row => !Object.values(row).every(Number.isFinite) || row.low <= 0 || row.high < row.low || row.close < row.low || row.close > row.high) || candles.some((row, i) => i > 0 && row.openTime - candles[i - 1].openTime !== INTERVAL_MS)) throw new Error("Market data failed validation");
  if (Date.now() - candles.at(-1)!.closeTime > INTERVAL_MS + 2 * 60 * 1000) throw new Error("Market data is stale");
  return candles;
}

const mean = (numbers: number[]) => numbers.reduce((sum, number) => sum + number, 0) / numbers.length;
const rounded = (number: number) => Number(number.toPrecision(8));

export function analyzeCandles(candles: ScanCandle[]) {
  if (candles.length < 50) throw new Error("Insufficient closed candles");
  const recent = candles.at(-1)!;
  const last20 = candles.slice(-20);
  const sma20 = mean(last20.map(row => row.close));
  const sma50 = mean(candles.slice(-50).map(row => row.close));
  const ranges = candles.slice(-14).map((row, index) => {
    const previous = candles[candles.length - 14 + index - 1]?.close ?? row.open;
    return Math.max(row.high - row.low, Math.abs(row.high - previous), Math.abs(row.low - previous));
  });
  const atr14 = mean(ranges);
  const priorHigh = Math.max(...candles.slice(-21, -1).map(row => row.high));
  const relativeVolume = recent.volume / Math.max(mean(candles.slice(-21, -1).map(row => row.volume)), 0.000001);
  const trend = recent.close > sma20 && sma20 > sma50;
  const breakout = recent.close > priorHigh;
  const liquidMove = relativeVolume >= 1.15;
  const saneVolatility = atr14 / recent.close >= 0.002 && atr14 / recent.close <= 0.12;
  const hasSetup = trend && breakout && liquidMove && saneVolatility;
  const entry = rounded(recent.close);
  const stop = rounded(entry - 1.5 * atr14);
  const target = rounded(entry + 3 * atr14);
  return {
    hasSetup, entry, stop, target, dataCutoff: new Date(recent.closeTime),
    facts: { lastClose: entry, sma20: rounded(sma20), sma50: rounded(sma50), prior20High: rounded(priorHigh), atr14: rounded(atr14), relativeVolume: rounded(relativeVolume), trend, breakout, liquidMove, saneVolatility },
    summary: hasSetup ? "Trend, 20-candle breakout, volume, and volatility filters passed." : `No qualifying long setup: ${[!trend && "trend", !breakout && "breakout", !liquidMove && "volume", !saneVolatility && "volatility"].filter(Boolean).join(", ")} filter${[trend, breakout, liquidMove, saneVolatility].filter(value => !value).length === 1 ? "" : "s"} did not pass.`,
  };
}

const narrativeSchema = z.object({ thesis: z.string().min(20).max(1200), riskNote: z.string().min(20).max(800) });

export async function explainSetup(symbol: string, analysis: ReturnType<typeof analyzeCandles>) {
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) throw new Error("AI provider is not configured");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST", signal: AbortSignal.timeout(25000),
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL,
      store: false,
      input: [{ role: "system", content: "You write concise, cautious crypto market research. Use only supplied facts. Do not invent market data, probabilities, performance claims, or numeric trade levels. State uncertainty; this is not investment advice." }, { role: "user", content: JSON.stringify({ symbol, timeframe: "4h", facts: analysis.facts, dataCutoff: analysis.dataCutoff.toISOString() }) }],
      text: { format: { type: "json_schema", name: "trade_research", strict: true, schema: { type: "object", additionalProperties: false, properties: { thesis: { type: "string" }, riskNote: { type: "string" } }, required: ["thesis", "riskNote"] } } },
    }),
  });
  if (!response.ok) throw new Error(`AI provider unavailable (${response.status})`);
  const body = await response.json();
  const outputText = body.output?.flatMap((item: { content?: { type: string; text?: string }[] }) => item.content ?? []).find((item: { type: string }) => item.type === "output_text")?.text;
  if (body.status !== "completed" || !outputText) throw new Error("AI analysis was incomplete");
  return narrativeSchema.parse(JSON.parse(outputText));
}
