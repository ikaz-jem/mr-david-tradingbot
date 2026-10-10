import assert from "node:assert/strict";
import { chromium } from "playwright";
import mongoose from "mongoose";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const admin = await browser.newContext({ baseURL: base, viewport: { width: 1440, height: 1000 } });
const headers = { Origin: base };
async function login() {
  const csrf = await (await admin.request.get("/api/auth/csrf")).json();
  const response = await admin.request.post("/api/auth/callback/credentials", { headers, form: { csrfToken: csrf.csrfToken, demoRole: "admin", callbackUrl: base + "/admin", json: "true" } });
  assert.equal(response.status(), 200);
}
try {
  await mongoose.connect(process.env.MONGODB_URI);
  await login();
  const page = await admin.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const routes = ["/admin", "/admin/controls", "/admin/activity", "/admin/data", "/admin/users", "/admin/signals", "/admin/orders", "/admin/billing", "/admin/products", "/admin/strategies", "/admin/support", "/admin/emails", "/admin/system"];
  for (const route of routes) {
    const response = await page.goto(base + route);
    assert.equal(response.status(), 200, route);
    await page.waitForLoadState("networkidle");
    assert.ok(!(await page.locator("body").innerText()).includes("Application error"), route);
  }
  await page.goto(base + "/admin");
  for (const label of ["Control room", "Platform controls", "Activity", "Data explorer", "Users", "Signal health", "Orders", "Billing", "Products", "Strategies", "Support inbox", "Email delivery", "System"]) {
    assert.equal(await page.getByRole("link", { name: label, exact: true }).count(), 1, "Missing admin navigation: " + label);
  }
  const real = await mongoose.connection.db.collection("users").findOne({ isDemo: { $ne: true } });
  if (real) {
    await page.goto(base + "/admin/data?category=users");
    assert.ok(!(await page.locator("body").innerText()).includes(real.email), "Demo data explorer exposed a real account");
  }
  const catalogResponse = await admin.request.get("/api/admin/products");
  const catalog = (await catalogResponse.json()).catalog;
  const portfolio = catalog.find(item => item.slug === "portfolio");
  const updated = await admin.request.post("/api/admin/products", { headers, data: { ...portfolio, enabled: true, reason: "Verify audited catalog persistence" } });
  assert.equal(updated.status(), 200, await updated.text());
  const saved = (await (await admin.request.get("/api/admin/products")).json()).catalog.find(item => item.slug === "portfolio");
  assert.equal(saved.enabled, true);
  await admin.request.post("/api/admin/products", { headers, data: { ...saved, enabled: portfolio.enabled, reason: "Restore catalog after navigation test" } });
  const noReason = await admin.request.post("/api/admin/products", { headers, data: { ...portfolio, enabled: portfolio.enabled } });
  assert.equal(noReason.status(), 400, "Product mutations must require an audit reason");
  const strategyResponse = await admin.request.get("/api/admin/strategies");
  assert.equal(strategyResponse.status(), 200);
  const strategies = (await strategyResponse.json()).catalog;
  const strategy = strategies.find(item => item.slug !== "ai-router") ?? strategies[0];
  assert.ok(strategy, "At least one strategy must be available");
  const strategyUpdated = await admin.request.post("/api/admin/strategies", { headers, data: { ...strategy, description: `${strategy.description} `.trim(), reason: "Verify audited strategy persistence" } });
  assert.equal(strategyUpdated.status(), 200, await strategyUpdated.text());
  const strategySaved = (await (await admin.request.get("/api/admin/strategies")).json()).catalog.find(item => item.slug === strategy.slug);
  assert.ok(strategySaved.revision > strategy.revision, "Strategy revision must advance");
  const strategyRestored = await admin.request.post("/api/admin/strategies", { headers, data: { ...strategy, revision: strategySaved.revision, reason: "Restore strategy after navigation test" } });
  assert.equal(strategyRestored.status(), 200, await strategyRestored.text());
  assert.deepEqual(errors, []);
  console.log("PASS: complete admin navigation, demo isolation, reason-gated product writes, and reversible product/strategy persistence.");
} finally {
  await browser.close();
  await mongoose.disconnect();
}
