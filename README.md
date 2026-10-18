# Enrivea Signal

An Enrivea-owned crypto research SaaS in active development. The current build includes a content-rich public site, MongoDB-backed accounts, Resend email flows, a credit ledger, a user research workspace, and a staff/admin control room. Binance Spot public prices and candles appear in the dashboard when the public API is reachable. **This is not yet an authorized public live-trading release.** The application fails closed around merchant approval, country policy, scheduler secrets, and exchange-execution certification.

## Current scope

| Area | Status |
| --- | --- |
| Landing, pricing, about, contact, legal, cookies | Implemented; legal content is a review draft, proposed prices are not for sale |
| Email/password sign-up and sign-in | Implemented with NextAuth credentials and MongoDB; verified email required when Resend is configured |
| Transactional email | Resend verification, welcome, password reset/change, contact delivery, and signed delivery webhooks implemented; live delivery awaits domain and API configuration |
| Account activation and shared credits | One-time activation, configurable starting credits, refill packs, immutable ledger, and audited admin adjustments implemented |
| Account and notifications | Profile-name edit, password rotation/session invalidation, and an event-driven inbox implemented; verified email-change flow pending |
| Public Binance Spot market overview | Implemented with graceful unavailable state |
| AI trade scans | On-demand multi-pair/multi-timeframe scanner with deterministic strategies, AI validation/explanation, shared five-minute market/AI caches, and atomic credit capture |
| Signal outcomes and performance | Forward-only paper outcome engine and scorecard; Binance Futures fills, position, protection, fees, funding, and P&L are reconciled separately from paper results |
| Multi-exchange execution | Binance, Bybit, OKX, Kraken, and KuCoin support encrypted, owner-scoped Spot/Futures connections and explicit Approval Desk execution. Binance Futures has a bounded lifecycle tracker; other Futures venues are blocked pending equivalent certified tracking. Other Spot venues expose order status only, not verified live P&L. |
| Guarded Autopilot | Implemented as a five-minute leased worker over the shared Approval Desk opportunity pool, with owner-scoped policy, atomic credit capture, duplicate suppression, limits, password step-up, exchange-side Futures TP/SL, emergency stop, customer ledger, and an admin operations center; live execution remains locked until adapter certification |
| Activation and refill payments | Paystack and NOWPayments adapters support one-time activation and refill purchases with signed webhooks and idempotent fulfillment. Live availability remains gated by merchant approval, HTTPS callbacks, country policy, credentials, and reconciliation procedures |
| Admin dashboard | Role-guarded control room, audited operational settings, encrypted AI/Resend integration configuration, signal invalidation, activity, billing, and email-delivery views; production observability still pending |
| Public demo sign-in | Always-visible user/admin showcase on deployed and development builds; demo-scoped data and restricted admin routes |

The interface uses explicit unavailable or empty states when exchange-confirmed lifecycle data does not exist. It does not invent returns or permit payment while merchant setup is incomplete.

## Local setup

1. Install Node.js 20.9 or later and Docker Desktop, a local MongoDB service, or a MongoDB connection.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`. Set `MONGODB_URI`, `NEXTAUTH_URL`, `APP_URL`, and a long random `NEXTAUTH_SECRET` (at least 32 characters). Set `OPENAI_API_KEY` and `OPENAI_MODEL` in the environment, or add them later at `/admin/controls` to enable scans.
4. For local MongoDB, run `docker compose up -d`.
5. Run `npm run dev` and open `http://localhost:3000`.
6. Register an account. In local development only, accounts are automatically marked verified if Resend is not configured. To grant the initial admin role, run `npm run make-admin -- your@email.example` and sign out and back in.

### Help Center and R2 images

The public knowledge base is at `/help`; authorized platform staff edit demo or live content at `/admin/help`. The first read seeds 55 initial English guides without overwriting edits or restoring deleted articles. Run `npm run migrate:help` after deployment to register the new `help:read/create/update/publish/delete` permissions for existing platform staff roles without altering unrelated grants. Review the seeded articles against the deployed features before relying on them as customer guidance.

Admin image uploads require a private Cloudflare R2 bucket. Configure all four values at `/admin/controls/storage` (preferred) or as the `R2_*` deployment variables; dashboard values take precedence, and the admin control verifies upload/read/delete before saving. Keep `SERVICE_CONFIG_ENCRYPTION_KEY` stable in the deployment: it encrypts dashboard credentials and cannot itself be configured from the dashboard. Create an R2 API token with object read/write/delete access to that bucket. The app accepts JPG/PNG/WebP under 5 MB, converts them to bounded WebP, and proxies public images only for published live articles. Draft/demo images require staff read permission. Article deletion immediately attempts to delete its R2 images; failed deletions are hidden and retried by the daily Vercel cron at `/api/internal/help-assets`. Set a strong `CRON_SECRET` on Vercel so that endpoint can run. The admin editor also has a manual retry control. R2 secrets are entered only in the protected admin form and are never returned or bundled with client code.

Images are optional: the initial guides are text-only. Add screenshots only after redacting personal information and exchange credentials. Helpfulness feedback stores a short-lived pseudonymous hash, not raw search text; set `HELP_FEEDBACK_SALT` if you want an independent salt. Search and article pages expose published live content only.

### Exchange connections and Approval Desk execution

Set `EXCHANGE_ENCRYPTION_KEY` to a stable, randomly generated 32-byte key encoded as base64 or 64 hex characters. Keep the same value on every server instance and across deployments; losing or changing it makes stored API credentials unreadable. Set it separately in Vercel for each environment. Never commit the key or paste it into chat. A local key can be generated with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"` and copied directly into ignored `.env.local`.

Verified non-demo users can open `/dashboard/exchanges`, connect one account per supported exchange (Binance, Bybit, OKX, Kraken, or KuCoin), and choose read-only, Spot execution, or separately scoped Futures execution. Each exchange uses its native authentication and exact permission model. Read-only connections reject trading and money-moving permissions. Spot and Futures verification allow only the minimum provider-specific read/order permissions and reject withdrawal or transfer capabilities. Keys, secrets, and passphrases are never returned to the browser or shown to admins; disconnection deletes the stored ciphertext.

After an Approval Desk setup has been unlocked, its owner can choose an eligible trade-enabled exchange and Spot or Futures market, enter the amount and supported Futures risk settings, and type the exact confirmation phrase. The server rechecks authentication, active status, ownership, verified country policy, platform controls, the selected verified connection, and explicit confirmation. Each provider adapter converts symbols, quote/base quantities, minimums, and increments using live instrument rules. A Spot SELL disposes of an already-owned asset—it is not a short position. A unique client order ID and durable order ledger prevent submission to the same or a second venue. Timeouts and ambiguous provider responses remain pending and are reconciled against the same exchange rather than resubmitted.

Spot execution submits the market entry; its research stop and target remain advisory. Futures execution attempts exchange-native stop-loss and take-profit protection and marks incomplete protection as an urgent failure state. Do not enable live trading until legal/compliance, security, monitoring, incident-response, and controlled staging checks are complete. Automated tests mock providers and never certify a real account.

Binance's private API must be reachable from the deployment. Restricting a key to server IPs is recommended only when outbound egress is stable; a standard serverless deployment can have changing egress IPs. Test from the actual deployment environment. Country eligibility, key rotation, security review, retention policy, and operational incident response remain launch gates.

### Exchange trade tracking

The scheduled `/api/internal/trade-tracking` job runs every minute with Vercel's `CRON_SECRET` bearer authorization. It leases due Approval Desk and Autopilot orders in MongoDB, reads the owning connection's exchange records, deduplicates fills, and updates the order and linked workspace records. Admins can request an owner-checked single-order refresh from Orders; customers see only their own positions. The job never submits a new trade. Store `CRON_SECRET` in every deployed environment; the local value does not deploy automatically.

Run `npm run migrate:trade-tracking` against the intended database before enabling live execution. This creates the unique per-symbol position guard and fill-deduplication indexes. It is non-destructive but can fail if pre-existing data violates uniqueness; investigate such rows instead of dropping data or indexes.

Binance Futures is the only venue with exchange-confirmed position, fill, protection, fee, funding, and mark-to-market tracking. The tracker reconciles actual quantity before publishing P&L; mismatches, incomplete history, missing keys, or failed protection produce an attention state and emergency-stop running Autopilot. A displayed decision score or paper result is not live P&L. Live results are withheld when complete attribution is impossible. One-way mode and exclusive control of a symbol are required; trading the same symbol externally makes attribution uncertain. The exchange's trade-history retention and the bounded worker limit mean very old unsynced positions or large backlogs require manual investigation, not guessed results.

Before setting `EXCHANGE_EXECUTION_CERTIFIED=true`, validate fresh/partial/closed trades, manual exchange-side closes, fee assets, funding, TP/SL changes, 429/timeout/retry behavior, key revocation, and the cron schedule on a dedicated staging account. Review `/admin/orders` for stale or uncertain rows and reconcile or stop trading; do not mark an unresolved order settled. Other Futures venues are intentionally blocked until equivalent read adapters and staged reconciliation exist. This tracker is not a substitute for exchange account statements or audited financial reporting.

### Vercel authentication URLs

Set `NEXTAUTH_URL` and `APP_URL` in Vercel's environment settings to the exact public HTTPS origin (for example, `https://signal.example.com`), with no trailing path. Do not create either variable with an empty value. Also set a strong `NEXTAUTH_SECRET` and a reachable production `MONGODB_URI`. Apply the settings to the correct Vercel environment and redeploy. The login and registration forms defer loading the NextAuth browser helper until interaction, so a blank build-time URL no longer crashes static prerendering; that does **not** replace the need for correct runtime URLs. Production registration also requires the Resend sender configuration described below.

## Resend setup

1. Verify an Enrivea-owned sending domain or subdomain in Resend and publish its required DNS records. Use an address on that verified domain for `RESEND_FROM_EMAIL`; do not use a personal inbox as the sender.
2. Set `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `RESEND_SUPPORT_EMAIL` in the deployment environment or the admin configuration page. In production, registration refuses to create an account if the API key and verified sender are absent. Password-reset and contact requests also refuse to send when the provider is unavailable.
3. Set `APP_URL` and `NEXTAUTH_URL` to the exact public HTTPS origin. Email links are built from `APP_URL`.
4. In Resend, point the webhook to `https://<your-domain>/api/webhooks/resend`, subscribe to delivered, bounced, complained, failed, and suppressed email events, and set `RESEND_WEBHOOK_SECRET` in the environment or admin configuration page. The route verifies the raw payload signature before accepting an event.
5. Test verification, resend, welcome, reset, password-change, contact, and webhook events with a real controlled mailbox in staging. The local smoke test cannot prove external delivery.

Enter provider credentials only in the authenticated admin configuration form or deployment secret manager; never paste them into chat, public forms, logs, or commits. The admin form stores encrypted dashboard overrides in MongoDB and never displays saved secrets. It derives encryption from `NEXTAUTH_SECRET`, so keep that deployment secret stable and back it up securely; rotating it requires migrating or re-entering all dashboard-stored provider credentials. Removing an override restores any deployment-variable fallback. A "configured" badge means a value exists, not that the provider has accepted it; use staging delivery and scan tests to verify it.

Never commit `.env.local`, exchange API credentials, or encryption keys. Do not enable exchange withdrawal permissions for this product.

### Local dashboard previews

Open `/login` on the deployed site and use **Demo user** or **Demo admin**. These buttons are always available, without registration or an environment flag. Normal production configuration still requires a reachable MongoDB, a strong NEXTAUTH_SECRET, and NEXTAUTH_URL/APP_URL matching the deployed HTTPS origin. No deployment was performed by the local implementation.

The showcase uses shared `@enrivea.invalid` accounts with random unusable passwords. Never enter private information. Demo admin routes are allowlisted; live operational pages and live admin APIs are blocked. Demo account operations are restricted to demo users, and configuration uses separate demo records. The two showcase login accounts cannot be banned or demoted; use the four seeded sample customers to demonstrate those actions.

The Users page includes search/status/role filters, ban/unban, suspend/restore, role/country changes, session revocation, and an audit history. Every action requires a reason. **View as user** is a 15-minute, actor-bound, audited, read-only workspace preview—not a customer session or permission to trade, change credentials, or spend money.

The admin area includes a searchable account list with audited status/user/staff-role changes; reason-required controls for registration, AI scans, new Binance connections, paper reconciliation, contact intake, supported research pairs, and a workspace announcement; encrypted AI and Resend settings; targeted in-app notifications; and signal invalidation. It also has an activity timeline, paginated data and order views, billing operations, system checks, and an email-delivery view with a self-addressed Resend test for real admins. Real admins can make reason-required credit corrections or extend monthly access; wallet, ledger, and audit changes use a MongoDB transaction, so a replica set is required. Demo admins cannot use financial controls or send external test email. This is not a universal database editor and it never exposes payment-card or exchange-key data. Payment credentials and eligibility flags remain deployment-managed until merchant approval and compliance controls are established.

## Quality checks

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `node --env-file=.env.local scripts/smoke-auth.mjs` (requires the app on port 3000 and MongoDB; creates then removes its own test account)
- `node scripts/visual-check.mjs` (uses a locally installed Chrome and a running dev server; screenshots go to ignored `artifacts/`)
- `node --env-file=.env.local scripts/smoke-demo.mjs` (requires the dev server, demo login enabled, and MongoDB; checks both one-click logins, role isolation, audited account changes, platform gates, and signal moderation; restores control state)

The scanner reads only fully closed candles from Binance's public Spot market-data endpoint. It calculates eligibility and price levels in code; AI validates the candidate and writes the explanation. Each completed scan costs the admin-configured product credits even when no setup qualifies. The wallet debit, ledger capture, optional signal, and completed run are committed in one MongoDB transaction; a failed transaction charges nothing. Do not treat a published idea as a validated strategy or execute it without independent review.

Paper outcomes are recalculated from later fully closed 1-minute Spot candles, never from candles before publication. They use conservative intrabar ordering, 0.10% assumed fee and 0.05% assumed slippage on both entry and exit. A paper result is **not** a live fill or real P&L. The shared five-minute scanner runs paper reconciliation; missing-data alerting and a larger forward sample are still needed before reporting strategy performance publicly.

## Next implementation gates

1. Obtain legal sign-off for the exact allowed/blocked country lists and configure `ALLOWED_COUNTRIES`/`BLOCKED_COUNTRIES`. Live billing, credential connection, and order execution now fail closed and record an audit denial when country verification or deployment policy is missing.
2. Obtain written Paystack approval for this crypto-research/execution product and confirm the Nigerian merchant's permitted customer countries. Approve currency and exact prices, configure the signed live webhook, and test checkout and one-time fulfillment on a staging replica set. Implement refunds/chargebacks and customer-country verification before launch. A return URL never grants credits. Integrate NOWPayments separately after merchant approval.
3. Add distributed rate limiting, abuse alerting, and an outbox for post-commit notifications. Atomic scan charging is implemented; expand historic-data reproducibility and failure-injection testing.
4. Automate paper outcome reconciliation, monitor missing market data, and evaluate a meaningful forward sample before making performance claims.
5. Validate every enabled exchange adapter with dedicated staging accounts and minimum Spot/Futures trading permissions, including rejected orders, partial fills, timeouts, protection failures, reconciliation, key rotation, IP allowlisting through stable egress, and emergency shutdown. Binance Futures lifecycle reconciliation is implemented but needs exchange-backed staging certification; other Futures venues remain blocked until their read adapters and lifecycle tests exist. Keep live use off until security and legal review.
6. Configure Resend in staging and production, test actual delivery, review legal copy/cookies/data retention, obtain a security assessment, add production observability/backups, and run a staged launch checklist.

## Billing decision (October 2026)

Enrivea is a Nigerian legal entity. The implemented commercial model is a one-time, admin-configurable account activation that grants shared platform credits, followed by optional refill packs. There is no recurring membership or credit expiry. Paystack and NOWPayments are implemented as configurable rails; provider acceptance, permitted customer countries, exact production settings, refunds, and reconciliation procedures remain launch gates.

Direct Stripe Checkout is not assumed available to this Nigerian entity: Stripe's country list labels Nigeria as an extended-network/Paystack market. Paystack's current international-payment eligibility page lists cryptocurrency and investment businesses as ineligible. Stripe's restricted-business policy separately calls for approval of financial/crypto-related services. Do not activate Paystack or Stripe live payments without written provider confirmation and a supported merchant arrangement. "Worldwide" describes the intended reach, not permission to sell, provide regulated advice, or execute orders in every jurisdiction. Country eligibility must be defined and enforced before paid or exchange activity.

NOWPayments documents recurring email invoices, but renewal is not proof of payment. Each paid billing period must be verified through a signed IPN and, where necessary, a server-side provider status check before granting credits. Cancellation, refunds, chargebacks, taxes, and billing-support policies still need legal and operational sign-off.

### Gated live Paystack checkout

The live adapter at `/api/billing/checkout` creates a one-time Paystack or NOWPayments checkout for activation or a refill. Signed provider webhooks and server-side verification check amount, currency/network, reference, account, and provider status before idempotent MongoDB fulfillment. Browser return URLs never grant activation or credits.

Do **not** enable live billing without written provider acceptance of Enrivea's exact crypto-research and execution scope, lawful customer-country restrictions, and a MongoDB replica set. Paystack's published guidance lists crypto and investment businesses as ineligible for international payments and crypto trading as ineligible for Nigerian merchants. The environment gates `PAYSTACK_MERCHANT_APPROVED`, `PAYSTACK_WEBHOOK_CONFIRMED`, and `BILLING_LIVE_ENABLED` must all be `true`; the live secret, settlement currency, and rate are configured in admin payment controls. `ALLOWED_COUNTRIES` governs live billing access. A country code on the account is also required; it must be verified through an onboarding/compliance process, not simply typed by a user. This checkout is a prepared integration, **not** authorization to operate it.

Before a public launch, test successful and repeated webhooks, rejected amounts/currencies, concurrent purchases, failed transactions, refunds/chargebacks, database outages, and manual reconciliation. Configure production monitoring and a support workflow for payments stuck in `review` or `pending`.

### Paystack sandbox testing

The current activation/refill flow can run in provider test mode for demo accounts. Configure the demo Paystack gateway with a `sk_test_` key in admin payment controls. Test orders affect only demo credits and never grant live access. A demo account's placeholder address must be replaced with a valid payment email at checkout; real accounts default to their verified account email and may choose another payment email. The selected email is saved on the order and checked against Paystack verification.

For off-page confirmation in staging, configure the Paystack test webhook to the public HTTPS app origin plus `/api/webhooks/paystack-live`. On localhost, a callback and inbound webhook are unavailable; the open checkout page or a later return to it can verify the test payment by reference. The retired monthly-plan sandbox endpoint at `/api/billing/paystack/checkout` returns 410. Paystack's callback redirect is only navigation, not payment evidence. Sandbox integration does not imply Paystack has accepted this merchant category.

See [the research plan](reports/AI%20crypto%20trading%20SaaS%20plan.md) for the full architecture and market comparison.
