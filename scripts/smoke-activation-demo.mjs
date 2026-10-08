import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";

const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const context = await browser.newContext({ baseURL: base });
const page = await context.newPage();
const headers = { Origin: base };

try {
  await page.goto("/login");
  const consent = page.getByRole("button", { name: "Essential only" });
  if (await consent.isVisible()) await consent.click();
  await page.getByRole("button", { name: "Demo user", exact: true }).click();
  await page.waitForURL("**/dashboard", { timeout: 30_000 });

  let response = await context.request.post("/api/demo/billing", { headers, data: { kind: "reset", requestId: randomUUID() } });
  assert.equal(response.status(), 200, await response.text());
  let billing = await (await context.request.get("/api/demo/billing")).json();
  assert.ok(!billing.workspace.activatedAt);
  assert.equal(billing.workspace.creditBalance, 0);

  response = await context.request.post("/api/demo/billing", { headers, data: { kind: "activation", requestId: randomUUID() } });
  assert.equal(response.status(), 200, await response.text());
  billing = await (await context.request.get("/api/demo/billing")).json();
  assert.ok(billing.workspace.activatedAt);
  assert.equal(billing.workspace.creditBalance, billing.config.activationCredits);

  const pack = billing.config.creditPacks.find(item => item.enabled);
  response = await context.request.post("/api/demo/billing", { headers, data: { kind: "topup", itemId: pack.id, requestId: randomUUID() } });
  assert.equal(response.status(), 200, await response.text());
  const refilled = await (await context.request.get("/api/demo/billing")).json();
  assert.equal(refilled.workspace.creditBalance, billing.config.activationCredits + pack.credits);
  console.log("PASS: demo reset, one-time activation, included credits, and shared-credit refill.");
} finally {
  await browser.close();
}
