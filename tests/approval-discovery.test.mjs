import assert from "node:assert/strict";
import test from "node:test";
import { approvalDiscoveryStatus } from "../src/lib/approval-discovery-status.ts";
import { approvalPaperExit } from "../src/lib/approval-paper.ts";
import { canAccessLiveApprovalScanner } from "../src/lib/approval-access-policy.ts";

test("live scanner denies anonymous, demo and customer actors despite claimed permissions", () => {
  const actor = { isDemo: false, organizationKind: "platform", can: permission => permission === "settings:read" };
  assert.equal(canAccessLiveApprovalScanner(null), false);
  assert.equal(canAccessLiveApprovalScanner(actor), true);
  assert.equal(canAccessLiveApprovalScanner(actor, true), false);
  assert.equal(canAccessLiveApprovalScanner({ ...actor, can: () => true }, true), true);
  assert.equal(canAccessLiveApprovalScanner({ ...actor, isDemo: true, can: () => true }, true), false);
  assert.equal(canAccessLiveApprovalScanner({ ...actor, organizationKind: "customer", can: () => true }, true), false);
});

const input = { operationsOpen: true, productEnabled: true, preferenceEnabled: true, demo: false, cadenceMinutes: 5 };
test("enabled preference never claims running discovery without a completed job", () => {
  assert.equal(approvalDiscoveryStatus(input).label, "Waiting for first scan");
  assert.equal(approvalDiscoveryStatus({ ...input, productEnabled: false }).label, "Product unavailable");
  assert.equal(approvalDiscoveryStatus({ ...input, operationsOpen: false }).label, "Discovery paused");
  assert.equal(approvalDiscoveryStatus({ ...input, job: { status: "failed", lastError: "secret details" } }).label, "Discovery needs attention");
  assert.ok(!approvalDiscoveryStatus({ ...input, job: { status: "failed", lastError: "secret details" } }).detail.includes("secret"));
  assert.equal(approvalDiscoveryStatus({ ...input, job: { status: "running", leaseUntil: new Date(0) } }).label, "Scan interrupted");
  assert.equal(approvalDiscoveryStatus({ ...input, job: { status: "completed", completedAt: new Date(0) } }).label, "Scan overdue");
});
const candle = { openTime: 0, closeTime: 59999, open: 100, close: 101, high: 115, low: 85 };
test("paper exits handle both directions and adverse intrabar ordering", () => {
  assert.equal(approvalPaperExit("BUY", 90, 110, [candle], 0).status, "closed_stop");
  assert.equal(approvalPaperExit("SELL", 110, 90, [candle], 0).status, "closed_stop");
  assert.equal(approvalPaperExit("BUY", 90, 110, [{ ...candle, low: 95 }], 0).status, "closed_target");
  assert.equal(approvalPaperExit("SELL", 110, 90, [{ ...candle, high: 105 }], 0).status, "closed_target");
  assert.throws(() => approvalPaperExit("BUY", 90, 110, [{ ...candle, openTime: 60000 }], 0));
});
