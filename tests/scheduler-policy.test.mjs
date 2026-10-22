import test from "node:test";
import assert from "node:assert/strict";
import { schedulerAuthorized, jobHealth } from "../src/lib/scheduler-policy.ts";

test("internal workers deny missing, weak, incorrect and cookie-only authorization", () => {
  const secret = "scheduler-test-secret-32-characters";
  const request = authorization => new Request("https://app.invalid/api/internal/autopilot", { headers: authorization ? { authorization } : { cookie: "admin=true; demo=true" } });
  assert.equal(schedulerAuthorized(request(), secret), false);
  assert.equal(schedulerAuthorized(request("Bearer wrong"), secret), false);
  assert.equal(schedulerAuthorized(request("Bearer short"), "short"), false);
  assert.equal(schedulerAuthorized(request(`Bearer ${secret}`), secret), true);
});
test("job monitoring distinguishes never started, crashed, stale, failed and healthy", () => {
  const now = 1_000_000, recent = new Date(now - 1000);
  assert.equal(jobHealth(null, 5000, now), "not_started");
  assert.equal(jobHealth({ status: "running", leaseUntil: new Date(now - 1) }, 5000, now), "stalled");
  assert.equal(jobHealth({ status: "failed", lastSucceededAt: recent }, 5000, now), "failed");
  assert.equal(jobHealth({ status: "completed", lastSucceededAt: new Date(now - 6000) }, 5000, now), "stale");
  assert.equal(jobHealth({ status: "completed", lastSucceededAt: recent }, 5000, now), "healthy");
});
