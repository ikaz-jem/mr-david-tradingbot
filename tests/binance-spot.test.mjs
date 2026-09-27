import assert from "node:assert/strict";
import { test } from "node:test";
import { assertReadOnlyBinancePermissions, getBinancePermissions, signBinanceQuery } from "../src/lib/binance-spot.ts";

const readOnly = {
  enableReading: true, enableWithdrawals: false, enableInternalTransfer: false,
  permitsUniversalTransfer: false, enableSpotAndMarginTrading: false,
  enableMargin: false, enableFutures: false, ipRestrict: true,
};

test("signs the exact query with HMAC-SHA256", () => {
  assert.equal(signBinanceQuery("The quick brown fox jumps over the lazy dog", "key"), "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8");
});

test("accepts read-only keys and rejects money-moving permissions", () => {
  assert.doesNotThrow(() => assertReadOnlyBinancePermissions(readOnly));
  for (const permission of ["enableWithdrawals", "enableInternalTransfer", "permitsUniversalTransfer", "enableSpotAndMarginTrading", "enableMargin", "enableFutures"]) {
    assert.throws(() => assertReadOnlyBinancePermissions({ ...readOnly, [permission]: true }), /read-only key/i);
  }
  assert.throws(() => assertReadOnlyBinancePermissions({ ...readOnly, enableReading: false }), /reading/i);
});

test("verifies signed Binance permission requests without sending secrets as headers", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    assert.equal(url.origin, "https://api.binance.com");
    assert.equal(url.pathname, "/sapi/v1/account/apiRestrictions");
    assert.equal(options.headers["X-MBX-APIKEY"], "example-api-key");
    assert.equal(options.cache, "no-store");
    const signature = url.searchParams.get("signature");
    url.searchParams.delete("signature");
    assert.equal(signature, signBinanceQuery(url.searchParams.toString(), "example-secret"));
    return new Response(JSON.stringify(readOnly), { status: 200 });
  };
  try { assert.deepEqual(await getBinancePermissions("example-api-key", "example-secret"), readOnly); }
  finally { globalThis.fetch = original; }
});
