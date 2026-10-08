import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
});
const context = await browser.newContext({ baseURL: base });
const page = await context.newPage();
const headers = { Origin: base };
let originalPacks;

async function savePacks(value, reason) {
  const response = await context.request.post("/api/admin/controls", {
    headers,
    data: { field: "creditPacks", value, reason },
  });
  assert.equal(response.status(), 200, await response.text());
}

try {
  await page.goto("/login");
  const consent = page.getByRole("button", { name: "Essential only" });
  if (await consent.isVisible()) await consent.click();
  await page.getByRole("button", { name: "Demo admin", exact: true }).click();
  await page.waitForURL("**/admin", { timeout: 30_000 });

  const billing = await (await context.request.get("/api/demo/billing")).json();
  originalPacks = billing.config.creditPacks;
  const temporaryPack = {
    id: `smoke_pack_${Date.now().toString(36)}`,
    label: "Smoke verification pack",
    credits: 37,
    priceMinor: 1900,
    enabled: true,
  };

  await savePacks([...originalPacks, temporaryPack], "Verify credit pack creation and storefront propagation");
  await page.goto(`/pricing?pack-create=${Date.now()}`);
  const createdText = await page.locator("body").innerText();
  assert.match(createdText, /Smoke verification pack/i);
  assert.match(createdText, /37 credits/);
  assert.match(createdText, /\$19\.00/);

  await savePacks(originalPacks, "Verify credit pack deletion and storefront propagation");
  await page.goto(`/pricing?pack-delete=${Date.now()}`);
  const deletedText = await page.locator("body").innerText();
  assert.doesNotMatch(deletedText, /Smoke verification pack/i);
  console.log("PASS: admins can create and delete credit packs and pricing updates immediately.");
} finally {
  if (originalPacks) {
    await savePacks(originalPacks, "Restore credit pack catalog after automated verification").catch(() => undefined);
  }
  await browser.close();
}
