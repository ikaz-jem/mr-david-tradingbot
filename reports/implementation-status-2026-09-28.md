# Enrivea workspace upgrade — implementation checkpoint

## Latest update: user management and deployed showcase
- Replaced the old inline user forms with a searchable, status/role-filtered table, mobile account cards, and a focused account-management dialog.
- Added explicit ban/unban, suspend/restore, session revocation, role changes, verified-country editing, and recent audit history.
- Added actor-bound, audited, 15-minute read-only customer workspace previews. This is not full customer-session impersonation and cannot place trades or change billing.
- Demo user/admin login is now always available in development and production builds. The old development-only flag is no longer used.
- Public demo administration is allowlisted and restricted to demo records. Live operational pages/APIs are blocked, including direct URL requests. Showcase entry accounts are protected; four sample customers are provided for access-control demonstrations.
- Verified using a local production build and the development server: ban/unban invalidates sessions, revocation works, preview expiry is enforced, and demo admins cannot mutate or preview real customers.
- Deployment to the public host has not been performed. Use the deployed HTTPS origin for NEXTAUTH_URL and APP_URL and configure MongoDB and NEXTAUTH_SECRET before sharing /login.

The historical checkpoint below is superseded by this section for demo availability and user management.

## Available for review
- Development-only populated demo accounts: sample research, paper outcomes, notifications, membership, separate product wallets, and support conversation.
- Atomic, idempotent demo renewals, product top-ups, and scan debits. Membership expiration locks new consumption and top-ups without deleting balances.
- Demo admin product catalog: credit cost, monthly tier allocations, top-up size/price, pause scanner, add preview products. Future products cannot be enabled without an executor.
- Persisted support tickets for customers and staff: categories, search/filter, replies, assignment to self/unassignment, priorities, statuses, customer close/reopen, private staff notes, optimistic concurrency, notifications.
- 20 research pairs and 15m/30m/1h/4h/1d candle selection. Live scanner receives the selected interval. Demo scanner uses synthetic data only.
- Performance outcome chart, isolated demo admin billing report, multi-exchange connection previews (Binance/Coinbase/Kraken/OKX).
- Demo admin configuration uses separate records from live settings. Internal access-change reasons are no longer included in customer notifications.
- Checkout status updates cannot overwrite an already-confirmed payment; verified delayed payment callbacks can recover ambiguous failures.

## Policy implemented in the demo
One membership, separate balances by product. Top-ups do not extend membership. Early renewal adds one calendar month from the existing end date and credits immediately. Balances are retained after expiry, but locked. Unused credit retention is provisional and should be confirmed before public pricing/terms are published. Prices are sample USD amounts.

## Not yet production-ready
1. **Unified live membership migration:** migrate per-product legacy subscription dates to a shared membership with versioned plan entitlements. Current live billing still uses the legacy scanner-only account. Do not enable multi-product commerce on it.
2. **Transactional infrastructure:** local MongoDB is standalone. Provision a replica set/Atlas and verify backup/restore, transactional grants/debits, duplicate webhook handling, crash recovery, and reconciliation before accepting money.
3. **Payment administration/adapters:** dashboard-stored Paystack/PayPal/Stripe settings, eligibility review, real checkout adapters, signed webhook verification, refunds, invoices, currencies, and provider sandbox tests. Existing Paystack integration remains gated. No PayPal/Stripe checkout is claimed.
4. **Plan management:** monthly membership prices still come from a fixed sample plan list; product costs/allocations/top-up prices are editable in demo. Add versioned plan administration and purchase snapshots before live catalog writes.
5. **Communication:** Resend remains the email transport; add admin-managed template versions, optional notification preferences, queue retries, and suppression rules. Ticket notifications are in-app; email dispatch is not yet wired.
6. **Users/security:** existing suspend/role/country controls remain. Add granular restrictions, audited time-limited read-only impersonation, session listing/revocation, role permissions, MFA, rate limiting, and comprehensive tenant isolation tests. Never implement impersonation by copying credentials.
7. **Trading infrastructure:** only Binance read-only connection is real today. Other CEX cards are explicit demos. Add adapter contract tests, confirmed Spot execution, idempotent order submission, fee/fill reconciliation, and risk checks before enabling orders.
8. **Analytics:** add real usage/cost cohorts, conversion, retention, drawdown/exposure, and fill-derived P&L. Synthetic paper results must never appear as actual return claims.
9. **Operations:** background scan jobs, cancellation/recovery, monitoring, alerting, retention, audit export, support pagination/attachments/SLA, accessibility, and load tests.

## Validation commands
- npm test
- npm run typecheck
- npm run lint
- npm run build
- node scripts/smoke-upgrade.mjs (requires the local development server and demo login enabled)

The upgrade smoke test creates clearly labeled demo tickets and simulated billing activity. It never invokes a payment provider, live trade, or outbound email.

