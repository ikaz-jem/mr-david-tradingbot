// Native clients can only reach customer-facing APIs. Administrative and
// scheduler routes are absent from this allowlist, including nested paths.
const userRoutes: [RegExp, string[]][] = [
  [/^account\/profile$/, ["PATCH"]],
  [/^account\/preferences$/, ["PATCH"]],
  [/^account\/(password|email)$/, ["POST"]],
  [/^account\/sessions$/, ["DELETE"]],
  [/^account\/export$/, ["GET"]],
  [/^account$/, ["DELETE"]],
  [/^notifications$/, ["PATCH"]],
  [/^scans$/, ["POST"]], [/^scans\/options$/, ["GET"]],
  [/^(approval|autopilot|affiliates|support)$/, ["GET", "POST"]],
  [/^support\/[a-f\d]{24}$/i, ["PATCH"]],
  [/^billing\/methods$/, ["GET"]],
  [/^exchange-connections\/(binance|bybit|okx|kucoin|kraken)$/, ["GET", "POST", "DELETE"]],
  [/^exchange-connections\/(binance|bybit|okx|kucoin|kraken)\/balances$/, ["GET"]],
  [/^market\/overview$/, ["GET"]],
];
const publicRoutes: [RegExp, string[]][] = [
  [/^auth\/(register|forgot-password|reset-password|resend-verification|verify-email|change-email)$/, ["POST"]],
];

export function mobileRouteAccess(path: string, method: string): "public" | "user" | "deny" {
  if (publicRoutes.some(([pattern, methods]) => pattern.test(path) && methods.includes(method))) return "public";
  if (userRoutes.some(([pattern, methods]) => pattern.test(path) && methods.includes(method))) return "user";
  return "deny";
}

export function mobileCustomerLoginAllowed(role: string) {
  return role === "user";
}
