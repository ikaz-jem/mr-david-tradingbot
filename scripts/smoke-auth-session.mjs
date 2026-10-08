import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const context = await browser.newContext({ baseURL: base });
const page = await context.newPage();

try {
  await page.goto("/login");
  const consent = page.getByRole("button", { name: "Essential only" });
  if (await consent.isVisible()) await consent.click();
  await page.getByRole("button", { name: "Demo admin", exact: true }).click();
  await page.waitForURL("**/admin", { timeout: 30_000 });
  const session = await (await context.request.get("/api/auth/session")).json();
  assert.equal(session.user?.role, "admin");
  await page.goto("/");
  await page.getByRole("link", { name: "Open workspace", exact: true }).waitFor();
  assert.equal(await page.getByRole("link", { name: "Sign in", exact: true }).count(), 0);
  const demoBilling = await (await context.request.get("/api/demo/billing")).json();
  await page.goto("/pricing");
  const pricingText = await page.locator("body").innerText();
  assert.match(pricingText, new RegExp(`\\$${(demoBilling.config.activationPriceMinor / 100).toFixed(2).replace(".", "\\.")}`));
  assert.match(pricingText, new RegExp(`Includes ${demoBilling.config.activationCredits} shared platform credits`));
  await page.goto("/login");
  await page.waitForURL("**/admin", { timeout: 15_000 });
  console.log("PASS: first-click login, authenticated landing header, scoped pricing propagation, and authenticated login redirect.");
} finally {
  await browser.close();
}
