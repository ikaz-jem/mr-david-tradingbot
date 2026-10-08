import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const context = await browser.newContext({ baseURL: base });
const page = await context.newPage();
const headers = { Origin: base };
let initial;
let userContext;
let publicContext;

async function update(field, value) {
  const response = await context.request.post("/api/admin/controls", { headers, data: { field, value, reason: "Automated reversible operations smoke test" } });
  assert.equal(response.status(), 200, await response.text());
}

try {
  await page.goto("/login");
  const consent = page.getByRole("button", { name: "Essential only" });
  if (await consent.isVisible()) await consent.click();
  await page.getByRole("button", { name: "Demo admin", exact: true }).click();
  await page.waitForURL("**/admin", { timeout: 30_000 });
  const initialResponse = await context.request.get("/api/admin/controls");
  assert.equal(initialResponse.status(), 200, await initialResponse.text());
  initial = (await initialResponse.json()).config;
  await update("maintenanceMode", false);

  userContext = await browser.newContext({ baseURL: base });
  const userPage = await userContext.newPage();
  await userPage.goto("/login");
  const userConsent = userPage.getByRole("button", { name: "Essential only" });
  if (await userConsent.isVisible()) await userConsent.click();
  await userPage.getByRole("button", { name: "Demo user", exact: true }).click();
  await userPage.waitForURL("**/dashboard", { timeout: 30_000 });

  await page.goto("/admin/controls/operations");
  await page.getByRole("heading", { name: "Maintenance mode" }).waitFor();
  assert.match(await page.locator("body").innerText(), /Approval Desk discovery/);
  assert.match(await page.locator("body").innerText(), /Activation and billing/);
  assert.match(await page.locator("body").innerText(), /Global operations scope/i);

  const registrationCard = page.locator("article").filter({ has: page.getByRole("heading", { name: "New registrations" }) });
  const registrationAction = initial.registrationOpen ? "Pause New registrations" : "Resume New registrations";
  await Promise.all([
    page.waitForResponse(response => response.url().endsWith("/api/admin/controls") && response.request().method() === "POST"),
    registrationCard.getByRole("button", { name: registrationAction }).click(),
  ]);
  await page.getByRole("status").filter({ hasText: /New registrations is now/ }).waitFor();
  let savedConfig = (await (await context.request.get("/api/admin/controls")).json()).config;
  assert.equal(savedConfig.registrationOpen, !initial.registrationOpen);

  await Promise.all([
    page.waitForResponse(response => response.url().endsWith("/api/admin/controls") && response.request().method() === "POST"),
    registrationCard.getByRole("button", { name: initial.registrationOpen ? "Resume New registrations" : "Pause New registrations" }).click(),
  ]);
  savedConfig = (await (await context.request.get("/api/admin/controls")).json()).config;
  assert.equal(savedConfig.registrationOpen, initial.registrationOpen);

  await update("registrationOpen", false);
  let blocked = await context.request.post("/api/auth/register", { headers, data: { name: "Paused Registration Check", email: `paused-${Date.now()}@example.com`, password: "PausedCheck-Password-2026" } });
  assert.equal(blocked.status(), 503, `registration gate: ${await blocked.text()}`);
  publicContext = await browser.newContext({ baseURL: base });
  const publicPage = await publicContext.newPage();
  await publicPage.goto("/register");
  await publicPage.getByRole("alert").filter({ hasText: /registrations are temporarily paused/i }).waitFor();
  await publicPage.getByRole("button", { name: "Registration paused" }).waitFor();

  await update("billingOpen", false);
  blocked = await userContext.request.post("/api/demo/billing", { headers, data: { kind: "topup", itemId: "credits_25", requestId: crypto.randomUUID() } });
  assert.equal(blocked.status(), 503, `billing gate: ${await blocked.text()}`);

  await update("exchangeConnectionsOpen", false);
  blocked = await userContext.request.post("/api/demo/exchanges", { headers, data: { provider: "kucoin", action: "connect" } });
  assert.equal(blocked.status(), 503, `exchange gate: ${await blocked.text()}`);

  await update("supportOpen", false);
  blocked = await userContext.request.post("/api/support", { headers, data: { subject: "Paused support check", category: "other", body: "This request must be rejected by operations." } });
  assert.equal(blocked.status(), 503, `support gate: ${await blocked.text()}`);

  await update("approvalDiscoveryOpen", false);
  blocked = await userContext.request.post("/api/approval", { headers, data: { action: "unlock", opportunityId: "000000000000000000000000" } });
  assert.equal(blocked.status(), 503, `approval gate: ${await blocked.text()}`);
  blocked = await userContext.request.post("/api/demo/trading-companion", { headers, data: { action: "find_opportunity", requestId: crypto.randomUUID(), strategySlug: "ai-router" } });
  assert.equal(blocked.status(), 503, `legacy approval gate: ${await blocked.text()}`);

  await update("autopilotOpen", false);
  blocked = await userContext.request.post("/api/demo/trading-companion", { headers, data: { action: "autopilot_run", requestId: crypto.randomUUID() } });
  assert.equal(blocked.status(), 503, `autopilot gate: ${await blocked.text()}`);

  await update("paperReconciliationOpen", false);
  blocked = await userContext.request.post("/api/paper/reconcile", { headers });
  assert.equal(blocked.status(), 503, `paper reconciliation gate: ${await blocked.text()}`);

  await userPage.goto("/register");
  await userPage.getByRole("alert").filter({ hasText: /registrations are temporarily paused/i }).waitFor();
  await userPage.goto("/dashboard/credits");
  await userPage.getByRole("alert").filter({ hasText: /billing paused/i }).waitFor();
  await userPage.goto("/dashboard/exchanges");
  await userPage.getByRole("alert").filter({ hasText: /new connections paused/i }).waitFor();
  await userPage.goto("/dashboard/support");
  await userPage.getByRole("alert").filter({ hasText: /new tickets paused/i }).waitFor();
  await userPage.goto("/dashboard/approval");
  await userPage.getByText("Approval Desk paused", { exact: true }).waitFor();
  await userPage.goto("/dashboard/autopilot");
  await userPage.getByText(/Autopilot is paused:/).waitFor();
  await userPage.goto("/dashboard/performance");
  await userPage.getByRole("button", { name: "Outcome refresh paused" }).waitFor();

  const pauseMessage = "Research is paused for a scheduled smoke-test window. No credit will be charged.";
  await update("scansPausedMessage", pauseMessage);
  await page.reload();
  const researchCard = page.locator("article").filter({ has: page.getByRole("heading", { name: "Research Scanner" }) });
  if (!initial.scansOpen) {
    await Promise.all([
      page.waitForResponse(response => response.url().endsWith("/api/admin/controls") && response.request().method() === "POST"),
      researchCard.getByRole("button", { name: "Resume Research Scanner" }).click(),
    ]);
  }
  await Promise.all([
    page.waitForResponse(response => response.url().endsWith("/api/admin/controls") && response.request().method() === "POST"),
    researchCard.getByRole("button", { name: "Pause Research Scanner" }).click(),
  ]);
  let options = await (await context.request.get("/api/scans/options")).json();
  assert.equal(options.scansOpen, false);
  assert.equal(options.operationsMessage, pauseMessage);

  const maintenanceMessage = "Scheduled platform maintenance smoke test. Customer writes are temporarily read-only.";
  await update("maintenanceMessage", maintenanceMessage);
  await update("maintenanceMode", true);
  options = await (await context.request.get("/api/scans/options")).json();
  assert.equal(options.scansOpen, false);
  assert.equal(options.operationsMessage, maintenanceMessage);

  console.log("PASS: UI switches persist immediately; registration, billing, exchanges, support, approval, autopilot, research, paper reconciliation, maintenance, messages, and admin access gates work.");
} finally {
  if (initial) {
    await update("maintenanceMode", initial.maintenanceMode).catch(() => undefined);
    await update("maintenanceMessage", initial.maintenanceMessage).catch(() => undefined);
    await update("scansOpen", initial.scansOpen).catch(() => undefined);
    await update("scansPausedMessage", initial.scansPausedMessage).catch(() => undefined);
    await update("registrationOpen", initial.registrationOpen).catch(() => undefined);
    await update("billingOpen", initial.billingOpen).catch(() => undefined);
    await update("exchangeConnectionsOpen", initial.exchangeConnectionsOpen).catch(() => undefined);
    await update("supportOpen", initial.supportOpen).catch(() => undefined);
    await update("approvalDiscoveryOpen", initial.approvalDiscoveryOpen).catch(() => undefined);
    await update("autopilotOpen", initial.autopilotOpen).catch(() => undefined);
    await update("paperReconciliationOpen", initial.paperReconciliationOpen).catch(() => undefined);
  }
  await userContext?.close();
  await publicContext?.close();
  await browser.close();
}
