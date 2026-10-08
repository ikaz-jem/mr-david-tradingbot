import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const context = await browser.newContext({ baseURL: base });
const page = await context.newPage();
const headers = { Origin: base };
let original;

async function set(field, value, reason) {
  const response = await context.request.post("/api/admin/controls", { headers, data: { field, value, reason } });
  assert.equal(response.status(), 200, await response.text());
}

try {
  await page.goto("/login");
  const consent = page.getByRole("button", { name: "Essential only" });
  if (await consent.isVisible()) await consent.click();
  await page.getByRole("button", { name: "Demo admin", exact: true }).click();
  await page.waitForURL("**/admin", { timeout: 30_000 });
  original = (await (await context.request.get("/api/demo/billing")).json()).config;
  const changedPrice = original.activationPriceMinor + 100;
  const changedCredits = original.activationCredits + 1;
  await set("activationPriceMinor", changedPrice, "Automated pricing propagation verification");
  await set("activationCredits", changedCredits, "Automated credit propagation verification");

  await page.goto(`/pricing?verify=${Date.now()}`);
  const changedText = await page.locator("body").innerText();
  assert.match(changedText, new RegExp(`\\$${(changedPrice / 100).toFixed(2).replace(".", "\\.")}`));
  assert.match(changedText, new RegExp(`Includes ${changedCredits} shared platform credits`));
  console.log("PASS: admin price and included-credit changes propagate immediately to pricing.");
} finally {
  if (original) {
    await set("activationPriceMinor", original.activationPriceMinor, "Restore price after propagation verification").catch(() => undefined);
    await set("activationCredits", original.activationCredits, "Restore credits after propagation verification").catch(() => undefined);
  }
  await browser.close();
}
