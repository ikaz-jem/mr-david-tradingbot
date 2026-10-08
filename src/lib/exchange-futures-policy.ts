import type { ExchangeProviderId } from "@/lib/exchange-catalog";

export const exchangeMarkets = ["spot", "futures"] as const;
export type ExchangeMarket = (typeof exchangeMarkets)[number];
export type MarginMode = "isolated" | "cross";
export type PositionMode = "one_way";

export type FuturesExecutionConfig = {
  leverage: number;
  marginMode: MarginMode;
  positionMode: PositionMode;
  triggerPriceType: "mark" | "last";
};

export type FuturesCapability = {
  enabled: boolean;
  maxLeverage: number;
  marginModes: readonly MarginMode[];
  positionModes: readonly PositionMode[];
  triggerPriceTypes: readonly ("mark" | "last")[];
  nativeProtection: boolean;
  note: string;
};

export const futuresCapabilities: Record<ExchangeProviderId, FuturesCapability> = {
  binance: { enabled: true, maxLeverage: 20, marginModes: ["isolated", "cross"], positionModes: ["one_way"], triggerPriceTypes: ["mark", "last"], nativeProtection: true, note: "USDT-M perpetuals with exchange-side conditional protection." },
  bybit: { enabled: true, maxLeverage: 20, marginModes: ["cross"], positionModes: ["one_way"], triggerPriceTypes: ["mark", "last"], nativeProtection: true, note: "USDT linear perpetuals with attached take-profit and stop-loss. Cross margin avoids changing Unified Account margin globally." },
  okx: { enabled: true, maxLeverage: 20, marginModes: ["isolated", "cross"], positionModes: ["one_way"], triggerPriceTypes: ["mark", "last"], nativeProtection: true, note: "USDT perpetual swaps with attached conditional orders." },
  kraken: { enabled: true, maxLeverage: 10, marginModes: ["cross"], positionModes: ["one_way"], triggerPriceTypes: ["mark", "last"], nativeProtection: true, note: "USD linear perpetuals using a separate Kraken Futures API key." },
  kucoin: { enabled: true, maxLeverage: 20, marginModes: ["isolated", "cross"], positionModes: ["one_way"], triggerPriceTypes: ["mark", "last"], nativeProtection: true, note: "USDT-margined perpetuals with TP/SL order placement." },
};

export function validateFuturesExecutionConfig(provider: ExchangeProviderId, input: FuturesExecutionConfig) {
  const capability = futuresCapabilities[provider];
  if (!capability.enabled) return { allowed: false, reason: provider + " Futures execution is not enabled." } as const;
  if (!Number.isInteger(input.leverage) || input.leverage < 1 || input.leverage > capability.maxLeverage) return { allowed: false, reason: "Choose leverage from 1x to " + capability.maxLeverage + "x for this exchange." } as const;
  if (!capability.marginModes.includes(input.marginMode)) return { allowed: false, reason: input.marginMode + " margin is not supported for this exchange." } as const;
  if (!capability.positionModes.includes(input.positionMode)) return { allowed: false, reason: "Only one-way position mode is currently supported." } as const;
  if (!capability.triggerPriceTypes.includes(input.triggerPriceType)) return { allowed: false, reason: "Choose a supported protective-order trigger price." } as const;
  return { allowed: true, capability } as const;
}

export function futuresNotional(marginUsdt: number, leverage: number) {
  if (!Number.isFinite(marginUsdt) || marginUsdt < 10 || marginUsdt > 100_000) throw new Error("Futures margin must be between 10 and 100,000 USDT.");
  if (!Number.isInteger(leverage) || leverage < 1 || leverage > 20) throw new Error("Leverage is outside the platform safety range.");
  return marginUsdt * leverage;
}
