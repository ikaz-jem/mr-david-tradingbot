import assert from "node:assert/strict";
import { test } from "node:test";
import { calculatePositionPnl, calculateTradeMetrics } from "../src/lib/trade-math.ts";

test("calculates BUY notional, quantity, target profit, stop loss and R:R", () => {
  assert.deepEqual(calculateTradeMetrics("BUY", 100, 95, 110, 1000), {
    amountUsdt: 1000, estimatedQuantity: 10, potentialProfitUsdt: 100,
    potentialLossUsdt: 50, riskReward: 2, targetReturnPct: 10, stopReturnPct: -5,
  });
});

test("calculates SELL P&L in the inverse price direction", () => {
  assert.deepEqual(calculateTradeMetrics("SELL", 100, 105, 90, 500), {
    amountUsdt: 500, estimatedQuantity: 5, potentialProfitUsdt: 50,
    potentialLossUsdt: 25, riskReward: 2, targetReturnPct: 10, stopReturnPct: -5,
  });
});

test("rejects invalid trade values", () => {
  assert.throws(() => calculateTradeMetrics("BUY", 0, 95, 110, 1000), /positive/);
});

test("marks BUY and SELL positions to market in the correct direction", () => {
  assert.deepEqual(calculatePositionPnl("BUY", 100, 104, 500), { pnlUsdt: 20, pnlPct: 4 });
  assert.deepEqual(calculatePositionPnl("SELL", 100, 96, 500), { pnlUsdt: 20, pnlPct: 4 });
  assert.deepEqual(calculatePositionPnl("SELL", 100, 103, 500), { pnlUsdt: -15, pnlPct: -3 });
});

test("rejects invalid mark-to-market inputs", () => {
  assert.throws(() => calculatePositionPnl("BUY", 100, 0, 500), /positive/);
});
