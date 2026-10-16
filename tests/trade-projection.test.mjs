import assert from "node:assert/strict";
import test from "node:test";
import { decimalAdd, decimalMultiply } from "../src/lib/trade-decimal.ts";
import { projectFuturesTrade } from "../src/lib/trade-projection.ts";

const entry = { id: "1", orderId: "entry", side: "BUY", qty: "0.01000000", commission: "0.01", commissionAsset: "USDT", realizedPnl: "0" };
const close = { id: "2", orderId: "manual-close", side: "SELL", qty: "0.004", commission: "0.004", commissionAsset: "USDT", realizedPnl: "1.25" };
const base = {
  side: "BUY", entryOrderId: "entry", entryQuantity: "0.01", entryFills: [entry],
  accountFills: [entry, close], position: { quantity: "0.006", unrealized: "0.48" },
  stopStatus: "NEW", targetStatus: "NEW", historyComplete: true,
};
test("decimal sums and multiplies do not accumulate binary floating error", () => {
  assert.equal(decimalAdd(["0.1", "0.2"]), "0.3");
  assert.equal(decimalMultiply("0.00000001", "60000"), "0.0006");
});
test("partial manual close preserves actual remaining exposure and gross results", () => {
  const projected = projectFuturesTrade(base);
  assert.equal(projected.attributed, true);
  assert.equal(projected.quantity, "0.006");
  assert.equal(projected.realized, "1.25");
  assert.equal(projected.unrealized, "0.48");
  assert.equal(projected.feesQuote, "0.014");
  assert.equal(projected.closed, false);
  assert.equal(projected.protection, "active");
});
test("unknown same side trade makes product attribution uncertain", () => {
  const projected = projectFuturesTrade({ ...base, accountFills: [entry, close, { ...entry, id: "3", orderId: "external", qty: "0.001" }], position: { quantity: "0.007", unrealized: "0.6" } });
  assert.equal(projected.attributed, false);
  assert.equal(projected.realized, null);
  assert.equal(projected.unrealized, null);
});
test("partial exposure mismatch never yields invented P&L", () => {
  const projected = projectFuturesTrade({ ...base, position: { quantity: "0.005", unrealized: "0.8" } });
  assert.equal(projected.attributed, false);
  assert.equal(projected.realized, null);
});
test("closed trade only settles when exposure is zero", () => {
  const projected = projectFuturesTrade({ ...base, accountFills: [entry, { ...close, qty: "0.01" }], position: null, stopStatus: "TRIGGERED", targetStatus: "CANCELED" });
  assert.equal(projected.closed, true);
  assert.equal(projected.closeReason, "closed_stop");
  assert.equal(projected.protection, "closed");
});
