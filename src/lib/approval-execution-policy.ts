export type ApprovalExecutionContext = { authenticated: boolean; active: boolean; isDemo: boolean; ownsUnlock: boolean; explicitlyConfirmed: boolean; operationsOpen: boolean; connectionAccess: "read_only" | "spot_trade" | null };

export function approvalExecutionAccess(context: ApprovalExecutionContext) {
  if (!context.authenticated || !context.active) return { allowed: false, status: 401, reason: "Sign in with an active account." } as const;
  if (context.isDemo) return { allowed: false, status: 403, reason: "Demo accounts cannot place live exchange orders." } as const;
  if (!context.ownsUnlock) return { allowed: false, status: 403, reason: "This unlocked setup does not belong to your account." } as const;
  if (!context.operationsOpen) return { allowed: false, status: 503, reason: "Exchange execution is currently paused." } as const;
  if (context.connectionAccess !== "spot_trade") return { allowed: false, status: 409, reason: "Connect Binance with Spot execution access." } as const;
  if (!context.explicitlyConfirmed) return { allowed: false, status: 400, reason: "Explicit live-order confirmation is required." } as const;
  return { allowed: true, status: 200, reason: "Owner-confirmed Spot execution." } as const;
}
