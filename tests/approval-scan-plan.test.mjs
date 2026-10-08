import test from "node:test";
import assert from "node:assert/strict";
import { buildApprovalScanPlan } from "../src/lib/approval-scan-plan.ts";

test("deduplicates identical user requests and records demand", () => {
  const plan = buildApprovalScanPlan([
    { symbols: ["BTCUSDT"], intervals: ["1h"], strategySlugs: ["ai-router"] },
    { symbols: ["BTCUSDT"], intervals: ["1h"], strategySlugs: ["ai-router"] },
    { symbols: ["ETHUSDT"], intervals: ["4h"], strategySlugs: ["mean-reversion"] },
  ], { symbols: ["BTCUSDT", "ETHUSDT"], intervals: ["1h", "4h"], strategySlugs: ["ai-router", "mean-reversion"], maxCombinations: 20 });
  assert.equal(plan.length, 2);
  assert.deepEqual(plan[0], { symbol: "BTCUSDT", interval: "1h", strategySlug: "ai-router", demand: 2 });
});

test("enforces the approved pool and prioritizes demand before the cap", () => {
  const plan = buildApprovalScanPlan([
    { symbols: ["SOLUSDT"], intervals: ["15m"], strategySlugs: ["momentum"] },
    { symbols: ["BTCUSDT"], intervals: ["1h"], strategySlugs: ["router"] },
    { symbols: ["BTCUSDT"], intervals: ["1h"], strategySlugs: ["router"] },
    { symbols: ["ETHUSDT"], intervals: ["4h"], strategySlugs: ["mean"] },
  ], { symbols: ["BTCUSDT", "ETHUSDT"], intervals: ["1h", "4h"], strategySlugs: ["router", "mean"], maxCombinations: 1 });
  assert.deepEqual(plan, [{ symbol: "BTCUSDT", interval: "1h", strategySlug: "router", demand: 2 }]);
});

test("duplicate values inside one preference do not inflate demand", () => {
  const plan = buildApprovalScanPlan([{ symbols: ["BTCUSDT", "BTCUSDT"], intervals: ["1h"], strategySlugs: ["router", "router"] }], { symbols: ["BTCUSDT"], intervals: ["1h"], strategySlugs: ["router"], maxCombinations: 5 });
  assert.equal(plan[0].demand, 1);
});
