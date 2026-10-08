import type { PaperCandle } from "./paper.ts";

// Positions enter at the recorded execution price. Track only complete minutes
// after entry; when both boundaries are touched, the adverse exit wins.
export function approvalPaperExit(side: "BUY" | "SELL", stop: number, target: number, candles: PaperCandle[], start: number) {
  for (const [index, row] of candles.entries()) {
    if (row.openTime !== start + index * 60000 || row.closeTime !== row.openTime + 59999 || ![row.open, row.high, row.low, row.close].every(Number.isFinite) || row.low <= 0 || row.low > Math.min(row.open, row.close) || row.high < Math.max(row.open, row.close)) throw new Error("Paper history is incomplete; retry reconciliation.");
    const stopped = side === "BUY" ? row.low <= stop : row.high >= stop;
    if (stopped) return { status: "closed_stop" as const, exitPrice: side === "BUY" ? Math.min(row.open, stop) : Math.max(row.open, stop), closedAt: new Date(row.closeTime) };
    if (side === "BUY" ? row.high >= target : row.low <= target) return { status: "closed_target" as const, exitPrice: target, closedAt: new Date(row.closeTime) };
  }
  return null;
}
