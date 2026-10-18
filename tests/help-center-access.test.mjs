import test from "node:test";
import assert from "node:assert/strict";
import { permissionCatalog, systemRoleTemplates } from "../src/lib/access-control-catalog.ts";
import { demoAdminApiAllowed, demoAdminPageAllowed } from "../src/lib/demo-policy.ts";

test("Help Center editorial permissions are explicit and not granted to customers", () => {
  const keys = permissionCatalog.map(row => row[0]);
  for (const key of ["help:read", "help:create", "help:update", "help:publish", "help:delete"]) assert.ok(keys.includes(key));
  const bySlug = new Map(systemRoleTemplates.map(role => [role.slug, role]));
  assert.deepEqual(bySlug.get("customer").permissions, []);
  assert.ok(bySlug.get("admin").permissions.includes("help:publish"));
  assert.ok(bySlug.get("staff").permissions.includes("help:read"));
  assert.ok(!bySlug.get("staff").permissions.includes("help:publish"));
});

test("demo editorial routes are allowlisted but arbitrary admin paths remain blocked", () => {
  assert.equal(demoAdminPageAllowed("/admin/help"), true);
  assert.equal(demoAdminPageAllowed("/admin/help/preview/0123456789abcdef01234567"), true);
  assert.equal(demoAdminPageAllowed("/admin/help/preview/not-an-id"), false);
  assert.equal(demoAdminPageAllowed("/admin/help/export"), false);
});

test("R2 storage controls are explicitly available only in the demo admin scope", () => {
  assert.equal(demoAdminPageAllowed("/admin/controls/storage"), true);
  assert.equal(demoAdminApiAllowed("/api/admin/storage-config"), true);
  assert.equal(demoAdminApiAllowed("/api/admin/storage-config/secret"), false);
});
