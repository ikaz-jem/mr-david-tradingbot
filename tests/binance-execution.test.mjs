import test from "node:test";
import assert from "node:assert/strict";
import { assertSpotTradingBinancePermissions, BinanceApiError, floorBinanceQuantity, placeBinanceSpotMarketOrder, signBinanceQuery } from "../src/lib/binance-spot.ts";

const safeTrading = { enableReading: true, enableWithdrawals: false, enableInternalTransfer: false, permitsUniversalTransfer: false, enableSpotAndMarginTrading: true, enableMargin: false, enableFutures: false, ipRestrict: true };
test("Spot execution accepts only trading keys without money-moving or leveraged permissions", () => {
  assert.doesNotThrow(() => assertSpotTradingBinancePermissions(safeTrading));
  for (const dangerous of ["enableWithdrawals", "enableInternalTransfer", "permitsUniversalTransfer", "enableMargin", "enableFutures"]) assert.throws(() => assertSpotTradingBinancePermissions({ ...safeTrading, [dangerous]: true }), BinanceApiError);
  assert.throws(() => assertSpotTradingBinancePermissions({ ...safeTrading, enableSpotAndMarginTrading: false }), BinanceApiError);
});
test("floors sell quantities to Binance step size", () => {
  assert.equal(floorBinanceQuantity(1.234567, "0.00100000"), "1.234");
  assert.equal(floorBinanceQuantity(0.00999, "0.00010000"), "0.0099");
});
test("BUY market execution signs one idempotent client order with quote quantity", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const parsed = new URL(String(url));
    assert.equal(init.method, "POST");
    assert.equal(parsed.pathname, "/api/v3/order");
    assert.equal(parsed.searchParams.get("newClientOrderId"), "env_fixture_1");
    assert.equal(parsed.searchParams.get("quoteOrderQty"), "25");
    const signature = parsed.searchParams.get("signature"); parsed.searchParams.delete("signature");
    assert.equal(signature, signBinanceQuery(parsed.searchParams.toString(), "secret"));
    return new Response(JSON.stringify({ symbol: "BTCUSDT", orderId: 42, clientOrderId: "env_fixture_1", status: "FILLED", side: "BUY", executedQty: "0.00025", cummulativeQuoteQty: "25" }), { status: 200 });
  };
  try { const result = await placeBinanceSpotMarketOrder({ apiKey: "key", secret: "secret", symbol: "BTCUSDT", side: "BUY", quoteAmount: 25, referencePrice: 100000, clientOrderId: "env_fixture_1" }); assert.equal(result.orderId, "42"); }
  finally { globalThis.fetch = originalFetch; }
});
