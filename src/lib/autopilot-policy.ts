export type AutopilotPolicyInput = {
  operationsOpen: boolean; productEnabled: boolean; certified: boolean; accountActive: boolean;
  countryAllowed: boolean; connected: boolean; credits: number; creditCost: number;
  dailyTrades: number; maxDailyTrades: number; openPositions: number; maxOpenPositions: number;
  dailyRealizedLossUsd: number; dailyLossLimitUsd: number; confidence: number; minConfidence: number;
  riskReward: number; minRiskReward: number;
};

export function autopilotDecision(input: AutopilotPolicyInput) {
  if (!input.operationsOpen) return { allowed: false, code: "OPERATIONS_PAUSED" } as const;
  if (!input.productEnabled) return { allowed: false, code: "PRODUCT_DISABLED" } as const;
  if (!input.certified) return { allowed: false, code: "EXECUTION_NOT_CERTIFIED" } as const;
  if (!input.accountActive) return { allowed: false, code: "ACCOUNT_INACTIVE" } as const;
  if (!input.countryAllowed) return { allowed: false, code: "JURISDICTION_DENIED" } as const;
  if (!input.connected) return { allowed: false, code: "CONNECTION_UNAVAILABLE" } as const;
  if (input.credits < input.creditCost) return { allowed: false, code: "INSUFFICIENT_CREDITS" } as const;
  if (input.dailyTrades >= input.maxDailyTrades) return { allowed: false, code: "DAILY_TRADE_LIMIT" } as const;
  if (input.openPositions >= input.maxOpenPositions) return { allowed: false, code: "OPEN_POSITION_LIMIT" } as const;
  if (input.dailyRealizedLossUsd >= input.dailyLossLimitUsd) return { allowed: false, code: "DAILY_LOSS_LIMIT" } as const;
  if (input.confidence < input.minConfidence) return { allowed: false, code: "CONFIDENCE_FILTER" } as const;
  if (input.riskReward < input.minRiskReward) return { allowed: false, code: "RISK_REWARD_FILTER" } as const;
  return { allowed: true, code: "ELIGIBLE" } as const;
}
