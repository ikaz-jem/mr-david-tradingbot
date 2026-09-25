import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { chromium } from "playwright";

const email = `codex-smoke-${randomUUID()}@example.invalid`;
const browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const page = await browser.newPage();
try {
  await page.goto("http://localhost:3000/register");
  await page.getByRole("button", { name: "Essential only" }).click();
  await page.getByLabel("Full name").fill("Smoke Test");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill("Testing-only-password-123!");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  assert.match(await page.locator("body").innerText(), /Available credits\s*5/);
  await page.goto("http://localhost:3000/dashboard/signals");
  assert.equal(await page.getByRole("button", { name: "Run scan" }).isDisabled(), true);
  const scan = await page.request.post("http://localhost:3000/api/scans", { headers: { Origin: "http://localhost:3000" }, data: { symbol: "BTCUSDT", requestId: randomUUID() } });
  assert.equal(scan.status(), 503);
  await page.goto("http://localhost:3000/dashboard/performance");
  assert.match(await page.locator("body").innerText(), /Forward paper scorecard/);
  await page.screenshot({ path: "artifacts/performance-smoke.png", fullPage: true });
  await page.getByRole("button", { name: "Refresh paper outcomes" }).click();
  await page.getByRole("status").filter({ hasText: "0 outcomes checked" }).waitFor();
  const admin = await page.goto("http://localhost:3000/admin");
  assert.equal(admin?.status(), 404);
  await mongoose.connect(process.env.MONGODB_URI);
  await mongoose.connection.db.collection("users").updateOne({ email }, { $set: { role: "admin" } });
  await page.goto("http://localhost:3000/admin/system");
  assert.match(await page.locator("body").innerText(), /Credit wallet \/ ledger mismatches/);
  await page.screenshot({ path: "artifacts/admin-system-smoke.png", fullPage: true });
  const user = await mongoose.connection.db.collection("users").findOne({ email });
  await mongoose.connection.db.collection("users").updateOne({ _id: user._id }, { $set: { role: "user" } });
  const demotedAdmin = await page.goto("http://localhost:3000/admin/system");
  assert.equal(demotedAdmin?.status(), 404);
  await mongoose.connection.db.collection("users").updateOne({ _id: user._id }, { $set: { emailVerifiedAt: null } });
  const verifyToken = randomUUID();
  await mongoose.connection.db.collection("emailtokens").insertOne({ userId: user._id, tokenHash: createHash("sha256").update(verifyToken).digest("hex"), kind: "verify", expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() });
  const verify = await page.request.post("http://localhost:3000/api/auth/verify-email", { headers: { Origin: "http://localhost:3000" }, data: { token: verifyToken } });
  assert.equal(verify.status(), 200);
  const verifiedUser = await mongoose.connection.db.collection("users").findOne({ _id: user._id });
  assert.ok(verifiedUser.emailVerifiedAt);
  const verifyReuse = await page.request.post("http://localhost:3000/api/auth/verify-email", { headers: { Origin: "http://localhost:3000" }, data: { token: verifyToken } });
  assert.equal(verifyReuse.status(), 400);
  const resetToken = randomUUID();
  await mongoose.connection.db.collection("emailtokens").insertOne({ userId: user._id, tokenHash: createHash("sha256").update(resetToken).digest("hex"), kind: "reset", expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() });
  const reset = await page.request.post("http://localhost:3000/api/auth/reset-password", { headers: { Origin: "http://localhost:3000" }, data: { token: resetToken, password: "New-testing-password-456!" } });
  assert.equal(reset.status(), 200);
  const reuse = await page.request.post("http://localhost:3000/api/auth/reset-password", { headers: { Origin: "http://localhost:3000" }, data: { token: resetToken, password: "New-testing-password-456!" } });
  assert.equal(reuse.status(), 400);
  await page.goto("http://localhost:3000/dashboard");
  assert.match(page.url(), /\/login/);
  console.log("PASS: registration, session, credits, admin guard and demotion, email verification, password reset, one-time tokens, session invalidation");
} finally {
  await browser.close();
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await mongoose.connection.db.collection("users").findOne({ email });
  if (user) {
    await mongoose.connection.db.collection("creditentries").deleteMany({ userId: user._id });
    await mongoose.connection.db.collection("emailtokens").deleteMany({ userId: user._id });
    await mongoose.connection.db.collection("users").deleteOne({ _id: user._id, email });
  }
  await mongoose.disconnect();
}
