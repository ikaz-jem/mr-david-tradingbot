import test from "node:test";
import assert from "node:assert/strict";
import { mobileWebCorsOrigin, mobileWebCorsHeaders } from "../src/lib/mobile-web-cors.ts";

test("Expo Web localhost preview origins receive mobile API CORS headers", () => {
  assert.equal(mobileWebCorsOrigin("http://localhost:8081", "development"), "http://localhost:8081");
  assert.equal(mobileWebCorsOrigin("http://127.0.0.1:8088", "development"), "http://127.0.0.1:8088");
  assert.equal(mobileWebCorsOrigin("http://localhost:8081", "production"), "http://localhost:8081");
  assert.equal(mobileWebCorsHeaders("http://localhost:8081")["Access-Control-Allow-Origin"], "http://localhost:8081");
});

test("unrelated browser origins cannot use mobile API CORS", () => {
  for (const origin of ["https://evil.example", "http://localhost:3001", "http://192.168.1.7:8081", "null"]) {
    assert.equal(mobileWebCorsOrigin(origin, "development"), null, origin);
  }
  assert.equal(mobileWebCorsOrigin("http://localhost:3001", "production"), null);
  assert.equal(mobileWebCorsOrigin(null, "development"), null);
});

test("production mobile API CORS permits only explicitly configured browser origins", () => {
  assert.equal(mobileWebCorsOrigin("https://mobile.enriveasignal.com", "production", "https://mobile.enriveasignal.com"), "https://mobile.enriveasignal.com");
  assert.equal(mobileWebCorsOrigin("https://preview.enriveasignal.com", "production", "https://mobile.enriveasignal.com"), null);
  assert.equal(mobileWebCorsOrigin("https://evil.example", "production", "http://localhost:8081"), null);
});
