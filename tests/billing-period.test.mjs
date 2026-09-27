import assert from "node:assert/strict";
import { test } from "node:test";
import { addCalendarMonth } from "../src/lib/billing-period.ts";

test("monthly billing clamps end-of-month dates", () => {
  assert.equal(addCalendarMonth(new Date("2026-01-31T13:24:00.000Z")).toISOString(), "2026-02-28T13:24:00.000Z");
  assert.equal(addCalendarMonth(new Date("2028-01-31T13:24:00.000Z")).toISOString(), "2028-02-29T13:24:00.000Z");
});

test("monthly billing preserves ordinary UTC time", () => {
  assert.equal(addCalendarMonth(new Date("2026-09-15T06:07:08.009Z")).toISOString(), "2026-10-15T06:07:08.009Z");
});
