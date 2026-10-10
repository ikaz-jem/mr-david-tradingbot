import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const user = await browser.newContext({ baseURL: base, viewport: { width: 1440, height: 1000 } });
const admin = await browser.newContext({ baseURL: base, viewport: { width: 1440, height: 1000 } });
const anon = await browser.newContext({ baseURL: base });
const headers = { Origin: base };
async function login(context, role) {
  const csrf = await (await context.request.get("/api/auth/csrf")).json();
  const result = await context.request.post("/api/auth/callback/credentials", { headers, form: { csrfToken: csrf.csrfToken, demoRole: role, callbackUrl: base + "/dashboard", json: "true" } });
  assert.equal(result.status(), 200);
  const session = await (await context.request.get("/api/auth/session")).json();
  assert.equal(session.user?.role, role); return session.user.id;
}
async function post(context, path, data, expected = 200) {
  const response = await context.request.post(path, { headers, data });
  const result = await response.json();
  assert.equal(response.status(), expected, path + " " + JSON.stringify(result));
  return result;
}
async function state() { return (await (await user.request.get("/api/demo/billing")).json()).workspace; }
try {
  await login(user, "user"); await login(admin, "admin");
  assert.equal((await anon.request.get("/api/support")).status(), 401);
  assert.equal((await user.request.get("/api/admin/products")).status(), 403);
  await post(user, "/api/demo/billing", { kind: "monthly", itemId: "trader", requestId: randomUUID() });
  let before = await state();
  const id = randomUUID();
  await post(user, "/api/demo/billing", { kind: "topup", productId: "signals", requestId: id });
  const added = await state();
  assert.ok(added.wallets.signals > before.wallets.signals);
  await post(user, "/api/demo/billing", { kind: "topup", productId: "signals", requestId: id });
  assert.equal((await state()).wallets.signals, added.wallets.signals, "Duplicate must not grant credits twice");
  const scanId = randomUUID();
  const scan = await post(user, "/api/scans", { symbol: "SOLUSDT", interval: "1h", requestId: scanId });
  const charged = await state();
  assert.equal(charged.wallets.signals, added.wallets.signals - scan.cost);
  await post(user, "/api/scans", { symbol: "SOLUSDT", interval: "1h", requestId: scanId });
  assert.equal((await state()).wallets.signals, charged.wallets.signals, "Duplicate scan must not debit twice");
  await post(user, "/api/demo/billing", { kind: "expire", requestId: randomUUID() });
  await post(user, "/api/demo/billing", { kind: "topup", productId: "signals", requestId: randomUUID() }, 402);
  await post(user, "/api/scans", { symbol: "SOLUSDT", interval: "1h", requestId: randomUUID() }, 402);
  assert.equal((await state()).wallets.signals, charged.wallets.signals, "Expiry preserves credits");
  await post(user, "/api/demo/billing", { kind: "monthly", itemId: "starter", requestId: randomUUID() });
  const created = await post(user, "/api/support", { subject: "Demo workflow verification", category: "billing", body: "Testing a customer and staff support conversation in the demo workspace." }, 201);
  const userTickets = (await (await user.request.get("/api/support")).json()).tickets;
  let ticket = userTickets.find(item => item._id === created.id);
  assert.ok(ticket);
  const note = "INTERNAL-" + randomUUID();
  let response = await admin.request.patch("/api/support/" + created.id + "?view=staff", { headers, data: { revision: ticket.revision, body: note, internal: true, assignToMe: true, status: "in_progress" } });
  assert.equal(response.status(), 200);
  ticket = (await (await user.request.get("/api/support")).json()).tickets.find(item => item._id === created.id);
  assert.ok(!JSON.stringify(ticket).includes(note), "Staff note must not leak");
  response = await user.request.patch("/api/support/" + created.id + "?view=staff", { headers, data: { revision: ticket.revision, internal: true, body: "No staff access" } });
  assert.equal(response.status(), 403);
  response = await admin.request.patch("/api/support/" + created.id + "?view=staff", { headers, data: { revision: ticket.revision, body: "Your demo membership and credits are ready.", status: "resolved" } });
  assert.equal(response.status(), 200);
  assert.equal((await (await user.request.get("/api/support")).json()).tickets.find(item => item._id === created.id).status, "resolved");
  await post(user, "/api/demo/exchanges", { provider: "kraken", action: "connect" });
  await post(user, "/api/demo/exchanges", { provider: "kraken", action: "disconnect" });
  const catalog = (await (await admin.request.get("/api/admin/products")).json()).catalog;
  const product = catalog.find(item => item.slug === "signals");
  await post(admin, "/api/admin/products", { ...product, cost: product.cost + 1, reason: "Verify product cost controls debit" });
  try {
    const result = await post(user, "/api/scans", { symbol: "ETHUSDT", interval: "15m", requestId: randomUUID() });
    assert.equal(result.cost, product.cost + 1, "Admin catalog cost must control debit");
  } finally {
    const current = (await (await admin.request.get("/api/admin/products")).json()).catalog.find(item => item.slug === "signals");
    await post(admin, "/api/admin/products", { ...current, cost: product.cost, reason: "Restore product cost after test" });
  }
  const page = await user.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const path of ["/dashboard/credits", "/dashboard/signals", "/dashboard/performance", "/dashboard/exchanges", "/dashboard/support"]) {
    const response = await page.goto(base + path);
    assert.equal(response.status(), 200, path);
    await page.waitForLoadState("networkidle");
    assert.ok(!(await page.locator("body").innerText()).includes("Application error"), path);
  }
  await page.goto(base + "/dashboard/credits");
  await page.getByRole("heading", { name: "Product credit wallets" }).waitFor();
  const consent = page.getByRole("button", { name: "Essential only" });
  if (await consent.isVisible()) await consent.click();
  await page.screenshot({ path: "artifacts/upgrade-billing-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/upgrade-billing-mobile.png", fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Mobile must not overflow");
  const adminPage = await admin.newPage();
  for (const path of ["/admin", "/admin/users", "/admin/products", "/admin/support", "/admin/billing", "/admin/controls"]) assert.equal((await adminPage.goto(base + path)).status(), 200, path);
  assert.deepEqual(errors, [], "No client-side crashes");
  console.log("PASS: demo membership renewals, product top-ups, expiry locks, idempotent scans, ticket privacy, staff resolution, exchange previews, desktop/mobile pages.");
} finally { await browser.close(); }

