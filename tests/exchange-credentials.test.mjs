import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { decryptExchangeCredential, encryptExchangeCredential, exchangeEncryptionReady } from "../src/lib/exchange-credentials.ts";

test("encrypts exchange credentials with random IV and user-bound context", () => {
  const prior = process.env.EXCHANGE_ENCRYPTION_KEY;
  process.env.EXCHANGE_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  try {
    assert.equal(exchangeEncryptionReady(), true);
    const first = encryptExchangeCredential("sensitive-api-secret", "user-1:binance:apiSecret");
    const second = encryptExchangeCredential("sensitive-api-secret", "user-1:binance:apiSecret");
    assert.notEqual(first, second);
    assert.equal(first.includes("sensitive-api-secret"), false);
    assert.equal(decryptExchangeCredential(first, "user-1:binance:apiSecret"), "sensitive-api-secret");
    assert.throws(() => decryptExchangeCredential(first, "user-2:binance:apiSecret"));
    assert.throws(() => decryptExchangeCredential(first.slice(0, -2) + "aa", "user-1:binance:apiSecret"));
  } finally {
    if (prior === undefined) delete process.env.EXCHANGE_ENCRYPTION_KEY;
    else process.env.EXCHANGE_ENCRYPTION_KEY = prior;
  }
});

test("refuses missing or invalid encryption keys", () => {
  const prior = process.env.EXCHANGE_ENCRYPTION_KEY;
  process.env.EXCHANGE_ENCRYPTION_KEY = "too-short";
  try { assert.equal(exchangeEncryptionReady(), false); assert.throws(() => encryptExchangeCredential("secret", "context")); }
  finally {
    if (prior === undefined) delete process.env.EXCHANGE_ENCRYPTION_KEY;
    else process.env.EXCHANGE_ENCRYPTION_KEY = prior;
  }
});
