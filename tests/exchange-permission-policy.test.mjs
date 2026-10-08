import test from "node:test";
import assert from "node:assert/strict";
import { bybitPermissionDecision, krakenPermissionDecision, kucoinPermissionDecision, okxPermissionDecision } from "../src/lib/exchange-permission-policy.ts";

test("Bybit accepts only SpotTrade for execution", () => {
  assert.equal(bybitPermissionDecision(0, { Spot: ["SpotTrade"], Wallet: [] }, "spot_trade").allowed, true);
  assert.equal(bybitPermissionDecision(0, { Spot: ["SpotTrade"], Wallet: ["Withdraw"] }, "spot_trade").allowed, false);
  assert.equal(bybitPermissionDecision(1, { Spot: [] }, "read_only").allowed, true);
});

test("Bybit futures accepts only contract order or position powers", () => {
  assert.equal(bybitPermissionDecision(0, { ContractTrade: ["Order", "Position"] }, "futures_trade").allowed, true);
  assert.equal(bybitPermissionDecision(0, { ContractTrade: ["Order"], Wallet: ["Withdraw"] }, "futures_trade").allowed, false);
});

test("OKX accepts Read and Trade but never Withdraw", () => {
  assert.equal(okxPermissionDecision(["read_only", "trade"], "spot_trade").allowed, true);
  assert.equal(okxPermissionDecision(["read_only", "trade", "withdraw"], "spot_trade").allowed, false);
  assert.equal(okxPermissionDecision(["read_only"], "read_only").allowed, true);
  assert.equal(okxPermissionDecision(["read_only", "trade"], "futures_trade").allowed, true);
});

test("Kraken execution requires query and order permissions but denies funding powers", () => {
  const safe = ["Query Funds", "Query Open Orders & Trades", "Query Closed Orders & Trades", "Create & Modify Orders"];
  assert.equal(krakenPermissionDecision(safe, "spot_trade").allowed, true);
  assert.equal(krakenPermissionDecision([...safe, "Withdraw Funds"], "spot_trade").allowed, false);
  assert.equal(krakenPermissionDecision(["Query Funds"], "read_only").allowed, true);
});

test("KuCoin accepts only General and Spot for execution", () => {
  assert.equal(kucoinPermissionDecision(["general", "spot"], "spot_trade").allowed, true);
  assert.equal(kucoinPermissionDecision(["general", "spot", "margin"], "spot_trade").allowed, false);
  assert.equal(kucoinPermissionDecision(["general"], "read_only").allowed, true);
  assert.equal(kucoinPermissionDecision(["general", "futures"], "futures_trade").allowed, true);
  assert.equal(kucoinPermissionDecision(["general", "spot", "futures"], "futures_trade").allowed, false);
});
