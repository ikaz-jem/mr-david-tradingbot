import test from "node:test";
import assert from "node:assert/strict";
import { demoLoginEnabled, demoAdminPageAllowed, demoAdminApiAllowed, isShowcaseAccount } from "../src/lib/demo-policy.ts";
test("showcase login remains enabled for production review", () => {
  assert.equal(demoLoginEnabled(), true);
});
test("demo administration fails closed for non-allowlisted routes", () => {
  assert.equal(demoAdminPageAllowed("/admin/users"), true);
  assert.equal(demoAdminPageAllowed("/admin/users/0123456789abcdef01234567/preview"), true);
  for (const path of ["/admin/users/export"]) assert.equal(demoAdminPageAllowed(path), false);
  assert.equal(demoAdminPageAllowed("/admin/activity"), true);
  for (const path of ["/admin/data", "/admin/orders", "/admin/system"]) assert.equal(demoAdminPageAllowed(path), true);
  for (const path of ["/api/admin/billing/adjust", "/api/admin/emails/test", "/api/admin/signals/0123456789abcdef01234567/moderate"]) assert.equal(demoAdminApiAllowed(path), true);
  assert.equal(demoAdminApiAllowed("/api/admin/data/export"), false);
  assert.equal(demoAdminApiAllowed("/api/admin/users/0123456789abcdef01234567/access"), true);
});
test("showcase entry accounts cannot be locked by public demo visitors", () => {
  assert.equal(isShowcaseAccount("demo-admin@enrivea.invalid"), true);
  assert.equal(isShowcaseAccount("demo-user@enrivea.invalid"), true);
  assert.equal(isShowcaseAccount("sample-amara@enrivea.invalid"), false);
});
