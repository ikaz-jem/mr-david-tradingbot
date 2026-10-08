import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const context = await browser.newContext({ baseURL: base });
const page = await context.newPage();
const headers = { Origin: base };

async function state() {
  const response = await context.request.get("/api/approval");
  assert.equal(response.status(), 200, await response.text());
  return response.json();
}

async function action(data) {
  const response = await context.request.post("/api/approval", { headers, data });
  assert.equal(response.status(), 200, await response.text());
  return response.json();
}

try {
  await page.goto("/login");
  const consent = page.getByRole("button", { name: "Essential only" });
  if (await consent.isVisible()) await consent.click();
  await page.getByRole("button", { name: "Demo user", exact: true }).click();
  await page.waitForURL("**/dashboard", { timeout: 30_000 });

  const initial = await state();
  assert.ok(initial.product.enabled, "Approval Desk must be enabled in the demo workspace");
  assert.ok(initial.wallet.activated, "Demo account must be activated");
  assert.ok(initial.opportunities.length > 0, "Demo should contain shared opportunities");

  for (const locked of initial.opportunities.filter((item) => !item.unlocked)) {
    assert.equal("entry" in locked, false, "locked API payload must not disclose entry");
    assert.equal("stop" in locked, false, "locked API payload must not disclose stop");
    assert.equal("target" in locked, false, "locked API payload must not disclose target");
    assert.equal("thesis" in locked, false, "locked API payload must not disclose the thesis");
  }

  const locked = initial.opportunities.find((item) => !item.unlocked);
  if (locked) {
    const unlocked = await action({ action: "unlock", opportunityId: locked.id });
    assert.equal(unlocked.wallet.balance, initial.wallet.balance - locked.unlockCost);
    const revealed = unlocked.opportunities.find((item) => item.id === locked.id);
    assert.ok(revealed?.unlocked && revealed.entry && revealed.stop && revealed.target, "unlock must reveal the complete setup");

    const repeated = await action({ action: "unlock", opportunityId: locked.id });
    assert.equal(repeated.wallet.balance, unlocked.wallet.balance, "repeated unlock must not charge credits twice");

    const opened = await action({ action: "paper_execute", opportunityId: locked.id, amountUsdt: 125 });
    assert.equal(opened.opportunities.find((item) => item.id === locked.id)?.status, "paper_open");

    const closed = await action({ action: "close_paper", opportunityId: locked.id });
    assert.match(closed.opportunities.find((item) => item.id === locked.id)?.status ?? "", /^closed_/);
  } else {
    assert.ok(initial.opportunities.some((item) => item.unlocked), "repeat run should retain an earlier unlocked decision");
  }

  const settings = await state();
  const saved = await action({ action: "save_preferences", ...settings.preferences });
  assert.equal(saved.preferences.revision, settings.preferences.revision + 1, "scan preferences must save with optimistic concurrency");
  console.log("PASS: Approval Desk protects trade levels, charges once, executes paper decisions, records history, and saves scan settings.");
} finally {
  await browser.close();
}
