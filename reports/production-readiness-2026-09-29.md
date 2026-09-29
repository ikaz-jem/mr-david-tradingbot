# Enrivea Signal production-readiness review

Date: 2026-09-29

## Verified in code

- Password authentication uses bcrypt, verified email, database-backed account status, JWT session invalidation, and persistent login throttling.
- New operational administrators can be provisioned without committing credentials. Temporary credentials are forced through password rotation before any admin or product API can be used.
- Administrator mutations re-check the current database role and status and record audit reasons where operationally material.
- Public demo accounts are isolated from production users, payments, credentials, and external email.
- Exchange credentials are encrypted, bound to the owning user, and Binance connections reject any key with trading, withdrawal, transfer, margin, or futures permissions.
- Billing settlement is webhook-led and live Paystack activation is gated by explicit merchant, webhook, country, currency, and price configuration.
- Market research uses closed Binance candles, supports the configured 20 markets and five timeframes, and distinguishes paper outcomes from real P&L.
- Security response headers are applied globally. Production compilation, type checking, linting, tests, and the dependency audit pass.

## Required deployment configuration

Run `npm run check:production` against the deployment environment. It intentionally fails for localhost and placeholder secrets. Before public launch, configure:

- managed MongoDB with backups, restore testing, network restrictions, and alerting;
- HTTPS `APP_URL` and `NEXTAUTH_URL`, a unique 32+ character auth secret, and a 32-byte base64 exchange encryption key;
- allowed and restricted countries based on counsel's launch policy;
- verified Resend sending domain and support address;
- production OpenAI model/key and spend/rate limits;
- Paystack merchant approval, webhook confirmation, production prices, currency, and allowed countries before enabling live billing;
- application error tracking, uptime checks, structured log retention, abuse alerts, and an incident runbook.

## Product boundary that must remain explicit

The current release is a research SaaS with read-only exchange connectivity, one-click user review, and paper performance tracking. It does not yet place live Binance orders. Live execution requires a separate audited order service, explicit exchange trading-key consent, idempotent order state machines, reconciliation, kill switches, per-country availability, and legal approval. The UI must continue to label execution as pending until that work is completed.
