import { schedulerAuthorized } from "@/lib/scheduler-policy";
import { GET as approval } from "@/app/api/internal/approval-scan/route";
import { GET as autopilot } from "@/app/api/internal/autopilot/route";
import { GET as tracking } from "@/app/api/internal/trade-tracking/route";
import { GET as billing } from "@/app/api/internal/billing-reconciliation/route";
import { GET as assets } from "@/app/api/internal/help-assets/route";

export const runtime = "nodejs";
export const maxDuration = 300;
const handlers = { "approval-scan": approval, autopilot, "trade-tracking": tracking, "billing-reconciliation": billing, "help-assets": assets };

export async function POST(request: Request, context: { params: Promise<{ job: string }> }) {
  if (!schedulerAuthorized(request)) return Response.json({ error: "Scheduler authorization required." }, { status: 401 });
  const { job } = await context.params;
  if (!Object.hasOwn(handlers, job)) return Response.json({ error: "Unknown job." }, { status: 404 });
  const headers = new Headers(request.headers);
  headers.set("x-scheduler-recovery", "true");
  // In-process delegation; no caller-supplied URL is fetched, and each worker
  // still enforces its own authorization and atomic database eligibility.
  return handlers[job as keyof typeof handlers](new Request(request.url, { headers }));
}
