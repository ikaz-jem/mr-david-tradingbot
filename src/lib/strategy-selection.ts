import "server-only";
import { analyzeCandles, type ScanCandle, type StrategyEngine, type StrategySensitivity } from "@/lib/scanner";

export type AvailableStrategy = {
  slug: string;
  name: string;
  engine: string;
  sensitivity: string;
  version: number;
  enabled: boolean;
  experimental: boolean;
  products: string[];
};

function evaluate(candles: ScanCandle[], strategy: AvailableStrategy) {
  return analyzeCandles(candles, strategy.engine as StrategyEngine, strategy.sensitivity as StrategySensitivity);
}

export function resolveStrategySelection(candles: ScanCandle[], requestedSlug: string, catalog: AvailableStrategy[], product = "signals") {
  const available = catalog.filter(item => item.enabled && item.products.includes(product));
  const requested = available.find(item => item.slug === requestedSlug) ?? available.find(item => item.slug === "ai-router");
  if (!requested) throw new Error("No approved research strategy is available");

  if (requested.engine !== "ai-router") return { requested, selected: requested, analysis: evaluate(candles, requested), routed: false };

  const routable = available.filter(item => item.engine !== "ai-router" && !item.experimental);
  if (!routable.length) throw new Error("No approved strategy is available to the AI router");
  const ranked = routable.map(strategy => ({ strategy, analysis: evaluate(candles, strategy) })).sort((left, right) => {
    if (left.analysis.hasSetup !== right.analysis.hasSetup) return left.analysis.hasSetup ? -1 : 1;
    return right.analysis.score - left.analysis.score;
  });
  return { requested, selected: ranked[0].strategy, analysis: ranked[0].analysis, routed: true };
}
