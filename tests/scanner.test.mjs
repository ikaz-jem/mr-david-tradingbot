import test from "node:test";
import assert from "node:assert/strict";
import { analyzeCandles } from "../src/lib/scanner.ts";

function candles() {
  return Array.from({ length: 100 }, (_, i) => ({
    openTime: i * 14_400_000,
    closeTime: (i + 1) * 14_400_000 - 1,
    open: 100 + i * 0.1,
    high: 101 + i * 0.1,
    low: 99 + i * 0.1,
    close: 100 + i * 0.1,
    volume: 100,
  }));
}

test("publishes only when breakout, trend, volume, and volatility pass", () => {
  const rows = candles();
  rows[99] = { ...rows[99], high: 115, close: 114, volume: 200 };
  const result = analyzeCandles(rows);
  assert.equal(result.hasSetup, true);
  assert.equal(result.entry, 114);
  assert.ok(result.stop < result.entry);
  assert.ok(result.target > result.entry);
  assert.equal(result.facts.breakout, true);
});

test("does not manufacture a setup from a quiet candle", () => {
  const result = analyzeCandles(candles());
  assert.equal(result.hasSetup, false);
  assert.match(result.summary, /No qualifying long setup/);
});

test("rejects insufficient history", () => {
  assert.throws(() => analyzeCandles(candles().slice(-20)), /Insufficient/);
});
