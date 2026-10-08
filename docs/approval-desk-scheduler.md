# Approval Desk scheduler

Approval Desk discovery is a shared background job. It analyzes each unique market, candle timeframe, and strategy only once, then distributes matching locked previews to eligible users. No user credits are consumed by the scan. A credit charge occurs only when a user unlocks an opportunity.

## Production trigger

The repository includes a Vercel Cron entry in `vercel.json` that invokes the scanner every five minutes on production deployments. Set a random `CRON_SECRET` of at least 16 characters in the Vercel Production environment, redeploy, and confirm the job under the project's Cron Jobs view. Vercel supplies that value as the Bearer authorization header automatically.

Call the following endpoint every five minutes from n8n, Vercel Cron, or another trusted scheduler:

```text
GET https://YOUR_APP_HOST/api/internal/approval-scan
Authorization: Bearer YOUR_CRON_SECRET
```

Set the same high-entropy value as `CRON_SECRET` in the application environment and in the scheduler credential store. Do not place this secret in browser code or a public URL.

The endpoint is idempotent and protected by a MongoDB lease. Concurrent invocations do not run duplicate discovery jobs. Market candles and AI decisions also use the shared research caches.

## Production scan pool

Administrators manage the approved discovery universe at `/admin/controls/approval-scanner`. The pool controls:

- Binance Spot pairs available to Approval Desk;
- candle timeframes;
- enabled Approval Desk strategies;
- minimum minutes between effective runs; and
- the maximum number of unique combinations analyzed in one run.

User settings are filters inside this pool, not independent scanner jobs. The engine deduplicates all requested combinations, counts how many eligible users request each combination, prioritizes the highest-demand combinations, and applies the configured cap. Results are then distributed as locked previews to matching users.

## n8n outline

1. Add a Schedule Trigger with a five-minute interval.
2. Add an HTTP Request node using `GET` and the production endpoint above.
3. Store `CRON_SECRET` as an n8n credential and send it as the Bearer authorization header.
4. Treat non-2xx responses as failures and alert operations after repeated failures.

Administrators can also trigger a run with an authenticated same-origin `POST` request if they hold `settings:update`.

## Operator controls and local worker

Live platform administrators can use **Platform controls → Approval scan pool → Run shared scan**. The status panel shows the last run, eligible users, combinations, published setups, and per-combination results. Demo administrators cannot run or inspect live jobs. Runs obey the configured cadence and MongoDB lease; failures never consume user credits.

For a continuously running local worker, set `APPROVAL_RUN=true` and `APPROVAL_WATCH=true` in the worker process, then run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-atlas-direct.ps1 scripts/approval-discovery.mjs`. It checks every five minutes while the process remains alive. Without those flags the script only prints diagnostic state. For deployed hosting, use the authenticated external scheduler above; an open browser does not schedule discovery.

An OpenAI 401/403 stops discovery with a credential error. Replace the configured key under Platform controls → AI before retrying. A completed scan with no setup is a valid research result, not an error. User pages refresh the shared queue every 30 seconds while visible.

Approval Desk supports three separate post-unlock paths: a paper position, a user-reported external execution, or an explicitly confirmed Spot market entry through a verified Binance, Bybit, OKX, Kraken, or KuCoin `spot_trade` connection. Live entry submission is owner-scoped, demo-denied, rate-limited, audited, and idempotent across venues. Ambiguous exchange responses are reconciled by the provider's order/client identifier and are never blindly resubmitted.

Exchange execution submits only the market entry. It does not place protective stop-loss, take-profit, or OCO orders. SELL disposes of an existing Spot asset and does not open a short. Paper positions continue to reconcile complete one-minute candles, conservatively prefer the stop when stop and target both occur in a candle, and report gross simulated P&L excluding fees, slippage, and funding.
