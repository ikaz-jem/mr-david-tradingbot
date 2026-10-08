export type ExchangeAccess = "read_only" | "spot_trade" | "futures_trade";
export type PermissionDecision = { allowed: true } | { allowed: false; reason: string };

export function bybitPermissionDecision(readOnly: unknown, permissions: Record<string, unknown>, access: ExchangeAccess): PermissionDecision {
  const entries = Object.entries(permissions).flatMap(([group, values]) => Array.isArray(values) ? values.map(value => `${group}:${String(value)}`.toLowerCase()) : []);
  const spotTrade = entries.includes("spot:spottrade");
  const futuresEntries = entries.filter(value => value.startsWith("contracttrade:"));
  const forbidden = entries.some(value => value !== "spot:spottrade");
  if (access === "read_only") return readOnly === 1 && entries.length === 0 ? { allowed: true } : { allowed: false, reason: "Use a read-only Bybit key with every trading, transfer, withdrawal, derivatives, and earn permission disabled." };
  if (access === "futures_trade") return readOnly === 0 && futuresEntries.some(value => /:(order|position)$/.test(value)) && entries.every(value => value.startsWith("contracttrade:")) ? { allowed: true } : { allowed: false, reason: "Use a Bybit read-write key with only Contract Trade order/position access. Disable Spot, wallet, transfer, withdrawal, options, earn, and unrelated permissions." };
  return readOnly === 0 && spotTrade && !forbidden ? { allowed: true } : { allowed: false, reason: "Use a Bybit read-write key with only Spot Trade enabled. Disable wallet transfers, withdrawals, contracts, derivatives, options, earn, and every other permission." };
}

export function okxPermissionDecision(permissions: string[], access: ExchangeAccess): PermissionDecision {
  if (!permissions.includes("read_only")) return { allowed: false, reason: "OKX Read permission is required." };
  if (access === "read_only") return permissions.every(permission => permission === "read_only") ? { allowed: true } : { allowed: false, reason: "Use an OKX key with Read permission only. Disable Trade and Withdraw before connecting." };
  return permissions.includes("trade") && permissions.every(permission => ["read_only", "trade"].includes(permission)) ? { allowed: true } : { allowed: false, reason: "Use an OKX key with Read and Trade only. Disable Withdraw and every money-moving permission." };
}

export function krakenPermissionDecision(permissions: string[], access: ExchangeAccess): PermissionDecision {
  const normalized = permissions.map(value => value.toLowerCase());
  const has = (pattern: RegExp) => normalized.some(value => pattern.test(value));
  if (!has(/query funds/) || normalized.some(value => /(withdraw|deposit|add funds|wallet|transfer|staking|earn)/.test(value))) return { allowed: false, reason: "Kraken Query Funds is required and every funding, withdrawal, transfer, staking, and earn permission must be disabled." };
  const canCreate = has(/create.*modify orders|modify orders/);
  const canQueryOpen = has(/query open orders|open orders.*trades/);
  const canQueryClosed = has(/query closed orders|closed orders.*trades/);
  if (access === "read_only") return !canCreate && !has(/cancel.*orders|close.*orders/) ? { allowed: true } : { allowed: false, reason: "Use a Kraken key without order creation, modification, or cancellation permissions for read-only access." };
  if (access === "futures_trade") return { allowed: false, reason: "Kraken Futures uses a separate Futures API key and permission check." };
  return canCreate && canQueryOpen && canQueryClosed ? { allowed: true } : { allowed: false, reason: "Kraken Spot execution requires Query Funds, Query Open Orders & Trades, Query Closed Orders & Trades, and Create & Modify Orders. Keep funding and withdrawal permissions disabled." };
}

export function kucoinPermissionDecision(permissions: string[], access: ExchangeAccess): PermissionDecision {
  if (!permissions.includes("general")) return { allowed: false, reason: "KuCoin General permission is required." };
  if (access === "read_only") return permissions.length === 1 ? { allowed: true } : { allowed: false, reason: "Use a KuCoin key with General permission only. Disable Spot, Margin, Futures, Earn, Transfer, Unified, and Withdrawal permissions." };
  if (access === "futures_trade") return permissions.includes("futures") && permissions.every(permission => ["general", "futures"].includes(permission)) ? { allowed: true } : { allowed: false, reason: "Use a KuCoin key with General and Futures only. Disable Spot, Margin, Earn, Transfer, Unified, and Withdrawal permissions." };
  return permissions.includes("spot") && permissions.every(permission => ["general", "spot"].includes(permission)) ? { allowed: true } : { allowed: false, reason: "Use a KuCoin key with General and Spot only. Disable Margin, Futures, Earn, Transfer, Unified, and Withdrawal permissions." };
}
