import test from "node:test";
import assert from "node:assert/strict";
import { regulatedAccess } from "../src/lib/jurisdiction-policy.ts";

const base = { isDemo: false, countryCode: "NG", action: "billing", allowedCountries: "NG,GB", blockedCountries: "" };
test("allows a verified country on the configured allowlist", () => assert.equal(regulatedAccess(base).allowed, true));
test("fails closed when the production allowlist is missing", () => assert.equal(regulatedAccess({ ...base, allowedCountries: "" }).status, 503));
test("denies missing, unapproved, and explicitly blocked countries", () => {
  assert.equal(regulatedAccess({ ...base, countryCode: null }).status, 403);
  assert.equal(regulatedAccess({ ...base, countryCode: "US" }).status, 451);
  assert.equal(regulatedAccess({ ...base, blockedCountries: "NG" }).status, 451);
});
test("keeps demo simulations isolated from the live jurisdiction gate", () => assert.equal(regulatedAccess({ ...base, isDemo: true, allowedCountries: "" }).allowed, true));
