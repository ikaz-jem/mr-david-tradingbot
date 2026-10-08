import test from "node:test";
import assert from "node:assert/strict";
import { approvalExecutionAccess } from "../src/lib/approval-execution-policy.ts";

const ready = { authenticated: true, active: true, isDemo: false, ownsUnlock: true, explicitlyConfirmed: true, operationsOpen: true, connectionAccess: "spot_trade" };
test("allows only an explicitly confirmed owner with Spot execution access", () => assert.equal(approvalExecutionAccess(ready).allowed, true));
test("denies demo, cross-owner, read-only and unconfirmed execution", () => {
  for (const changed of [{ isDemo: true }, { ownsUnlock: false }, { connectionAccess: "read_only" }, { explicitlyConfirmed: false }]) assert.equal(approvalExecutionAccess({ ...ready, ...changed }).allowed, false);
});
