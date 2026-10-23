# Vercel primary + n8n recovery

Vercel retains the five schedules in vercel.json. Import n8n-scheduler-backup.json into an independently hosted n8n instance. This template is inactive and contains no secrets. No n8n instance has been configured by this code change.

## Setup

1. The included workflow points to https://enriveasignal.com. Confirm that this is the active production deployment before enabling it.
2. Create an n8n Header Auth credential: name Authorization, value Bearer followed by the application's CRON_SECRET. Select this credential in every HTTP node. Never paste it into exported workflow JSON.
3. The workflow checks every two minutes. Requests use POST /api/internal/scheduler-recovery/{job}. Keep the 310-second HTTP timeout and allow the workflow sufficient total execution time. Do not configure ordinary worker endpoints as backup triggers.
4. Configure an n8n Error Trigger workflow with your chosen email/Slack/other notification destination and attach it as this workflow's Error Workflow. Alert on failed executions, authorization errors, timeouts and application unreachability. Keep retries bounded; never ignore HTTP errors.
5. Separately monitor GET /api/internal/readiness using the same bearer credential. HTTP 503 means a job or delivery/payment backlog needs attention. Debounce alerts for at least two recovery checks, and alert again on recovery. This catches unhealthy business backlogs even when a cron invocation completed.
6. Test on staging, then publish/activate the workflow. Verify recovery events in AuthorizationAuditLog (scheduler:recover) and timestamps in ScheduledJob. Publishing the JSON file does not enable n8n or alert delivery.

## Recovery rules

Only allowlisted jobs are callable. Anonymous requests and browser sessions are denied. The database claim combines eligibility and exclusive leasing, rather than checking health and starting work in separate steps.

| Job | Backup eligibility after last successful invocation |
| --- | --- |
| Approval scan | 15 minutes |
| Autopilot | 15 minutes |
| Trade tracking | 5 minutes |
| Billing reconciliation | 15 minutes |
| Help assets | 27 hours |

A job with no successful run is eligible, provided it has no active lease and no attempt in the past five minutes. Failures also respect this retry cooldown; a recent successful invocation delays failover until the threshold expires. Healthy/leased/cooldown jobs return a successful skipped response without calling their provider engines.

After a backup claim, the primary skips immediate repeats for one minute for tracking, five minutes for the other frequent jobs, or 24 hours for cleanup. All existing execution permissions, pause controls, budgets and idempotency checks remain in force. Recovery claims are audited without credentials.

Leases expire after six minutes; hosting must enforce the route's five-minute maximum duration. This is protection against duplicate job starts, not a guarantee that external APIs execute exactly once. A lost response must still be reconciled by each product's existing idempotency mechanisms.

## Limits and acceptance tests

- n8n cannot recover a fully unavailable application, database, or hosting provider; it must alert instead.
- Simulate a missed schedule by stopping Vercel cron in staging, then confirm exactly one backup run after the threshold.
- Send concurrent backup requests and a normal cron request; confirm at most one engine starts.
- Repeat immediately after success: both backup and the immediate primary request must skip.
- Simulate an engine error: expect HTTP 503, a failed job state, and no retry during the five-minute cooldown.
- Confirm unknown job names return 404 and missing/wrong bearer credentials return 401.

Reference: https://docs.n8n.io/integrations/builtin/credentials/httprequest/

