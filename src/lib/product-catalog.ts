import "server-only";
import { ProductDefinition } from "@/models/ProductDefinition";
const defaults = [
  { slug: "signals", name: "AI trade ideas scanner", description: "Closed-candle market screening with a thesis and defined risk levels.", enabled: true, cost: 1, starter: 25, trader: 100, desk: 300, topupCredits: 25, topupPrice: 15 },
  { slug: "portfolio", name: "Portfolio intelligence", description: "Preview product: future concentration, exposure, and portfolio risk analysis.", enabled: false, cost: 3, starter: 5, trader: 20, desk: 60, topupCredits: 10, topupPrice: 12 },
  { slug: "strategy", name: "Strategy laboratory", description: "Preview product: future scenario testing and strategy comparison.", enabled: false, cost: 5, starter: 0, trader: 10, desk: 30, topupCredits: 10, topupPrice: 20 },
];
export async function getProductCatalog(isDemo: boolean) {
  const scope = isDemo ? "demo" : "live";
  for (const entry of defaults) await ProductDefinition.updateOne({ scope, slug: entry.slug }, { $setOnInsert: { ...entry, scope } }, { upsert: true });
  return ProductDefinition.find({ scope }).sort({ createdAt: 1 }).lean();
}

