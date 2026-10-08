import "server-only";
import { connectDB } from "@/lib/db";
import { StrategyDefinition } from "@/models/StrategyDefinition";

export const strategyEngines = ["ai-router", "trend-breakout", "momentum-continuation", "mean-reversion", "ict-price-structure", "elliott-wave-assist"] as const;
export const strategyProducts = ["signals", "approval-desk", "autopilot"] as const;
export const strategySensitivities = ["conservative", "balanced", "aggressive"] as const;
export type StrategyEngine = (typeof strategyEngines)[number];
export type StrategyProduct = (typeof strategyProducts)[number];
export type StrategySensitivity = (typeof strategySensitivities)[number];

const defaults = [
  { slug: "ai-router", name: "AI Strategy Router", description: "Default mode. Ranks eligible, approved deterministic strategies for the current market regime, then asks AI to validate the strongest candidate.", engine: "ai-router", sensitivity: "balanced", products: [...strategyProducts], enabled: true, experimental: false, locked: true },
  { slug: "trend-breakout", name: "Trend + Breakout", description: "Requires aligned moving-average trend, a 20-candle breakout or breakdown, elevated volume, and bounded volatility.", engine: "trend-breakout", sensitivity: "balanced", products: [...strategyProducts], enabled: true, experimental: false, locked: true },
  { slug: "momentum-continuation", name: "Momentum Continuation", description: "Looks for directional trend continuation with RSI, return momentum, volume, and volatility confirmation.", engine: "momentum-continuation", sensitivity: "balanced", products: ["signals", "approval-desk"], enabled: true, experimental: false, locked: true },
  { slug: "mean-reversion", name: "Mean Reversion", description: "Looks for statistically extended closes outside a volatility band with RSI exhaustion and a defined return-to-mean target.", engine: "mean-reversion", sensitivity: "balanced", products: ["signals", "approval-desk"], enabled: true, experimental: false, locked: true },
  { slug: "ict-price-structure", name: "ICT / SMC Price Structure", description: "Experimental OHLCV heuristic for liquidity sweeps, three-candle imbalances, and confirmed structure shifts. It does not infer institutional intent.", engine: "ict-price-structure", sensitivity: "conservative", products: ["signals"], enabled: true, experimental: true, locked: true },
  { slug: "elliott-wave-assist", name: "Elliott Wave Assist", description: "Experimental swing-structure assistant that returns a bounded directional candidate and invalidation; wave degree and labeling remain interpretive.", engine: "elliott-wave-assist", sensitivity: "conservative", products: ["signals"], enabled: true, experimental: true, locked: true },
] as const;

export async function getStrategyCatalog(isDemo = false) {
  await connectDB();
  const scope = isDemo ? "demo" : "live";
  for (const item of defaults) await StrategyDefinition.updateOne({ scope, slug: item.slug }, { $setOnInsert: { ...item, scope } }, { upsert: true });
  return StrategyDefinition.find({ scope }).sort({ locked: -1, createdAt: 1 }).lean();
}

export async function getEnabledStrategies(isDemo: boolean, product: StrategyProduct) {
  const catalog = await getStrategyCatalog(isDemo);
  return catalog.filter((item) => item.enabled && item.products.includes(product));
}
