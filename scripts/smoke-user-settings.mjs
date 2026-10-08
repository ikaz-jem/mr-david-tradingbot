import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const context = await browser.newContext({ baseURL: base });
const page = await context.newPage();
const headers = { Origin: base };
let original;

async function preferenceSnapshot() {
  return {
    timezone: await page.getByLabel("Timezone").inputValue(),
    locale: await page.getByLabel("Language").inputValue(),
    defaultSymbol: await page.getByLabel("Default market").inputValue(),
    defaultInterval: await page.getByLabel("Default candle").inputValue(),
    riskProfile: await page.getByLabel("Risk posture").inputValue(),
    compactMode: await page.getByLabel(/Compact data tables/).isChecked(),
    reducedMotion: await page.getByLabel(/Reduce motion/).isChecked(),
    inAppResearch: await page.getByLabel(/Research activity/).isChecked(),
    inAppBilling: await page.getByLabel(/Billing & credits/).isChecked(),
    inAppExchange: await page.getByLabel(/Exchange connections/).isChecked(),
    emailResearch: await page.getByLabel(/Research summaries/).isChecked(),
    emailBilling: await page.getByLabel(/Billing receipts/).isChecked(),
    emailSecurity: true,
  };
}

async function savePreferences(value) {
  const response = await context.request.patch("/api/account/preferences", { headers, data: value });
  assert.equal(response.status(), 200, await response.text());
}

try {
  await page.goto("/login");
  const consent = page.getByRole("button", { name: "Essential only" });
  if (await consent.isVisible()) await consent.click();
  await page.getByRole("button", { name: "Demo user", exact: true }).click();
  await page.waitForURL("**/dashboard", { timeout: 30_000 });
  await page.goto("/dashboard/settings");
  await page.getByRole("heading", { name: "Workspace preferences" }).waitFor();
  original = await preferenceSnapshot();

  const changed = {
    ...original,
    timezone: original.timezone === "Africa/Lagos" ? "UTC" : "Africa/Lagos",
    defaultSymbol: original.defaultSymbol === "ETHUSDT" ? "BTCUSDT" : "ETHUSDT",
    defaultInterval: original.defaultInterval === "1h" ? "4h" : "1h",
    riskProfile: original.riskProfile === "conservative" ? "balanced" : "conservative",
    compactMode: !original.compactMode,
    reducedMotion: !original.reducedMotion,
    inAppResearch: !original.inAppResearch,
  };
  const headerBox = await page.locator("header").boundingBox();
  const settingsMenuBox = await page.getByText("Account settings", { exact: true }).locator("xpath=..").boundingBox();
  assert.ok(headerBox && settingsMenuBox && settingsMenuBox.y >= headerBox.y + headerBox.height, "Settings menu must stay below the sticky header");
  await page.getByLabel("Timezone").selectOption(changed.timezone);
  await page.getByLabel("Default market").selectOption(changed.defaultSymbol);
  await page.getByLabel("Default candle").selectOption(changed.defaultInterval);
  await page.getByLabel("Risk posture").selectOption(changed.riskProfile);
  await page.getByLabel(/Compact data tables/).setChecked(changed.compactMode, { force: true });
  await page.getByLabel(/Reduce motion/).setChecked(changed.reducedMotion, { force: true });
  await page.getByLabel(/Research activity/).setChecked(changed.inAppResearch, { force: true });
  const [saveResponse] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith("/api/account/preferences") && response.request().method() === "PATCH"),
    page.getByRole("button", { name: "Save preferences" }).click(),
  ]);
  assert.equal(saveResponse.status(), 200, await saveResponse.text());
  await page.waitForTimeout(500);
  assert.match(await page.locator("body").innerText(), /Changes saved and applied across your workspace\./);

  const optionsResponse = await context.request.get("/api/scans/options");
  assert.equal(optionsResponse.status(), 200, await optionsResponse.text());
  const options = await optionsResponse.json();
  assert.equal(options.defaults.symbol, changed.defaultSymbol);
  assert.equal(options.defaults.interval, changed.defaultInterval);
  assert.equal(options.defaults.riskProfile, changed.riskProfile);

  await page.goto("/dashboard/settings");
  assert.equal(await page.getByLabel("Default market").inputValue(), changed.defaultSymbol);
  assert.equal(await page.getByLabel("Default candle").inputValue(), changed.defaultInterval);
  assert.equal(await page.getByLabel(/Compact data tables/).isChecked(), changed.compactMode);
  assert.equal(await page.getByLabel(/Research activity/).isChecked(), changed.inAppResearch);

  const exportResponse = await context.request.get("/api/account/export");
  assert.equal(exportResponse.status(), 200, await exportResponse.text());
  assert.match(exportResponse.headers()["content-disposition"] ?? "", /attachment/);
  const exported = await exportResponse.text();
  assert.doesNotMatch(exported, /passwordHash|apiKeyCiphertext|apiSecretCiphertext/);

  const sessions = await context.request.delete("/api/account/sessions", { headers });
  assert.equal(sessions.status(), 200, await sessions.text());
  assert.equal((await sessions.json()).simulated, true);
  const closure = await context.request.delete("/api/account", { headers, data: { password: "DemoPassword123!", confirmation: "CLOSE" } });
  assert.equal(closure.status(), 200, await closure.text());
  assert.equal((await closure.json()).simulated, true);
  console.log("PASS: settings persist, drive scanner defaults, export safely, and security actions work.");
} finally {
  if (original) await savePreferences(original).catch(() => undefined);
  await browser.close();
}
