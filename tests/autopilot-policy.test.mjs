import test from "node:test";
import assert from "node:assert/strict";
import { autopilotDecision } from "../src/lib/autopilot-policy.ts";

const ready = { operationsOpen: true, productEnabled: true, certified: true, accountActive: true, countryAllowed: true, connected: true, credits: 10, creditCost: 2, dailyTrades: 0, maxDailyTrades: 3, openPositions: 0, maxOpenPositions: 2, dailyRealizedLossUsd: 0, dailyLossLimitUsd: 10, confidence: 80, minConfidence: 70, riskReward: 2, minRiskReward: 1.5 };
test("allows an eligible certified autopilot execution", () => assert.equal(autopilotDecision(ready).allowed, true));
test("fails closed for every production safety gate", () => {
  for (const change of [{ operationsOpen: false }, { productEnabled: false }, { certified: false }, { accountActive: false }, { countryAllowed: false }, { connected: false }, { credits: 1 }, { dailyTrades: 3 }, { openPositions: 2 }, { dailyRealizedLossUsd: 10 }, { confidence: 69 }, { riskReward: 1.4 }]) assert.equal(autopilotDecision({ ...ready, ...change }).allowed, false);
});
