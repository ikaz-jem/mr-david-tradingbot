import test from "node:test";
import assert from "node:assert/strict";
import { canGrantPermissions, permissionImplies, resolvePermissionEffects, sameTenant } from "../src/lib/access-control-policy.ts";

test("authorization denies by default", () => {
  assert.equal(resolvePermissionEffects([], []).can("users:read"), false);
});

test("resource manage implies resource actions but not other resources", () => {
  assert.equal(permissionImplies("users:manage", "users:update"), true);
  assert.equal(permissionImplies("users:manage", "billing:read"), false);
  assert.equal(permissionImplies("*: *".replace(" ", ""), "billing:update"), true);
});

test("direct user deny wins over every role allow", () => {
  const access = resolvePermissionEffects(
    [{ key: "users:manage", effect: "allow", source: "role:admin" }],
    [{ key: "users:read", effect: "deny", source: "user-override" }],
  );
  assert.equal(access.can("users:read"), false);
  assert.equal(access.can("users:update"), true);
});

test("direct user allow wins over a role deny", () => {
  const access = resolvePermissionEffects(
    [{ key: "billing:read", effect: "deny", source: "role:restricted" }],
    [{ key: "billing:read", effect: "allow", source: "user-override" }],
  );
  assert.equal(access.can("billing:read"), true);
});

test("tenant guard rejects missing and cross-organization access", () => {
  assert.equal(sameTenant("org-a", "org-a"), true);
  assert.equal(sameTenant("org-a", "org-b"), false);
  assert.equal(sameTenant("org-a", null), false);
});

test("delegation cannot grant permissions the actor does not hold", () => {
  assert.equal(canGrantPermissions(["users:manage"], ["users:read", "users:update"]), true);
  assert.equal(canGrantPermissions(["users:read"], ["users:update"]), false);
  assert.equal(canGrantPermissions(["*:*"] , ["settings:update", "roles:delete"]), true);
});
