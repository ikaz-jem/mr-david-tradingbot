# Enrivea Signal

An Enrivea-owned crypto research SaaS in active development. The current build includes a content-rich public site, MongoDB-backed accounts, Resend email flows, a credit ledger, a user research workspace, and a staff/admin control room. Binance Spot public prices and candles appear in the dashboard when the public API is reachable. **This is not yet a paid or live-trading production release.**

## Current scope

| Area | Status |
| --- | --- |
| Landing, pricing, about, contact, legal, cookies | Implemented; legal content is a review draft, proposed prices are not for sale |
| Email/password sign-up and sign-in | Implemented with NextAuth credentials and MongoDB; verified email required when Resend is configured |
| Transactional email | Resend verification, welcome, password reset/change, contact delivery, and signed delivery webhooks implemented; live delivery awaits domain and API configuration |
| Welcome credits and append-only credit records | Implemented |
| Public Binance Spot market overview | Implemented with graceful unavailable state |
| AI trade scans | On-demand Binance Spot 4h scanner for BTC/ETH/SOL; AI explanation of qualifying long setups; no-setup scans recorded |
| Signal outcomes and performance | Forward-only paper outcome engine and scorecard; actual exchange P&L pending |
| Binance account connection and one-click execution | Models and pages in place; API-key security and order service pending |
| Paid packages | Three proposed monthly plans displayed; Paystack test-only checkout adapter and signed webhook receipt implemented, but no credits are granted and live checkout is disabled |
| Admin dashboard | Role-guarded control room, audited account access, registration/scan switches, workspace announcement, signal invalidation, event timeline, billing-test and email-delivery views; production observability still pending |
| Local demo sign-in | One-click user/admin preview behind `NODE_ENV=development` and `DEMO_LOGIN_ENABLED=true`; demo sessions are rejected in production |

The interface intentionally shows empty states for unimplemented trading, billing, and analytics features. It does not display invented returns or pretend a proposed price is an active subscription.

## Local setup

1. Install Node.js 20.9 or later and Docker Desktop, a local MongoDB service, or a MongoDB connection.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`. Set `MONGODB_URI`, `NEXTAUTH_URL`, `APP_URL`, and a long random `NEXTAUTH_SECRET`. Set `OPENAI_API_KEY` and `OPENAI_MODEL` to enable scans.
4. For local MongoDB, run `docker compose up -d`.
5. Run `npm run dev` and open `http://localhost:3000`.
6. Register an account. In local development only, accounts are automatically marked verified if Resend is not configured. To grant the initial admin role, run `npm run make-admin -- your@email.example` and sign out and back in.

### Vercel authentication URLs

Set `NEXTAUTH_URL` and `APP_URL` in Vercel's environment settings to the exact public HTTPS origin (for example, `https://signal.example.com`), with no trailing path. Do not create either variable with an empty value. Also set a strong `NEXTAUTH_SECRET` and a reachable production `MONGODB_URI`. Apply the settings to the correct Vercel environment and redeploy. The login and registration forms defer loading the NextAuth browser helper until interaction, so a blank build-time URL no longer crashes static prerendering; that does **not** replace the need for correct runtime URLs. Production registration also requires the Resend sender configuration described below.

## Resend setup

1. Verify an Enrivea-owned sending domain or subdomain in Resend and publish its required DNS records. Use an address on that verified domain for `RESEND_FROM_EMAIL`; do not use a personal inbox as the sender.
2. Set `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `RESEND_SUPPORT_EMAIL` in the deployment environment. In production, registration refuses to create an account if this configuration is absent. Password-reset and contact requests also refuse to send when the provider is unavailable.
3. Set `APP_URL` and `NEXTAUTH_URL` to the exact public HTTPS origin. Email links are built from `APP_URL`.
4. In Resend, point the webhook to `https://<your-domain>/api/webhooks/resend`, subscribe to delivered, bounced, complained, failed, and suppressed email events, and set `RESEND_WEBHOOK_SECRET`. The route verifies the raw payload signature before accepting an event.
5. Test verification, resend, welcome, reset, password-change, contact, and webhook events with a real controlled mailbox in staging. The local smoke test cannot prove external delivery.

Do not paste API keys or webhook secrets into chat, browser forms, or commits. Rotate credentials if they have been exposed.

Never commit `.env.local`, exchange API credentials, or encryption keys. Do not enable exchange withdrawal permissions for this product.

### Local dashboard previews

Set `DEMO_LOGIN_ENABLED=true` in `.env.local` and run `npm run dev`. The dev script binds only to `127.0.0.1`; open `/login` and use **Demo user** or **Demo admin**. These buttons provision dedicated `@enrivea.invalid` local accounts with random unusable passwords. They appear only in development, and demo sessions are invalid outside development. The admin demo may change only demo accounts; it cannot modify real local users. The demo banner identifies the preview, and no example trade returns or payments are fabricated. Set the flag to `false` or remove it to disable this access. Do not deploy a development server publicly.

The admin area includes a searchable account list with audited status/user/staff-role changes, registration and scan pause/resume controls, a workspace announcement, and a signal-invalidation workflow with an owner-visible reason. It also has a 20-second-refresh activity timeline, paginated read-only data explorer, and dedicated billing-test and email-delivery views. The control room reports real database counts and outstanding operational conditions. Admin account changes, secrets, payment settlement, historical trade records, and financial adjustments are intentionally not editable through a generic web form. In particular, credit adjustments must wait for transactional wallet/ledger writes on a MongoDB replica set. This is not a universal database editor.

## Quality checks

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `node --env-file=.env.local scripts/smoke-auth.mjs` (requires the app on port 3000 and MongoDB; creates then removes its own test account)
- `node scripts/visual-check.mjs` (uses a locally installed Chrome and a running dev server; screenshots go to ignored `artifacts/`)
- `node --env-file=.env.local scripts/smoke-demo.mjs` (requires the dev server, demo login enabled, and MongoDB; checks both one-click logins, role isolation, audited account changes, platform gates, and signal moderation; restores control state)

The scanner reads only fully closed candles from Binance's public Spot market-data endpoint. It calculates filter decisions and price levels in code; the AI writes only the thesis and risk explanation. Each completed scan costs one credit even if no setup qualifies; failed scans are refunded. The credit balance is atomically debited in MongoDB and a ledger entry is written, but crash-safe reconciliation and transactional billing are still required before paid launch. Do not treat a published idea as a validated strategy or execute it without independent review.

Paper outcomes are recalculated on demand from later fully closed 1-minute Spot candles, never from candles before publication. They use conservative intrabar ordering, 0.10% assumed fee and 0.05% assumed slippage on both entry and exit. A paper result is **not** a live fill or real P&L. A scheduled background reconciler, missing-data monitoring, and a larger forward sample are still needed before reporting strategy performance publicly.

## Next implementation gates

1. Confirm Enrivea's contracting entity, initial allowed and blocked jurisdictions, and legal advice on research signals and user-directed execution. Enforce eligibility server-side before any paid or trade action.
2. Obtain written Paystack approval for this crypto-research/execution product and confirm the Nigerian merchant's permitted customer countries. Complete the subscription lifecycle, idempotent per-paid-period credit grants, refunds/chargebacks, and support operations in a transactional database. A return URL must never grant credits. Integrate NOWPayments monthly invoices separately after merchant approval.
3. Add crash-safe scan-credit reconciliation, rate limits, abuse monitoring, and a transactional/outbox approach for billable events. Expand deterministic scanner tests and historic-data reproducibility.
4. Automate paper outcome reconciliation, monitor missing market data, and evaluate a meaningful forward sample before making performance claims.
5. Add Binance Spot testnet first: encrypted no-withdrawal API credentials, account permission checks, an order preview, explicit user confirmation, idempotent submission, exchange-status reconciliation, and audit logs. Keep live execution off until security and legal review.
6. Configure Resend in staging and production, test actual delivery, review legal copy/cookies/data retention, obtain a security assessment, add production observability/backups, and run a staged launch checklist.

## Billing decision (September 2026)

Enrivea is a Nigerian legal entity. The intended product model is three **monthly subscriptions**, with credits replenished only for a successfully paid period. Paystack is the first requested integration; NOWPayments monthly crypto invoices are a later rail. The sending domain for Resend is still undecided. No provider credentials or merchant approval have been supplied, so there is **no live checkout**.

Direct Stripe Checkout is not assumed available to this Nigerian entity: Stripe's country list labels Nigeria as an extended-network/Paystack market. Paystack's current international-payment eligibility page lists cryptocurrency and investment businesses as ineligible. Stripe's restricted-business policy separately calls for approval of financial/crypto-related services. Do not activate Paystack or Stripe live payments without written provider confirmation and a supported merchant arrangement. "Worldwide" describes the intended reach, not permission to sell, provide regulated advice, or execute orders in every jurisdiction. Country eligibility must be defined and enforced before paid or exchange activity.

NOWPayments documents recurring email invoices, but renewal is not proof of payment. Each paid billing period must be verified through a signed IPN and, where necessary, a server-side provider status check before granting credits. The product needs explicit credit rollover/expiry rules, cancellation and refund rules, and a billing-support process before launch.

### Paystack sandbox adapter

In a **local development environment only**, create three monthly plans in Paystack's test dashboard. Set `PAYSTACK_SANDBOX_ENABLED=true`, a `sk_test_` value in `PAYSTACK_TEST_SECRET_KEY`, and the matching `PLN_` codes in `PAYSTACK_TEST_PLAN_STARTER`, `PAYSTACK_TEST_PLAN_TRADER`, and `PAYSTACK_TEST_PLAN_DESK`. Never place a live key in these variables. The checkout endpoint fetches each test plan from Paystack to confirm its interval and amount before initializing a test subscription; it ignores browser-supplied prices. The Credits page then offers a clearly labeled sandbox button.

Set the Paystack test webhook URL to a public staging/tunnel HTTPS endpoint ending in `/api/webhooks/paystack`. The handler verifies the raw-body HMAC-SHA512 signature and re-verifies successful transactions with Paystack before recording them as `paid_test`. It does **not** issue credits, activate access, send billing email, or support live charges. Paystack's callback redirect is only navigation, not payment evidence. Localhost itself cannot receive Paystack webhooks.

Before implementing fulfillment, settle plan prices in the merchant currency, credit expiry/rollover, taxes, eligibility, cancellation/refund rules, and a MongoDB replica set so the grant and ledger write can be transactional. Sandbox integration does not imply Paystack has accepted this merchant category.

See [the research plan](reports/AI%20crypto%20trading%20SaaS%20plan.md) for the full architecture and market comparison.
