import assert from "node:assert/strict";
import { chromium } from "playwright";
import mongoose from "mongoose";
import { encode } from "next-auth/jwt";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const admin = await browser.newContext({ baseURL: base, viewport: { width: 1440, height: 1000 } });
const customer = await browser.newContext({ baseURL: base });
const page = await admin.newPage();
const headers = { Origin: base };
let target;
async function mintCustomerSession(record) {
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET, token: { sub: String(record._id), name: record.name, email: record.email, role: record.role, isDemo: true, authVersion: record.authVersion }, maxAge: 3600 });
  await customer.addCookies([{ name: "next-auth.session-token", value: token, url: base, httpOnly: true, sameSite: "Lax" }]);
  return (await (await customer.request.get("/api/auth/session")).json()).user?.id;
}
async function change(data) {
  const response = await admin.request.post("/api/admin/users/" + target._id + "/access", { headers, data: { ...data, reason: "Automated showcase access verification" } });
  assert.equal(response.status(), 200, await response.text());
}
try {
  await page.goto(base + "/login");
  const consent = page.getByRole("button", { name: "Essential only" });
  if (await consent.isVisible()) await consent.click();
  assert.ok(await page.getByRole("button", { name: "Demo user", exact: true }).isVisible());
  await page.getByRole("button", { name: "Demo admin", exact: true }).click();
  await page.waitForURL("**/admin", { timeout: 30000 });
  await mongoose.connect(process.env.MONGODB_URI);
  target = await mongoose.connection.db.collection("users").findOne({ email: "sample-amara@enrivea.invalid", isDemo: true });
  assert.ok(target);
  if (target.status !== "active") await change({ action: "set_status", value: "active" });
  target = await mongoose.connection.db.collection("users").findOne({ _id: target._id });
  assert.equal(await mintCustomerSession(target), String(target._id));
  await page.goto(base + "/admin/users");
  await page.getByRole("button", { name: "Manage Amara Okafor", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Audit reason").fill("CEO showcase: verify account ban controls");
  await dialog.getByRole("button", { name: "Ban user", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirm change", exact: true }).click();
  await dialog.getByRole("button", { name: "Unban user", exact: true }).waitFor();
  assert.equal((await mongoose.connection.db.collection("users").findOne({ _id: target._id })).status, "banned");
  assert.ok(!(await (await customer.request.get("/api/auth/session")).json()).user?.id, "Banned session must be invalidated");
  await dialog.getByLabel("Audit reason").fill("CEO showcase: restore customer after testing");
  await dialog.getByRole("button", { name: "Unban user", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirm change", exact: true }).click();
  await dialog.getByRole("button", { name: "Ban user", exact: true }).waitFor();
  assert.equal((await mongoose.connection.db.collection("users").findOne({ _id: target._id })).status, "active");
  target = await mongoose.connection.db.collection("users").findOne({ _id: target._id });
  assert.equal(await mintCustomerSession(target), String(target._id));
  await change({ action: "revoke_sessions" });
  assert.ok(!(await (await customer.request.get("/api/auth/session")).json()).user?.id, "Revoked session must be invalidated");
  await change({ action: "set_status", value: "suspended" });
  assert.equal((await mongoose.connection.db.collection("users").findOne({ _id: target._id })).status, "suspended");
  await change({ action: "set_status", value: "active" });
  await change({ action: "set_role", value: "staff" });
  assert.equal((await mongoose.connection.db.collection("users").findOne({ _id: target._id })).role, "staff");
  await change({ action: "set_role", value: "user" });
  await page.goto(base + "/admin/users?status=banned&role=user&q=Leila");
  assert.ok(await page.getByRole("button", { name: "Manage Leila Hassan", exact: true }).isVisible());
  assert.equal(await page.getByRole("button", { name: "Manage Amara Okafor", exact: true }).count(), 0);
  await page.goto(base + "/admin/users");
  await page.getByRole("button", { name: "Manage Amara Okafor", exact: true }).click();
  await dialog.getByLabel("Audit reason").fill("CEO showcase: inspect customer workspace");
  await dialog.getByRole("button", { name: "View as user · read-only", exact: true }).click();
  await page.waitForURL("**/preview?audit=*", { timeout: 15000 });
  assert.match(await page.locator("body").innerText(), /Your administrator identity has not changed/);
  const previewUrl = page.url();
  const session = await (await admin.request.get("/api/auth/session")).json();
  assert.equal(session.user.role, "admin");
  const grantId = new URL(previewUrl).searchParams.get("audit");
  const audit = await mongoose.connection.db.collection("adminauditevents").findOne({ _id: new mongoose.Types.ObjectId(grantId) });
  assert.equal(audit.action, "view_as_user");
  assert.equal(String(audit.actorId), session.user.id);
  // Expire only the grant created by this test to verify the server-side expiry boundary.
  await mongoose.connection.db.collection("adminauditevents").updateOne({ _id: audit._id, actorId: audit.actorId }, { $set: { createdAt: new Date(Date.now() - 16 * 60000) } });
  await page.reload();
  assert.match(await page.locator("body").innerText(), /Preview expired/);
  const dataExplorer = await admin.request.get("/admin/data", { maxRedirects: 0, headers: { "x-enrivea-path": "/admin" } });
  assert.equal(dataExplorer.status(), 200);
  assert.equal((await admin.request.post("/api/admin/billing/adjust", { headers, data: {} })).status(), 400);
  const protectedAccount = await mongoose.connection.db.collection("users").findOne({ email: "demo-user@enrivea.invalid" });
  assert.equal((await admin.request.post("/api/admin/users/" + protectedAccount._id + "/access", { headers, data: { action: "set_status", value: "banned", reason: "Protected demo login must remain available" } })).status(), 403);
  const realAccount = await mongoose.connection.db.collection("users").findOne({ isDemo: { $ne: true }, role: { $ne: "admin" } }, { projection: { _id: 1 } });
  if (realAccount) {
    assert.equal((await admin.request.post("/api/admin/users/" + realAccount._id + "/preview", { headers, data: { reason: "Cross-realm access must not be allowed" } })).status(), 404);
    assert.equal((await admin.request.post("/api/admin/users/" + realAccount._id + "/access", { headers, data: { action: "set_status", value: "banned", reason: "Cross-realm access must not be allowed" } })).status(), 404);
  }
  await page.goto(base + "/admin/users");
  await page.getByRole("button", { name: "Manage Amara Okafor", exact: true }).waitFor();
  if (await consent.isVisible()) await consent.click();
  await page.screenshot({ path: "artifacts/admin-users-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Manage Amara Okafor", exact: true }).click();
  await page.screenshot({ path: "artifacts/admin-user-controls.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/admin-user-controls-mobile.png", fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "No mobile page overflow");
  await page.getByRole("button", { name: "Close account details" }).click();
  await page.getByRole("button", { name: "Manage Amara Okafor", exact: true }).filter({ visible: true }).waitFor();
  await page.screenshot({ path: "artifacts/admin-users-mobile.png", fullPage: true });
  console.log("PASS: production demo login, account table, ban/unban, session revocation, audited read-only preview expiry, protected showcase accounts, demo route boundaries, desktop/mobile.");
} finally {
  if (target) {
    await change({ action: "set_status", value: "active" }).catch(() => undefined);
    await change({ action: "set_role", value: "user" }).catch(() => undefined);
  }
  await browser.close();
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
