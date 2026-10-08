import "server-only";
import { ProductDefinition } from "@/models/ProductDefinition";
const defaults = [
  { slug: "signals", name: "Trading Companion — Research", description: "Closed-candle market screening with an explainable thesis and defined risk levels.", enabled: true, demoEnabled: true, cost: 1, starter: 25, trader: 100, desk: 300, topupCredits: 25, topupPrice: 15 },
  { slug: "approval-desk", name: "Trading Companion — Approval", description: "Finds qualified trade opportunities and waits for the user to accept or reject every proposed order.", enabled: false, demoEnabled: true, cost: 2, starter: 10, trader: 40, desk: 120, topupCredits: 20, topupPrice: 18 },
  { slug: "autopilot", name: "Trading Companion — Autopilot", description: "Guarded automated execution with position, frequency, loss, market, and emergency-stop controls.", enabled: false, demoEnabled: true, cost: 4, starter: 0, trader: 20, desk: 80, topupCredits: 20, topupPrice: 25 },
  { slug: "portfolio", name: "Portfolio intelligence", description: "Preview product: future concentration, exposure, and portfolio risk analysis.", enabled: false, demoEnabled: false, cost: 3, starter: 5, trader: 20, desk: 60, topupCredits: 10, topupPrice: 12 },
  { slug: "strategy", name: "Strategy laboratory", description: "Preview product: future scenario testing and strategy comparison.", enabled: false, demoEnabled: false, cost: 5, starter: 0, trader: 10, desk: 30, topupCredits: 10, topupPrice: 20 },
];
export async function getProductCatalog(isDemo: boolean) {
  const scope = isDemo ? "demo" : "live";
  for (const { demoEnabled, ...entry } of defaults) await ProductDefinition.updateOne({ scope, slug: entry.slug }, { $setOnInsert: { ...entry, enabled: isDemo ? demoEnabled : entry.enabled, scope } }, { upsert: true });
  return ProductDefinition.find({ scope }).sort({ createdAt: 1 }).lean();
}

