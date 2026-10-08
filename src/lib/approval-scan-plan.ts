export type ApprovalScanPreference = { symbols: string[]; intervals: string[]; strategySlugs: string[] };
export type ApprovalScanPolicy = { symbols: string[]; intervals: string[]; strategySlugs: string[]; maxCombinations: number };
export type ApprovalScanCombination = { symbol: string; interval: string; strategySlug: string; demand: number };

export function buildApprovalScanPlan(preferences: ApprovalScanPreference[], policy: ApprovalScanPolicy): ApprovalScanCombination[] {
  const approvedSymbols = new Set(policy.symbols);
  const approvedIntervals = new Set(policy.intervals);
  const approvedStrategies = new Set(policy.strategySlugs);
  const demand = new Map<string, ApprovalScanCombination>();
  for (const preference of preferences) for (const symbol of new Set(preference.symbols)) for (const interval of new Set(preference.intervals)) for (const strategySlug of new Set(preference.strategySlugs)) {
    if (!approvedSymbols.has(symbol) || !approvedIntervals.has(interval) || !approvedStrategies.has(strategySlug)) continue;
    const key = `${symbol}:${interval}:${strategySlug}`;
    const existing = demand.get(key);
    demand.set(key, { symbol, interval, strategySlug, demand: (existing?.demand ?? 0) + 1 });
  }
  return [...demand.values()].sort((a, b) => b.demand - a.demand || `${a.symbol}:${a.interval}:${a.strategySlug}`.localeCompare(`${b.symbol}:${b.interval}:${b.strategySlug}`)).slice(0, Math.max(1, policy.maxCombinations));
}
