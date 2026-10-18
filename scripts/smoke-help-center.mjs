import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";

const base = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
try {
  const page = await browser.newPage();
  const anonymous = await page.request.get(base + "/api/help/admin");
  assert.equal(anonymous.status(), 403);
  assert.equal((await page.request.get(base + "/api/admin/storage-config")).status(), 403);
  assert.equal((await page.request.get(base + "/help")).status(), 200);
  assert.equal((await page.request.get(base + "/help/articles/run-research")).status(), 200);
  assert.equal((await page.request.get(base + "/help/articles/unknown-" + randomUUID())).status(), 404);
  await page.goto(base + "/login");
  const consent = page.getByRole("button", { name: "Essential only" });
  if (await consent.isVisible()) await consent.click();
  await page.getByRole("button", { name: "Demo user" }).click();
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  const deniedCreate = await page.request.post(base + "/api/help/admin", { headers: { Origin: base }, data: { kind: "article" } });
  assert.equal(deniedCreate.status(), 403, "Customers must not create Help Center content.");
  assert.equal((await page.request.post(base + "/api/admin/storage-config", { headers: { Origin: base }, data: { action: "clear", reason: "Unauthorized test" } })).status(), 403);
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(base + "/");
  await page.goto(base + "/login");
  await page.getByRole("button", { name: "Demo admin" }).click();
  await page.waitForURL("**/admin", { timeout: 15000 }).catch(async () => { throw new Error("Demo admin login did not complete. URL: " + page.url() + " · " + (await page.locator("body").innerText()).slice(0, 450)); });
  assert.equal((await page.goto(base + "/admin/help"))?.status(), 200);
  assert.equal((await page.goto(base + "/admin/controls/storage"))?.status(), 200);
  const storageStatus = await page.request.get(base + "/api/admin/storage-config");
  assert.equal(storageStatus.status(), 200);
  const storageBody = await storageStatus.json();
  assert.equal(storageBody.demo, true);
  assert.equal(Object.hasOwn(storageBody, "secretAccessKey"), false, "R2 secret must not be returned.");
  assert.equal(Object.hasOwn(storageBody, "accessKeyId"), false, "R2 access key must not be returned.");
  const slug = "help-smoke-" + randomUUID();
  const headers = { Origin: base };
  const payload = { kind: "article", slug, title: "Help smoke article", summary: "Temporary guide used to validate the private editorial workflow.", categorySlug: "getting-started", body: "This temporary guide verifies draft creation, review, publishing, and deletion. It is demo-only and never publicly visible.", keywords: ["smoke"], sortOrder: 999 };
  const created = await page.request.post(base + "/api/help/admin", { headers, data: payload });
  assert.equal(created.status(), 201, await created.text());
  const { id } = await created.json();
  try {
    let response = await page.request.get(base + "/api/help/admin/" + id);
    assert.equal(response.status(), 200);
    let { article } = await response.json();
    assert.equal(article.status, "draft");
    assert.equal((await page.request.get(base + "/help/articles/" + slug)).status(), 404);
    response = await page.request.patch(base + "/api/help/admin", { headers, data: { kind: "article", id, revision: article.revision, action: "review" } });
    assert.equal(response.status(), 200, await response.text());
    article = (await (await page.request.get(base + "/api/help/admin/" + id)).json()).article;
    response = await page.request.patch(base + "/api/help/admin", { headers, data: { kind: "article", id, revision: article.revision, action: "publish" } });
    assert.equal(response.status(), 200, await response.text());
    article = (await (await page.request.get(base + "/api/help/admin/" + id)).json()).article;
    assert.equal(article.status, "published");
    assert.equal((await page.request.get(base + "/help/articles/" + slug)).status(), 404, "Demo publication must not leak to the live public Help Center.");
    assert.equal((await page.goto(base + "/admin/help/preview/" + id))?.status(), 200);
    const stale = await page.request.patch(base + "/api/help/admin", { headers, data: { ...payload, id, revision: 1 } });
    assert.equal(stale.status(), 409, "Stale edits must be rejected.");
  } finally {
    const current = (await (await page.request.get(base + "/api/help/admin/" + id)).json()).article;
    const deleted = await page.request.delete(base + "/api/help/admin", { headers, data: { kind: "article", id, revision: current.revision, confirmSlug: slug } });
    assert.equal(deleted.status(), 200, await deleted.text());
  }
  console.log("Help Center smoke passed: public visibility, demo isolation, editorial lifecycle, optimistic conflict, and deletion.");
} finally { await browser.close(); }
