import { z } from "zod";
import { scanSymbols, scanIntervals, intervalMilliseconds, type ScanInterval } from "./scan-markets.ts";
export { scanSymbols } from "./scan-markets.ts";

export const scanInput = z.object({ symbol: z.enum(scanSymbols), interval: z.enum(scanIntervals).default("4h"), strategySlug: z.string().regex(/^[a-z][a-z0-9-]{1,39}$/).default("ai-router"), requestId: z.uuid() });
export type ScanCandle = { openTime: number; closeTime: number; open: number; high: number; low: number; close: number; volume: number };

const DATA_BASE = process.env.BINANCE_DATA_BASE_URL ?? "https://data-api.binance.vision";

export async function getClosedCandles(symbol: (typeof scanSymbols)[number], interval: ScanInterval = "4h"): Promise<ScanCandle[]> {
  const INTERVAL_MS = intervalMilliseconds[interval];
  const response = await fetch(`${DATA_BASE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=100`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
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

export type StrategyEngine = "trend-breakout" | "momentum-continuation" | "mean-reversion" | "ict-price-structure" | "elliott-wave-assist";
export type StrategySensitivity = "conservative" | "balanced" | "aggressive";

const deviation = (numbers: number[], average = mean(numbers)) => Math.sqrt(mean(numbers.map(number => (number - average) ** 2)));
const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function analyzeCandles(candles: ScanCandle[], engine: StrategyEngine = "trend-breakout", sensitivity: StrategySensitivity = "balanced") {
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
  const priorLow = Math.min(...candles.slice(-21, -1).map(row => row.low));
  const relativeVolume = recent.volume / Math.max(mean(candles.slice(-21, -1).map(row => row.volume)), 0.000001);
  const bullishTrend = recent.close > sma20 && sma20 > sma50;
  const bearishTrend = recent.close < sma20 && sma20 < sma50;
  const upsideBreakout = recent.close > priorHigh;
  const downsideBreakdown = recent.close < priorLow;
  const liquidMove = relativeVolume >= 1.15;
  const saneVolatility = atr14 / recent.close >= 0.002 && atr14 / recent.close <= 0.12;
  const volumeThreshold = sensitivity === "conservative" ? 1.25 : sensitivity === "aggressive" ? 1.05 : 1.15;
  const confirmedVolume = relativeVolume >= volumeThreshold;
  const changes = candles.slice(-15).map((row, index, rows) => index === 0 ? 0 : row.close - rows[index - 1].close).slice(1);
  const averageGain = mean(changes.map(value => Math.max(0, value)));
  const averageLoss = mean(changes.map(value => Math.max(0, -value)));
  const rsi14 = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
  const momentum10 = recent.close / candles.at(-11)!.close - 1;
  const standardDeviation20 = deviation(last20.map(row => row.close), sma20);
  const bandMultiplier = sensitivity === "conservative" ? 2.2 : sensitivity === "aggressive" ? 1.8 : 2;
  const upperBand = sma20 + bandMultiplier * standardDeviation20;
  const lowerBand = sma20 - bandMultiplier * standardDeviation20;
  const momentumThreshold = sensitivity === "conservative" ? .01 : sensitivity === "aggressive" ? .0025 : .005;
  const oversold = sensitivity === "conservative" ? 30 : sensitivity === "aggressive" ? 40 : 35;
  const overbought = 100 - oversold;
  const bullishSweep = recent.low < priorLow && recent.close > priorLow;
  const bearishSweep = recent.high > priorHigh && recent.close < priorHigh;
  const recentTriples = candles.slice(-8);
  const bullishFvg = recentTriples.some((row, index) => index >= 2 && row.low > recentTriples[index - 2].high);
  const bearishFvg = recentTriples.some((row, index) => index >= 2 && row.high < recentTriples[index - 2].low);
  const priorFiveHigh = Math.max(...candles.slice(-6, -1).map(row => row.high));
  const priorFiveLow = Math.min(...candles.slice(-6, -1).map(row => row.low));
  const bullishStructureShift = recent.close > priorFiveHigh;
  const bearishStructureShift = recent.close < priorFiveLow;
  const segments = [candles.slice(-30, -20), candles.slice(-20, -10), candles.slice(-10)];
  const segmentHighs = segments.map(rows => Math.max(...rows.map(row => row.high)));
  const segmentLows = segments.map(rows => Math.min(...rows.map(row => row.low)));
  const bullishSwingSequence = segmentHighs[0] < segmentHighs[1] && segmentHighs[1] < segmentHighs[2] && segmentLows[0] < segmentLows[1] && segmentLows[1] < segmentLows[2];
  const bearishSwingSequence = segmentHighs[0] > segmentHighs[1] && segmentHighs[1] > segmentHighs[2] && segmentLows[0] > segmentLows[1] && segmentLows[1] > segmentLows[2];

  let longEligible = false;
  let shortEligible = false;
  let score = 0;
  let summary = "";
  if (engine === "trend-breakout") {
    longEligible = bullishTrend && upsideBreakout && confirmedVolume && saneVolatility;
    shortEligible = bearishTrend && downsideBreakdown && confirmedVolume && saneVolatility;
    score = clampScore(20 * Number(bullishTrend || bearishTrend) + 35 * Number(upsideBreakout || downsideBreakdown) + 25 * Math.min(relativeVolume / volumeThreshold, 1) + 20 * Number(saneVolatility));
    summary = "moving-average trend, 20-candle boundary, relative-volume, and volatility filters";
  } else if (engine === "momentum-continuation") {
    const bullishMomentum = momentum10 >= momentumThreshold && rsi14 >= 52 && rsi14 <= (sensitivity === "aggressive" ? 82 : 75);
    const bearishMomentum = momentum10 <= -momentumThreshold && rsi14 <= 48 && rsi14 >= (sensitivity === "aggressive" ? 18 : 25);
    longEligible = bullishTrend && bullishMomentum && confirmedVolume && saneVolatility;
    shortEligible = bearishTrend && bearishMomentum && confirmedVolume && saneVolatility;
    score = clampScore(25 * Number(bullishTrend || bearishTrend) + 30 * Math.min(Math.abs(momentum10) / momentumThreshold, 1) + 25 * Math.min(relativeVolume / volumeThreshold, 1) + 20 * Number(saneVolatility));
    summary = "trend, 10-candle momentum, RSI, relative-volume, and volatility filters";
  } else if (engine === "mean-reversion") {
    longEligible = recent.close < lowerBand && rsi14 <= oversold && saneVolatility;
    shortEligible = recent.close > upperBand && rsi14 >= overbought && saneVolatility;
    const extension = standardDeviation20 ? Math.abs(recent.close - sma20) / standardDeviation20 : 0;
    score = clampScore(45 * Math.min(extension / bandMultiplier, 1) + 35 * Math.min(Math.abs(rsi14 - 50) / Math.max(50 - oversold, 1), 1) + 20 * Number(saneVolatility));
    summary = "volatility-band extension, RSI exhaustion, and return-to-mean filters";
  } else if (engine === "ict-price-structure") {
    const bullishConfirmation = sensitivity === "conservative" ? bullishFvg && bullishStructureShift : sensitivity === "aggressive" ? bullishFvg || bullishStructureShift || bullishSweep : bullishFvg || bullishStructureShift;
    const bearishConfirmation = sensitivity === "conservative" ? bearishFvg && bearishStructureShift : sensitivity === "aggressive" ? bearishFvg || bearishStructureShift || bearishSweep : bearishFvg || bearishStructureShift;
    longEligible = bullishSweep && bullishConfirmation && saneVolatility;
    shortEligible = bearishSweep && bearishConfirmation && saneVolatility;
    score = clampScore(40 * Number(bullishSweep || bearishSweep) + 25 * Number(bullishFvg || bearishFvg) + 20 * Number(bullishStructureShift || bearishStructureShift) + 15 * Number(saneVolatility));
    summary = "declared liquidity-sweep, three-candle imbalance, structure-shift, and volatility heuristics";
  } else {
    const sequenceConfirmed = sensitivity === "conservative" ? confirmedVolume : true;
    longEligible = bullishSwingSequence && bullishTrend && sequenceConfirmed && saneVolatility;
    shortEligible = bearishSwingSequence && bearishTrend && sequenceConfirmed && saneVolatility;
    score = clampScore(45 * Number(bullishSwingSequence || bearishSwingSequence) + 25 * Number(bullishTrend || bearishTrend) + 15 * Math.min(relativeVolume / volumeThreshold, 1) + 15 * Number(saneVolatility));
    summary = "three-segment swing sequence, trend, volume, and invalidation heuristics";
  }
  const setupSide: "buy" | "sell" | null = longEligible ? "buy" : shortEligible ? "sell" : null;
  const hasSetup = setupSide !== null;
  const entry = rounded(recent.close);
  const riskDistance = engine === "mean-reversion" ? 1.25 * atr14 : 1.5 * atr14;
  const rewardDistance = engine === "mean-reversion" ? Math.abs(entry - sma20) : engine === "elliott-wave-assist" ? 2.5 * atr14 : 3 * atr14;
  const stop = rounded(setupSide === "sell" ? entry + riskDistance : entry - riskDistance);
  const target = rounded(setupSide === "sell" ? entry - rewardDistance : entry + rewardDistance);
  return {
    hasSetup, setupSide, entry, stop, target, score, engine, sensitivity, dataCutoff: new Date(recent.closeTime),
    facts: { lastClose: entry, sma20: rounded(sma20), sma50: rounded(sma50), prior20High: rounded(priorHigh), prior20Low: rounded(priorLow), atr14: rounded(atr14), relativeVolume: rounded(relativeVolume), rsi14: rounded(rsi14), momentum10: rounded(momentum10), upperBand: rounded(upperBand), lowerBand: rounded(lowerBand), bullishTrend, bearishTrend, upsideBreakout, downsideBreakdown, liquidMove, confirmedVolume, saneVolatility, bullishSweep, bearishSweep, bullishFvg, bearishFvg, bullishStructureShift, bearishStructureShift, bullishSwingSequence, bearishSwingSequence, longEligible, shortEligible },
    summary: hasSetup ? `${setupSide === "buy" ? "Long" : "Short"} candidate passed ${summary}.` : `No qualifying directional setup: neither a long nor short candidate passed the ${summary}.`,
  };
}
