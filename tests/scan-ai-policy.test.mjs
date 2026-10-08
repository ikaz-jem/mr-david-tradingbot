import assert from "node:assert/strict";
import { test } from "node:test";
import { enforceResearchDecision } from "../src/lib/scan-ai-policy.ts";

test("AI can veto an eligible setup but cannot bypass deterministic eligibility", () => {
  assert.equal(enforceResearchDecision(true, "publish"), "publish");
  assert.equal(enforceResearchDecision(true, "no_setup"), "no_setup");
  assert.equal(enforceResearchDecision(false, "publish"), "no_setup");
  assert.equal(enforceResearchDecision(false, "no_setup"), "no_setup");
});
