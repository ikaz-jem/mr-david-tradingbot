import { timingSafeEqual } from "node:crypto";

export function schedulerAuthorized(request: Request, secret = process.env.CRON_SECRET) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || secret.length < 16 || !supplied) return false;
  const expected = Buffer.from(secret), actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const scheduledJobs = [
  { key: "approval-scan", label: "Approval discovery", staleAfterMs: 15 * 60_000 },
  { key: "autopilot", label: "Autopilot", staleAfterMs: 15 * 60_000 },
  { key: "trade-tracking", label: "Trade tracking", staleAfterMs: 5 * 60_000 },
  { key: "billing-reconciliation", label: "Payment recovery and receipts", staleAfterMs: 15 * 60_000 },
  { key: "help-assets", label: "Help image cleanup", staleAfterMs: 27 * 60 * 60_000 },
] as const;
export type ScheduledJobKey = typeof scheduledJobs[number]["key"];

export function jobHealth(row: { status: string; lastSucceededAt?: Date | null; leaseUntil?: Date | null } | null | undefined, staleAfterMs: number, now = Date.now()) {
  if (!row) return "not_started";
  if (row.status === "failed") return "failed";
  if (row.status === "running" && row.leaseUntil && row.leaseUntil.getTime() < now) return "stalled";
  if (!row.lastSucceededAt) return row.status === "running" ? "starting" : "not_started";
  return now - row.lastSucceededAt.getTime() > staleAfterMs ? "stale" : "healthy";
}
