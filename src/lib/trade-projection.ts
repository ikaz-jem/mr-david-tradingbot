import { decimalAdd, decimalText, decimalUnits } from "./trade-decimal.ts";

export type TrackedFill = {
  id: string; orderId: string; side: "BUY" | "SELL"; qty: string;
  commission: string; commissionAsset: string; realizedPnl: string | null;
};
export function projectFuturesTrade(input: {
  side: "BUY" | "SELL"; entryOrderId: string; entryQuantity: string;
  entryFills: TrackedFill[]; accountFills: TrackedFill[];
  position: { quantity: string; unrealized: string } | null;
  stopStatus: string | null; targetStatus: string | null;
  historyComplete: boolean;
}) {
  const sign = input.side === "BUY" ? 1n : -1n;
  const entryQty = decimalUnits(input.entryQuantity);
  const openQty = input.position ? decimalUnits(input.position.quantity) : 0n;
  const accountFills = new Map(input.accountFills.map(fill => [fill.id, fill]));
  const entryFills = new Map(input.entryFills.map(fill => [fill.id, fill]));
  for (const [id, fill] of entryFills) accountFills.set(id, fill);
  let expected = 0n, attributed = true;
  const closing: TrackedFill[] = [];
  for (const fill of [...accountFills.values()]) {
    const quantity = decimalUnits(fill.qty);
    const direction = fill.side === "BUY" ? 1n : -1n;
    if (fill.orderId === input.entryOrderId) expected += direction * quantity;
    else if (direction === -sign) { expected += direction * quantity; closing.push(fill); }
    else attributed = false;
  }
  if (expected !== openQty || (openQty !== 0n && (openQty > 0n ? 1n : -1n) !== sign) || expected * sign > entryQty || expected * sign < 0n) attributed = false;
  if (!input.historyComplete || decimalUnits(input.entryFills.map(fill => fill.qty).length ? decimalAdd(input.entryFills.map(fill => fill.qty)) : "0") !== entryQty) attributed = false;
  const all = [...entryFills.values(), ...closing];
  const allUsdtFees = all.every(fill => fill.commissionAsset === "USDT");
  const realized = closing.every(fill => fill.realizedPnl !== null) ? decimalAdd(closing.map(fill => fill.realizedPnl!)) : null;
  const fees = allUsdtFees ? decimalAdd(all.map(fill => fill.commission)) : null;
  const stopActive = input.stopStatus === "NEW" || input.stopStatus === "PENDING";
  const targetActive = input.targetStatus === "NEW" || input.targetStatus === "PENDING";
  return {
    attributed,
    quantity: decimalText(openQty < 0n ? -openQty : openQty),
    realized: attributed ? realized : null,
    unrealized: attributed && openQty !== 0n ? input.position?.unrealized ?? null : null,
    feesQuote: attributed ? fees : null,
    protection: entryQty === 0n ? "pending" : openQty === 0n ? "closed" : stopActive && targetActive ? "active" : "failed",
    closed: entryQty > 0n && openQty === 0n && attributed,
    closeReason: closing.length && input.stopStatus === "TRIGGERED" ? "closed_stop" : closing.length && input.targetStatus === "TRIGGERED" ? "closed_target" : "closed_manual",
  };
}
