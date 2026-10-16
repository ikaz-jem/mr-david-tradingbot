import "server-only";
import { Order } from "@/models/Order";
import { TradeFill } from "@/models/TradeFill";

let checkedAt = 0;
let pending: Promise<void> | null = null;

export async function requireTradeTrackingIndexes() {
  if (Date.now() - checkedAt < 60_000) return;
  if (!pending) pending = (async () => {
    const [positionGuard, fillIdentity] = await Promise.all([
      Order.collection.indexExists("positionGuardKey_1"),
      TradeFill.collection.indexExists("connectionId_1_market_1_symbol_1_exchangeTradeId_1"),
    ]);
    if (!positionGuard || !fillIdentity) throw new Error("Trade-tracking safety indexes are missing. Run the non-destructive trade-tracking migration.");
    checkedAt = Date.now();
  })().finally(() => { pending = null; });
  await pending;
}
