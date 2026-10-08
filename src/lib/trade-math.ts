export type TradeSide = "BUY" | "SELL";

function rounded(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function calculateTradeMetrics(side: TradeSide, entry: number, stop: number, target: number, amountUsdt: number) {
  if (![entry, stop, target, amountUsdt].every(Number.isFinite) || entry <= 0 || amountUsdt <= 0) throw new Error("Trade values must be positive numbers");
  const direction = side === "BUY" ? 1 : -1;
  const targetReturn = ((target - entry) / entry) * direction;
  const stopReturn = ((stop - entry) / entry) * direction;
  const potentialProfitUsdt = Math.max(0, amountUsdt * targetReturn);
  const potentialLossUsdt = Math.abs(Math.min(0, amountUsdt * stopReturn));
  return {
    amountUsdt: rounded(amountUsdt, 2),
    estimatedQuantity: rounded(amountUsdt / entry, 8),
    potentialProfitUsdt: rounded(potentialProfitUsdt, 2),
    potentialLossUsdt: rounded(potentialLossUsdt, 2),
    riskReward: potentialLossUsdt > 0 ? rounded(potentialProfitUsdt / potentialLossUsdt, 2) : 0,
    targetReturnPct: rounded(targetReturn * 100, 2),
    stopReturnPct: rounded(stopReturn * 100, 2),
  };
}

export function calculatePositionPnl(side: TradeSide, entry: number, price: number, amountUsdt: number) {
  if (![entry, price, amountUsdt].every(Number.isFinite) || entry <= 0 || price <= 0 || amountUsdt <= 0) throw new Error("Position values must be positive numbers");
  const direction = side === "BUY" ? 1 : -1;
  const returnPct = ((price - entry) / entry) * direction * 100;
  return {
    pnlUsdt: rounded(amountUsdt * returnPct / 100, 2),
    pnlPct: rounded(returnPct, 2),
  };
}
