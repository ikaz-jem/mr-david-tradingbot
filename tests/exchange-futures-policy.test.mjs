import test from "node:test";
import assert from "node:assert/strict";
import { futuresNotional, validateFuturesExecutionConfig } from "../src/lib/exchange-futures-policy.ts";

test("futures settings are provider constrained and deny unsupported values", () => {
  assert.equal(validateFuturesExecutionConfig("binance", { leverage: 10, marginMode: "isolated", positionMode: "one_way", triggerPriceType: "mark" }).allowed, true);
  assert.equal(validateFuturesExecutionConfig("kraken", { leverage: 11, marginMode: "cross", positionMode: "one_way", triggerPriceType: "mark" }).allowed, false);
  assert.equal(validateFuturesExecutionConfig("kraken", { leverage: 5, marginMode: "isolated", positionMode: "one_way", triggerPriceType: "mark" }).allowed, false);
});

test("futures amount means margin and produces explicit leveraged notional", () => {
  assert.equal(futuresNotional(100, 5), 500);
  assert.throws(() => futuresNotional(5, 2));
  assert.throws(() => futuresNotional(100, 25));
});
