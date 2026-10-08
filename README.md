# Enrivea Signal

An Enrivea-owned crypto research SaaS in active development. The current build includes a content-rich public site, MongoDB-backed accounts, Resend email flows, a credit ledger, a user research workspace, and a staff/admin control room. Binance Spot public prices and candles appear in the dashboard when the public API is reachable. **This is not yet a paid or live-trading production release.**

## Current scope

| Area | Status |
| --- | --- |
| Landing, pricing, about, contact, legal, cookies | Implemented; legal content is a review draft, proposed prices are not for sale |
| Email/password sign-up and sign-in | Implemented with NextAuth credentials and MongoDB; verified email required when Resend is configured |
| Transactional email | Resend verification, welcome, password reset/change, contact delivery, and signed delivery webhooks implemented; live delivery awaits domain and API configuration |
| Product-scoped credits and monthly access | Trade research wallet, welcome credits, expiry gate, verified-purchase ledger, and admin adjustments implemented; additional products need catalog registration |
| Account and notifications | Profile-name edit, password rotation/session invalidation, and an event-driven inbox implemented; verified email-change flow pending |
| Public Binance Spot market overview | Implemented with graceful unavailable state |
| AI trade scans | On-demand Binance Spot 4h scanner for BTC/ETH/SOL; AI explanation of qualifying long setups; no-setup scans recorded |
| Signal outcomes and performance | Forward-only paper outcome engine and scorecard; actual exchange P&L pending |
| Multi-exchange Spot connection and user-confirmed execution | Binance, Bybit, OKX, Kraken, and KuCoin support read-only or tightly scoped Spot-trading keys, encrypted storage, balances, explicit Approval Desk execution, idempotent order recording, and provider-specific reconciliation |
| Paid packages | Three monthly passes and two top-ups have a gated Paystack live checkout and transaction-verified fulfillment path. Live checkout is off until written merchant approval, prices, country scope, webhook, and secret are configured; existing sandbox is separate and never grants credits |
| Admin dashboard | Role-guarded control room, audited operational settings, encrypted AI/Resend integration configuration, signal invalidation, activity, billing, and email-delivery views; production observability still pending |
| Public demo sign-in | Always-visible user/admin showcase on deployed and development builds; demo-scoped data and restricted admin routes |

The interface intentionally shows empty states for unimplemented trading and analytics features. It does not display invented returns or permit payment while merchant setup is incomplete.

## Local setup

1. Install Node.js 20.9 or later and Docker Desktop, a local MongoDB service, or a MongoDB connection.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`. Set `MONGODB_URI`, `NEXTAUTH_URL`, `APP_URL`, and a long random `NEXTAUTH_SECRET` (at least 32 characters). Set `OPENAI_API_KEY` and `OPENAI_MODEL` in the environment, or add them later at `/admin/controls` to enable scans.
4. For local MongoDB, run `docker compose up -d`.
5. Run `npm run dev` and open `http://localhost:3000`.
6. Register an account. In local development only, accounts are automatically marked verified if Resend is not configured. To grant the initial admin role, run `npm run make-admin -- your@email.example` and sign out and back in.

### Exchange connections and Approval Desk execution

Set `EXCHANGE_ENCRYPTION_KEY` to a stable, randomly generated 32-byte key encoded as base64 or 64 hex characters. Keep the same value on every server instance and across deployments; losing or changing it makes stored API credentials unreadable. Set it separately in Vercel for each environment. Never commit the key or paste it into chat. A local key can be generated with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"` and copied directly into ignored `.env.local`.

Verified non-demo users can open `/dashboard/exchanges`, connect one Binance, Bybit, OKX, Kraken, and KuCoin account, and choose either read-only access or Spot execution. Each exchange uses its native authentication and exact permission model. Read-only connections reject trading and money-moving permissions. Spot execution accepts only the provider's read/query plus Spot-order capabilities while rejecting withdrawal, transfer, margin, derivatives/futures, earn, and unrelated permissions. Keys, secrets, and passphrases are never returned to the browser or shown to admins; disconnection deletes the stored ciphertext.

After an Approval Desk setup has been unlocked, its owner can choose a trade-enabled exchange, submit one Spot market entry by USDT amount, and type `EXECUTE`. The server rechecks authentication, account status, ownership, platform controls, the selected verified connection, rate limits, and explicit confirmation. Each provider adapter converts symbols, quote/base quantities, minimums, and increments using live instrument rules. A Spot SELL disposes of an already-owned asset—it is not a short position. A unique client order ID and durable order ledger prevent submission to the same or a second venue. Timeouts and ambiguous provider responses remain `unknown` and are reconciled against the same exchange rather than resubmitted.

This flow submits only the market entry. The research stop and target are advisory and are **not** protective stop-loss, take-profit, or OCO orders on Binance. Do not enable live trading until legal/compliance, security, monitoring, incident-response, and controlled staging checks are complete. Automated tests mock Binance and never place a real order.

Binance's private API must be reachable from the deployment. Restricting a key to server IPs is recommended only when outbound egress is stable; a standard serverless deployment can have changing egress IPs. Test from the actual deployment environment. Country eligibility, key rotation, security review, retention policy, and operational incident response remain launch gates.

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

The scanner reads only fully closed candles from Binance's public Spot market-data endpoint. It calculates filter decisions and price levels in code; the AI writes only the thesis and risk explanation. Each completed scan costs one Trade research credit even if no setup qualifies; failed scans are refunded. Welcome credits work before the first paid month. After a paid month ends, unused credits remain but scans are blocked until renewal. Scan debit and ledger recording still need crash-safe reconciliation before paid launch. Do not treat a published idea as a validated strategy or execute it without independent review.

Paper outcomes are recalculated on demand from later fully closed 1-minute Spot candles, never from candles before publication. They use conservative intrabar ordering, 0.10% assumed fee and 0.05% assumed slippage on both entry and exit. A paper result is **not** a live fill or real P&L. A scheduled background reconciler, missing-data monitoring, and a larger forward sample are still needed before reporting strategy performance publicly.

## Next implementation gates

1. Confirm Enrivea's contracting entity, initial allowed and blocked jurisdictions, and legal advice on research signals and user-directed execution. Enforce eligibility server-side before any paid or trade action.
2. Obtain written Paystack approval for this crypto-research/execution product and confirm the Nigerian merchant's permitted customer countries. Approve currency and exact prices, configure the signed live webhook, and test checkout and one-time fulfillment on a staging replica set. Implement refunds/chargebacks and customer-country verification before launch. A return URL never grants credits. Integrate NOWPayments separately after merchant approval.
3. Add crash-safe scan-credit reconciliation, rate limits, abuse monitoring, and a transactional/outbox approach for billable events. Expand deterministic scanner tests and historic-data reproducibility.
4. Automate paper outcome reconciliation, monitor missing market data, and evaluate a meaningful forward sample before making performance claims.
5. Validate every enabled exchange adapter with dedicated staging accounts and minimum Spot-trading permissions, including rejected orders, partial fills, timeouts, reconciliation, key rotation, IP allowlisting through stable egress, and emergency shutdown. Add exchange-native protective orders separately before describing entries as bracketed or risk-managed execution. Keep live use off until security and legal review.
6. Configure Resend in staging and production, test actual delivery, review legal copy/cookies/data retention, obtain a security assessment, add production observability/backups, and run a staged launch checklist.

## Billing decision (September 2026)

Enrivea is a Nigerian legal entity. The implemented model is three **manually renewable monthly passes** with credits granted only for a successfully verified payment, plus separate top-ups available during active access. Unused credits carry forward but cannot be consumed after a paid period ends until renewal. Automatic recurring card charges are **not** enabled. Paystack is the first requested rail; NOWPayments is later. The sending domain for Resend is still undecided. No provider credentials, approved prices, or merchant approval have been supplied, so live checkout remains off.

Direct Stripe Checkout is not assumed available to this Nigerian entity: Stripe's country list labels Nigeria as an extended-network/Paystack market. Paystack's current international-payment eligibility page lists cryptocurrency and investment businesses as ineligible. Stripe's restricted-business policy separately calls for approval of financial/crypto-related services. Do not activate Paystack or Stripe live payments without written provider confirmation and a supported merchant arrangement. "Worldwide" describes the intended reach, not permission to sell, provide regulated advice, or execute orders in every jurisdiction. Country eligibility must be defined and enforced before paid or exchange activity.

NOWPayments documents recurring email invoices, but renewal is not proof of payment. Each paid billing period must be verified through a signed IPN and, where necessary, a server-side provider status check before granting credits. Cancellation, refunds, chargebacks, taxes, and billing-support policies still need legal and operational sign-off.

### Gated live Paystack checkout

The live adapter at `/api/billing/checkout` creates a one-time Paystack checkout for a monthly pass or top-up. `/api/webhooks/paystack-live` validates the raw-body SHA-512 signature, verifies the transaction with Paystack, checks domain, amount, currency, reference, and customer email, then grants access and credits with an idempotent MongoDB transaction. The callback URL only returns the customer to billing; it never grants credits. The existing `/api/webhooks/paystack` remains test-only and does not fulfill purchases.

Do **not** enable live billing without written provider acceptance of Enrivea's exact crypto-research and execution scope, lawful customer-country restrictions, and a MongoDB replica set. Paystack's published guidance lists crypto and investment businesses as ineligible for international payments and crypto trading as ineligible for Nigerian merchants. The environment gates `PAYSTACK_MERCHANT_APPROVED`, `PAYSTACK_WEBHOOK_CONFIRMED`, and `BILLING_LIVE_ENABLED` must all be `true` alongside a live secret, approved currency, `PAYSTACK_ALLOWED_COUNTRIES`, and server-owned minor-unit prices for each plan and pack. A country code on the account is also required; it must be verified through an onboarding/compliance process, not simply typed by a user. This checkout is a prepared integration, **not** authorization to operate it.

Before a public launch, test successful and repeated webhooks, rejected amounts/currencies, concurrent purchases, failed transactions, refunds/chargebacks, database outages, and manual reconciliation. Configure production monitoring and a support workflow for payments stuck in `review` or `pending`.

### Paystack sandbox adapter

In a **local development environment only**, create three monthly plans in Paystack's test dashboard. Set `PAYSTACK_SANDBOX_ENABLED=true`, a `sk_test_` value in `PAYSTACK_TEST_SECRET_KEY`, and the matching `PLN_` codes in `PAYSTACK_TEST_PLAN_STARTER`, `PAYSTACK_TEST_PLAN_TRADER`, and `PAYSTACK_TEST_PLAN_DESK`. Never place a live key in these variables. The sandbox checkout endpoint fetches each test plan from Paystack to confirm its interval and amount before initializing a test subscription; it ignores browser-supplied prices. Sandbox activity is visible to admins, not issued as credits.

Set the Paystack test webhook URL to a public staging/tunnel HTTPS endpoint ending in `/api/webhooks/paystack`. The handler verifies the raw-body HMAC-SHA512 signature and re-verifies successful transactions with Paystack before recording them as `paid_test`. It does **not** issue credits, activate access, send billing email, or support live charges. Paystack's callback redirect is only navigation, not payment evidence. Localhost itself cannot receive Paystack webhooks.

Sandbox integration does not imply Paystack has accepted this merchant category.

See [the research plan](reports/AI%20crypto%20trading%20SaaS%20plan.md) for the full architecture and market comparison.
