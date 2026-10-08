import "server-only";
import { ApprovalUnlock } from "@/models/ApprovalUnlock";
import { SharedOpportunity } from "@/models/SharedOpportunity";
import { getPaperCandles } from "@/lib/paper";
import { approvalPaperExit } from "@/lib/approval-paper";
import { calculatePositionPnl } from "@/lib/trade-math";

export async function reconcileApprovalPositions(userId?: string) {
  const positions = await ApprovalUnlock.find({ status: "paper_open", ...(userId ? { userId } : {}) }).sort({ checkedThrough: 1 }).limit(20).lean();
  const history = new Map<string, Awaited<ReturnType<typeof getPaperCandles>>>();
  for (const position of positions) {
    const opportunity = await SharedOpportunity.findOne({ _id: position.opportunityId, scope: "live" }).lean();
    if (!opportunity || !position.decidedAt || !position.executionPrice) continue;
    const start = position.checkedThrough ? position.checkedThrough.getTime() + 1 : Math.ceil(position.decidedAt.getTime() / 60000) * 60000;
    const end = Math.min(Math.floor(Date.now() / 60000) * 60000 - 1, start + 1000 * 60000 - 1);
    if (end < start) continue;
    try {
      const key = `${opportunity.symbol}:${start}:${end}`;
      let candles = history.get(key);
      if (!candles) { candles = await getPaperCandles(opportunity.symbol, start, end); history.set(key, candles); }
      const complete = candles.filter(candle => candle.closeTime <= end);
      if (!complete.length) continue;
      const exit = approvalPaperExit(opportunity.side, opportunity.stop, opportunity.target, complete, start);
      const markPrice = exit?.exitPrice ?? complete.at(-1)!.close;
      const pnl = calculatePositionPnl(opportunity.side, position.executionPrice, markPrice, position.amountUsdt);
      await ApprovalUnlock.updateOne({ _id: position._id, userId: position.userId, status: "paper_open", checkedThrough: position.checkedThrough ?? null }, { $set: { markPrice, ...pnl, ...(exit ?? {}), checkedThrough: exit?.closedAt ?? new Date(complete.at(-1)!.closeTime), executionNote: "Paper simulation from closed 1-minute candles. Gross P&L excludes fees, slippage, and funding." } });
    } catch (error) { console.error("Approval paper reconciliation deferred", String(position._id), error instanceof Error ? error.message : "Market data unavailable"); }
  }
}
