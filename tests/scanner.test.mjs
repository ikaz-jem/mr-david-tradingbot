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
  assert.equal(result.setupSide, "buy");
  assert.equal(result.entry, 114);
  assert.ok(result.stop < result.entry);
  assert.ok(result.target > result.entry);
  assert.equal(result.facts.upsideBreakout, true);
});

test("does not manufacture a setup from a quiet candle", () => {
  const result = analyzeCandles(candles());
  assert.equal(result.hasSetup, false);
  assert.equal(result.setupSide, null);
  assert.match(result.summary, /No qualifying directional setup/);
});

test("publishes a short candidate when bearish trend, breakdown, volume, and volatility pass", () => {
  const rows = candles().map((row, index) => ({ ...row, open: 130 - index * .1, high: 131 - index * .1, low: 129 - index * .1, close: 130 - index * .1 }));
  rows[99] = { ...rows[99], low: 113, close: 114, volume: 200 };
  const result = analyzeCandles(rows);
  assert.equal(result.hasSetup, true);
  assert.equal(result.setupSide, "sell");
  assert.ok(result.stop > result.entry);
  assert.ok(result.target < result.entry);
  assert.equal(result.facts.downsideBreakdown, true);
});

test("evaluates a selected mean-reversion engine independently of breakout rules", () => {
  const rows = candles();
  rows[99] = { ...rows[99], open: 109.8, high: 110, low: 89, close: 90, volume: 100 };
  const result = analyzeCandles(rows, "mean-reversion", "balanced");
  assert.equal(result.engine, "mean-reversion");
  assert.equal(result.sensitivity, "balanced");
  assert.equal(result.hasSetup, true);
  assert.equal(result.setupSide, "buy");
  assert.ok(result.target > result.entry);
});

test("rejects insufficient history", () => {
  assert.throws(() => analyzeCandles(candles().slice(-20)), /Insufficient/);
});
