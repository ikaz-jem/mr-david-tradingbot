import assert from "node:assert/strict";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { chromium } from "playwright";

const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const terminal = createInterface({ input, output, terminal: true });
const email = (await terminal.question("Administrator email: ")).trim().toLowerCase();
terminal.close();

async function hiddenQuestion(prompt) {
  output.write(prompt);
  input.setRawMode?.(true);
  input.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const onData = chunk => {
      for (const character of chunk.toString()) {
        if (character === "\u0003") { input.setRawMode?.(false); reject(new Error("Cancelled.")); return; }
        if (character === "\r" || character === "\n") {
          input.setRawMode?.(false); input.pause(); input.off("data", onData); output.write("\n"); resolve(value); return;
        }
        if (character === "\b" || character === "\u007f") value = value.slice(0, -1);
        else value += character;
      }
    };
    input.on("data", onData);
  });
}

const password = await hiddenQuestion("Temporary password: ");
const browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" });
const context = await browser.newContext({ baseURL: base });
try {
  const csrf = await (await context.request.get("/api/auth/csrf")).json();
  const login = await context.request.post("/api/auth/callback/credentials", {
    headers: { Origin: base },
    form: { csrfToken: csrf.csrfToken, email, password, callbackUrl: `${base}/admin`, json: "true" },
  });
  assert.equal(login.status(), 200, "Administrator credentials were rejected");
  const admin = await context.request.get("/admin", { maxRedirects: 0 });
  assert.ok([307, 308].includes(admin.status()), "Admin page did not require password rotation");
  assert.match(admin.headers().location ?? "", /^\/dashboard\/settings\?password=required$/);
  const settings = await context.request.get("/dashboard/settings");
  assert.equal(settings.status(), 200, "Password settings page is unavailable");
  const mutation = await context.request.post("/api/admin/products", { headers: { Origin: base }, data: {} });
  assert.equal(mutation.status(), 403, "Admin API was available before password rotation");
  console.log("PASS: administrator sign-in works and first-login password rotation is enforced.");
} finally {
  await context.close();
  await browser.close();
}
