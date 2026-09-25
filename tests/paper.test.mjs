import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePaperSignal, paperStartTime } from "../src/lib/paper.ts";

const base = Date.parse("2026-09-25T10:00:00.000Z");
const signal = { entry: 100, stop: 95, target: 110, createdAt: new Date(base + 30_000), expiresAt: new Date(base + 5 * 60_000 + 30_000) };
const candle = (minute, open, high, low, close) => ({ openTime: base + minute * 60_000, closeTime: base + (minute + 1) * 60_000 - 1, open, high, low, close });

test("starts with the first full minute after publication", () => {
  assert.equal(paperStartTime(signal.createdAt), base + 60_000);
  const result = evaluatePaperSignal(signal, [candle(0, 100, 111, 90, 100), candle(1, 102, 103, 99, 101)], new Date(base + 2 * 60_000));
  assert.equal(result.status, "open");
});

test("uses adverse stop on ambiguous entry minute", () => {
  const result = evaluatePaperSignal(signal, [candle(1, 100, 112, 94, 100)], new Date(base + 2 * 60_000));
  assert.equal(result.reason, "stop");
  assert.ok(result.netReturnPct < 0);
});

test("records target with explicit round-trip costs", () => {
  const result = evaluatePaperSignal(signal, [candle(1, 100, 101, 99, 100), candle(2, 105, 111, 104, 110)], new Date(base + 3 * 60_000));
  assert.equal(result.reason, "target");
  assert.ok(result.netReturnPct > 9 && result.netReturnPct < 10);
});

test("expires unfilled setup without a return", () => {
  const rows = [1, 2, 3, 4].map(i => candle(i, 105, 106, 104, 105));
  const result = evaluatePaperSignal(signal, rows, new Date(base + 6 * 60_000));
  assert.equal(result.status, "expired");
  assert.equal(result.netReturnPct, null);
});

test("does not finalize if required market history is missing", () => {
  assert.throws(() => evaluatePaperSignal(signal, [candle(1, 100, 101, 99, 100)], new Date(base + 6 * 60_000)), /gaps/);
});
