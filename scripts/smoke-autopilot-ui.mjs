import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = process.env.APP_URL?.startsWith("http://localhost") ? process.env.APP_URL : "http://localhost:3000";
const browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
try {
  const admin = await browser.newContext();
  const page = await admin.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${origin}/login`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Demo admin" }).click();
  await page.waitForURL("**/admin", { timeout: 15_000 });
  await page.goto(`${origin}/admin/controls/autopilot`, { waitUntil: "networkidle" });
  assert.match(await page.locator("body").innerText(), /Demo administrators can preview/i);
  const state = await page.evaluate(async () => { const response = await fetch("/api/admin/autopilot"); return { status: response.status, body: await response.json() }; });
  assert.equal(state.status, 200); assert.equal(state.body.demo, true); assert.equal(state.body.canRun, false);
  const mutationStatus = await page.evaluate(async () => (await fetch("/api/admin/autopilot", { method: "POST" })).status);
  assert.equal(mutationStatus, 403);
  assert.deepEqual(errors, []);
  await admin.close();

  const customer = await browser.newContext();
  const userPage = await customer.newPage();
  const userErrors = [];
  userPage.on("pageerror", error => userErrors.push(error.message));
  await userPage.goto(`${origin}/login`, { waitUntil: "networkidle" });
  await userPage.getByRole("button", { name: "Demo user" }).click();
  await userPage.waitForURL("**/dashboard", { timeout: 15_000 });
  await userPage.goto(`${origin}/dashboard/autopilot`, { waitUntil: "networkidle" });
  assert.match(await userPage.locator("body").innerText(), /Guarded Autopilot/i);
  assert.deepEqual(userErrors, []);
  await customer.close();
  console.log("PASS: Autopilot demo customer UI renders; demo admin status is isolated and live worker mutation is denied.");
} finally { await browser.close(); }
