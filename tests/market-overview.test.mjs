import test from "node:test";
import assert from "node:assert/strict";
import { parseHistory, parseSnapshot } from "../src/lib/market.ts";

test("market overview rejects stale or invalid quotes and includes only approved symbols", () => {
  const now = Date.UTC(2026, 9, 23, 12);
  const quote = (symbol, lastPrice, closeTime) => ({ symbol, lastPrice, priceChangePercent: "1.5", closeTime });
  assert.deepEqual(parseSnapshot([
    quote("BTCUSDT", "70000", now - 1000),
    quote("ETHUSDT", "0", now - 1000),
    quote("SOLUSDT", "150", now - 300_000),
    quote("DOGEUSDT", "0.2", now - 1000),
  ], now), [{ symbol: "BTCUSDT", price: 70000, change: 1.5, updatedAt: now - 1000 }]);
});

test("market overview excludes the unfinished daily candle", () => {
  const day = Date.UTC(2026, 9, 23), now = day + 12 * 60 * 60_000;
  const candle = (start, close) => [start, "1", "2", "1", close, "10", start + 86_400_000 - 1];
  assert.deepEqual(parseHistory([candle(day - 86_400_000, "100"), candle(day, "999")], now), [{ time: "2026-10-22", close: 100 }]);
});
