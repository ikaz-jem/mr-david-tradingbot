import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const context = await browser.newContext({ baseURL: base });
const page = await context.newPage();

try {
  await page.goto("/login");
  const consent = page.getByRole("button", { name: "Essential only" });
  if (await consent.isVisible()) await consent.click();
  await page.getByRole("button", { name: "Demo admin", exact: true }).click();
  await page.waitForURL("**/admin", { timeout: 30_000 });
  await page.goto("/dashboard/approval");
  await page.getByRole("heading", { name: "Approval Desk", exact: true }).waitFor({ timeout: 30_000 });
  await page.getByText("BTC/USDT", { exact: true }).waitFor();
  await page.getByText("ETH/USDT", { exact: true }).waitFor();
  assert.equal(await page.locator("article").getByText("Unlocked", { exact: true }).count(), 2);
  assert.equal(await page.getByText("LONG", { exact: true }).count(), 1);
  assert.equal(await page.getByText("SHORT", { exact: true }).count(), 1);
  console.log("PASS: Approval Desk renders two unlocked demo trades: BTC long and ETH short.");
} finally {
  await browser.close();
}
