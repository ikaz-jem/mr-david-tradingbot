import assert from "node:assert/strict";
import { test } from "node:test";
import { commissionMinor, validAffiliateRates } from "../src/lib/affiliate-policy.ts";
test("affiliate percentages retain basis-point precision and round down minor units", () => {
  assert.equal(commissionMinor(3000, 1250), 375);
  assert.equal(commissionMinor(999, 333), 33);
  assert.equal(commissionMinor(3000, 0), 0);
  assert.throws(() => commissionMinor(3.5, 1000));
});
test("unilevel rates bound depth and total liability", () => {
  assert.equal(validAffiliateRates([1000]), true);
  assert.equal(validAffiliateRates([1000, 500, 250]), true);
  assert.equal(validAffiliateRates([5000, 5001]), false);
  assert.equal(validAffiliateRates(Array(6).fill(100)), false);
  assert.equal(validAffiliateRates([-1]), false);
  assert.equal(validAffiliateRates([]), false);
});
