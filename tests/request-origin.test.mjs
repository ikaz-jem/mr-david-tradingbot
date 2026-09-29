import test from "node:test";
import assert from "node:assert/strict";
import { isSameOrigin } from "../src/lib/request-origin.ts";
test("saves accept exact configured deployment origins, never arbitrary hosts", () => {
  const keys = ["NEXTAUTH_URL", "APP_URL", "VERCEL_URL", "VERCEL_BRANCH_URL"];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    process.env.NEXTAUTH_URL = "https://app.example.com";
    process.env.APP_URL = "https://www.example.com";
    process.env.VERCEL_URL = "preview-123.vercel.app";
    process.env.VERCEL_BRANCH_URL = "branch.vercel.app";
    for (const origin of ["https://app.example.com", "https://www.example.com", "https://preview-123.vercel.app", "https://branch.vercel.app"]) assert.equal(isSameOrigin(new Request("https://app.example.com/api", { headers: { origin } })), true);
    for (const origin of ["https://evil.example", "https://app.example.com.evil.example", "null", "invalid", "http://app.example.com"]) assert.equal(isSameOrigin(new Request("https://app.example.com/api", { headers: { origin, "x-forwarded-host": "evil.example" } })), false);
    assert.equal(isSameOrigin(new Request("https://app.example.com/api")), false);
  } finally { for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } }
});
