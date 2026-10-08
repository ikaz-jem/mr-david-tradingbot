import assert from "node:assert/strict";
import test from "node:test";
import { platformConfigKey } from "../src/lib/platform-scope.ts";

test("public demo operators cannot select the live configuration record", () => {
  assert.equal(platformConfigKey(true), "demo");
  assert.equal(platformConfigKey(false), "global");
});
