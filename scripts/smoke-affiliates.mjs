import assert from "node:assert/strict";
import { chromium } from "playwright";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const admin = await browser.newContext({ baseURL: base });
const user = await browser.newContext({ baseURL: base });
const guest = await browser.newContext({ baseURL: base });
let initial;
const headers = { Origin: base };
async function login(context, role, path) {
  const page = await context.newPage();
  await page.goto("/login");
  const consent = page.getByRole("button", { name: "Essential only" });
  if (await consent.isVisible()) await consent.click();
  await page.getByRole("button", { name: `Demo ${role}`, exact: true }).click();
  await page.waitForURL(`**${path}`, { timeout: 30000 });
  return page;
}
try {
  assert.equal((await guest.request.get("/api/affiliates")).status(), 401);
  const adminPage = await login(admin, "admin", "/admin");
  const userPage = await login(user, "user", "/dashboard");
  assert.equal((await user.request.get("/api/admin/affiliates")).status(), 403);
  const report = await admin.request.get("/api/admin/affiliates");
  assert.equal(report.status(), 200, await report.text());
  initial = (await report.json()).config;
  let saved = await admin.request.post("/api/admin/affiliates", { headers, data: { action: "settings", ...initial, rates: [1250, 250, 125], reason: "Reversible affiliate settings test" } });
  assert.equal(saved.status(), 200, await saved.text());
  assert.deepEqual((await (await user.request.get("/api/affiliates")).json()).config.rates, [1250, 250, 125]);
  const userReport = await (await user.request.get("/api/affiliates")).json();
  const payoutSaved = await user.request.post("/api/affiliates", { headers, data: { method: "external", revision: userReport.payoutProfile.revision, label: "Demo finance desk", instructions: "Send through the verified finance contact on file." } });
  assert.equal(payoutSaved.status(), 200, await payoutSaved.text());
  const payoutProfile = (await (await user.request.get("/api/affiliates")).json()).payoutProfile;
  assert.equal(payoutProfile.method, "external");
  assert.equal(payoutProfile.details.instructions, "Send through the verified finance contact on file.");
  saved = await admin.request.post("/api/admin/affiliates", { headers, data: { action: "settings", ...initial, rates: [9000, 2000], reason: "Reject excessive commission rates" } });
  assert.equal(saved.status(), 400);
  saved = await user.request.post("/api/admin/affiliates", { headers, data: { action: "settings", ...initial, reason: "Customer must not change program" } });
  assert.equal(saved.status(), 403);
  await adminPage.goto("/admin/affiliates");
  await adminPage.getByText("Program settings", { exact: true }).waitFor();
  await userPage.goto("/dashboard/affiliates");
  await userPage.getByRole("textbox", { name: "Your referral link" }).waitFor();
  assert.match(await userPage.getByRole("textbox", { name: "Your referral link" }).inputValue(), /\/r\/[a-f0-9]{24}$/);
  assert.equal(await userPage.getByText("Program settings", { exact: true }).count(), 0);
  await userPage.setViewportSize({ width: 390, height: 844 });
  assert.equal(await userPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  console.log("PASS: affiliate dashboards, precise multilevel settings, authorization, invalid rates, and mobile layout.");
} finally {
  if (initial) {
    const restored = await admin.request.post("/api/admin/affiliates", { headers, data: { action: "settings", ...initial, reason: "Restore affiliate settings after test" } });
    assert.equal(restored.status(), 200, await restored.text());
  }
  await browser.close();
}
