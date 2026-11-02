import test from "node:test";
import assert from "node:assert/strict";
import { mobileCustomerLoginAllowed, mobileRouteAccess } from "../src/lib/mobile-route-policy.ts";

test("mobile gateway exposes only selected public account operations", () => {
  assert.equal(mobileRouteAccess("auth/register", "POST"), "public");
  assert.equal(mobileRouteAccess("auth/forgot-password", "POST"), "public");
  assert.equal(mobileRouteAccess("auth/register", "GET"), "deny");
  assert.equal(mobileRouteAccess("auth/[...nextauth]", "GET"), "deny");
});

test("mobile gateway requires a user session for customer data and actions", () => {
  assert.equal(mobileRouteAccess("approval", "POST"), "user");
  assert.equal(mobileRouteAccess("account/password", "POST"), "user");
  assert.equal(mobileRouteAccess("exchange-connections/binance", "DELETE"), "user");
  assert.equal(mobileRouteAccess("support/507f1f77bcf86cd799439011", "PATCH"), "user");
});

test("mobile gateway denies administrative, scheduler and unapproved surfaces", () => {
  for (const path of ["admin/users", "admin/service-config", "internal/autopilot", "webhooks/paystack", "billing/checkout", "exchange-connections/coinbase", "support/507f1f77bcf86cd799439011/other"]) {
    assert.equal(mobileRouteAccess(path, "GET"), "deny", path);
  }
  assert.equal(mobileRouteAccess("approval", "DELETE"), "deny");
});

test("customer mobile login rejects platform roles", () => {
  assert.equal(mobileCustomerLoginAllowed("user"), true);
  for (const role of ["admin", "staff", "", "super-admin"]) {
    assert.equal(mobileCustomerLoginAllowed(role), false, role);
  }
});
