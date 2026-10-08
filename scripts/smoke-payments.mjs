import assert from "node:assert/strict";
import { request } from "playwright";
const baseURL = process.env.TEST_BASE_URL || "http://localhost:3000";
const admin = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
const user = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
async function json(response, status = 200) { assert.equal(response.status(), status, await response.text()); return response.json(); }
async function login(client, demoRole) {
  const { csrfToken } = await json(await client.get("/api/auth/csrf"));
  await client.post("/api/auth/callback/credentials", { form: { csrfToken, demoRole, json: "true", callbackUrl: baseURL } });
  const session = await json(await client.get("/api/auth/session"));
  assert.equal(session.user?.isDemo, true);
}
let originals = [];
async function save(gateway, enabled) {
  return json(await admin.post("/api/admin/payment-gateways", { data: { ...gateway, enabled, reason: "Reversible payment integration smoke test" } }));
}
try {
  await login(admin, "admin"); await login(user, "user");
  originals = (await json(await admin.get("/api/admin/payment-gateways"))).gateways;
  assert.ok(originals.every(g => g.mode === "demo"), "Only run this smoke test against demo simulation configuration");
  assert.equal((await user.get("/api/admin/payment-gateways")).status(), 403);
  let methods = await json(await user.get("/api/billing/methods"));
  assert.equal(methods.config.billingOpen, true, "Billing must be open for this smoke test");
  assert.ok(methods.account.activated, "Use an activated demo user for refill smoke tests");
  const pack = methods.config.creditPacks.find(p => p.enabled);
  assert.ok(pack);
  for (const gateway of originals) {
    await save(gateway, false);
    assert.equal((await user.post("/api/billing/checkout", { data: { kind: "topup", itemId: pack.id, provider: gateway.provider } })).status(), 503);
    await save(gateway, true);
    const before = methods.account.balance;
    const checkout = await json(await user.post("/api/billing/checkout", { data: { kind: "topup", itemId: pack.id, provider: gateway.provider } }));
    const reference = checkout.url.split("/").at(-1);
    const route = `/api/billing/purchases/${reference}`;
    assert.equal((await admin.get(route)).status(), 404, "Purchases are owner-only even for admin");
    await json(await user.post(route, { data: { action: "simulate" } }));
    await json(await user.post(route, { data: { action: "simulate" } }));
    methods = await json(await user.get("/api/billing/methods"));
    assert.equal(methods.account.balance, before + pack.credits, "Credit grant is exactly once");
    const receipt = await json(await user.get(route));
    assert.equal(receipt.purchase.status, "paid");
    assert.equal((await user.get(checkout.url)).status(), 200);
    console.log(`PASS ${gateway.provider}: disable enforced, checkout, owner isolation, exactly-once demo refill, receipt page`);
  }
  for (const path of ["/admin/controls/payments", "/admin/billing"]) assert.equal((await admin.get(path)).status(), 200);
  assert.equal((await user.get("/dashboard/credits")).status(), 200);
  console.log("PASS admin payment configuration and billing pages");
} finally {
  for (const gateway of originals) await save(gateway, gateway.enabled);
  await admin.dispose(); await user.dispose();
}
