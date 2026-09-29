import test from "node:test";
import assert from "node:assert/strict";
import { hasMonthlyAccess, nextMonthlyEnd } from "../src/lib/membership-policy.ts";
import { scanInput } from "../src/lib/scanner.ts";
import { scanSymbols, scanIntervals } from "../src/lib/scan-markets.ts";
test("membership expires at the precise end instant", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  assert.equal(hasMonthlyAccess("2026-09-28T12:00:00Z", now), false);
  assert.equal(hasMonthlyAccess("2026-09-28T12:00:01Z", now), true);
  assert.equal(hasMonthlyAccess(null, now), false);
  assert.equal(hasMonthlyAccess("invalid", now), false);
});
test("membership calendar months clamp leap years and preserve UTC time", () => {
  assert.equal(nextMonthlyEnd(new Date("2028-01-31T10:12:13Z")).toISOString(), "2028-02-29T10:12:13.000Z");
  assert.equal(nextMonthlyEnd(new Date("2026-01-31T10:12:13Z")).toISOString(), "2026-02-28T10:12:13.000Z");
  assert.throws(() => nextMonthlyEnd(new Date("invalid")));
});
test("scanner accepts every configured market and timeframe", () => {
  for (const symbol of scanSymbols) for (const interval of scanIntervals) {
    assert.equal(scanInput.safeParse({ symbol, interval, requestId: "8ce350ae-08f8-4aa0-983a-511f60c00c6a" }).success, true);
  }
  assert.equal(scanInput.safeParse({ symbol: "BTCUSDT", interval: "1s", requestId: "8ce350ae-08f8-4aa0-983a-511f60c00c6a" }).success, false);
});

