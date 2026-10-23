import test from "node:test";
import assert from "node:assert/strict";
import { binanceDataOrigin, absoluteHttpsOrigin } from "../src/lib/binance-data-origin.ts";
import { getClosedCandles } from "../src/lib/scanner.ts";
import { getPaperCandles } from "../src/lib/paper.ts";

test("blank deployment market-data setting falls back to an absolute HTTPS origin", async () => {
  const original = process.env.BINANCE_DATA_BASE_URL;
  const originalFetch = globalThis.fetch;
  const seen = [];
  try {
    process.env.BINANCE_DATA_BASE_URL = "   ";
    const interval = 4 * 60 * 60_000;
    const cutoff = Math.floor(Date.now() / interval) * interval;
    globalThis.fetch = async input => {
      seen.push(String(input));
      return Response.json(Array.from({ length: 100 }, (_, index) => {
        const open = cutoff - (100 - index) * interval;
        return [open, "100", "110", "90", "105", "1000", open + interval - 1];
      }));
    };
    assert.equal((await getClosedCandles("BTCUSDT", "4h")).length, 100);
    await getPaperCandles("BTCUSDT", cutoff - interval, cutoff);
    assert.ok(seen.every(url => url.startsWith("https://data-api.binance.vision/api/v3/klines?")));
    assert.ok(seen[0].includes("interval=4h"));
    assert.ok(seen[1].includes("interval=1m"));
  } finally {
    globalThis.fetch = originalFetch;
    if (original === undefined) delete process.env.BINANCE_DATA_BASE_URL;
    else process.env.BINANCE_DATA_BASE_URL = original;
  }
});

test("invalid market-data base is rejected before making a request", () => {
  assert.equal(binanceDataOrigin(""), "https://data-api.binance.vision");
  assert.equal(absoluteHttpsOrigin(" ", "https://api.binance.com", "BINANCE_API_BASE_URL"), "https://api.binance.com");
  for (const value of ["/api/v3", "http://example.com", "https://example.com/path", "https://name:secret@example.com"]) {
    assert.throws(() => binanceDataOrigin(value), /absolute HTTPS origin/);
  }
});
