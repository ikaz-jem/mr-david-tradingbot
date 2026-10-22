# Final live-test readiness — 21 October 2026

## Verdict

The production build and automated core-flow checks pass. This is a hardened candidate for controlled final testing, not certification for unrestricted real-money trading or public launch. No real payment, payout, email delivery, or exchange order was initiated during these checks.

## Implemented in this pass

- Background billing reconciliation recovers pending Paystack/NOWPayments purchases without requiring an open checkout tab. Registered every five minutes in `vercel.json`.
- Durable receipt jobs are created in the credit-grant transaction. Failed email delivery retries without repeating credits or inbox notifications. Ambiguous deliveries stop before the provider idempotency window expires and are flagged for attention.
- Scheduled jobs have exclusive leases, crash recovery, recorded outcomes, and freshness checks. Internal workers require the scheduler bearer secret; browser cookies cannot authorize them.
- Admin System now reports observed scheduler health and payment/receipt backlogs. `/api/internal/readiness` is a protected monitoring endpoint, not a public diagnostics dump.
- Verified email changes require an authenticated owner, current password, confirmation at the new address, single-use expiring token, and notification to the former address. Previous sessions are invalidated.
- Password-reset and verification-token consumption is transactional. Old staff invitations cannot reactivate suspended users.
- Account closure is blocked while managed trades remain open or uncertain. Execution reservations and closure serialize on the account record so credentials cannot be removed mid-reservation.
- Distributed limits protect registration, password recovery, verification resend, email changes, and checkout creation. Missing or revoked tracked sessions fail closed.
- Payment verification rejects a gateway environment that differs from the purchase environment.

## Verification evidence

- `npm run build`: passed, including TypeScript and route generation.
- `npm run lint`: passed.
- `npm test`: 95 passed, zero failed.
- Runtime dependency audit: zero reported vulnerabilities at the time of this pass (not a security certification).
- `test-release-readiness.mjs`: passed against a disposable replica-set database with mocked providers. Covers concurrent fulfillment, durable receipt recovery, off-page payment recovery, email-change replay, suspended invitations, account-closure rollback, and scheduler overlap/failure recovery.
- `test-payment-engine.mjs`: passed. Signed crypto activation, Paystack refill, partial-payment handling, invalid signatures, duplicate protection, and first-purchase commission.
- `test-approval-engine.mjs`: passed. Shared discovery/cache, no per-user scan charge, cadence, publication deduplication, and credential-failure reporting.
- `test-affiliate-engine.mjs`: passed. Activation-only rewards, fixed/percentage calculations, immutable snapshots, idempotency, disabled-program behavior, and rollback.
- Production-mode Help Center browser smoke test: passed on local port 3001 using the Atlas resolution launcher. Covers public visibility, unauthorized access, demo isolation, draft/review/publication/deletion, and optimistic edit conflicts. The first attempt on port 3000 timed out before using that connection workaround.

These integration scripts create and delete only their uniquely named disposable test databases. They are not evidence of successful live provider settlement or exchange execution.

## Required before final live testing

1. Set the actual HTTPS deployment origin in APP_URL and NEXTAUTH_URL. Localhost is expected for local development but cannot receive provider webhooks.
2. Replace invalid country configuration with the merchant-approved two-letter country codes. Do not simply allow every country to bypass the gate.
3. Configure and verify provider webhooks, merchant approval, production credentials, Resend sender/domain, and R2 bucket/access/CORS settings. Rotate any credentials previously shared in chat; do not rotate encryption keys without migrating encrypted data.
4. Enable the five scheduled jobs on hosting that supports the required frequency. Configure an external monitor using the scheduler secret and verify successful heartbeats; an endpoint alone does not send alerts.
5. Verify database network access, indexes, backups, and a restore rehearsal. Local SRV resolution required the existing Atlas direct-resolution launcher in this environment.
6. Keep live execution certification disabled until venue-by-venue test orders validate fills, quantity precision, protections, reconciliation, cancellation, and manual changes. Never enable unsupported venues merely to remove a warning.

## Final acceptance tests

- Complete activation and refill using provider sandbox, then a separately approved small live purchase. Close the browser before settlement; verify one grant, one commission for activation only, one receipt, and matching payment history.
- Replay signed callbacks; confirm no duplicate balance or commission. Verify failed, abandoned, underpaid, and delayed payments remain correctly classified.
- Confirm owner isolation and staff permission denial, paused registration/billing/scans, session revocation, password reset, email change, and account closure with open trades.
- Run Approval Desk and Autopilot only with explicitly authorized test accounts and order amounts. Check stop/target placement and exchange-confirmed position history/P&L before enabling live execution.
- Upload and delete Help Center images in the configured R2 bucket, publish/unpublish content, and verify orphan cleanup and private asset access.
- Test support tickets, notification preferences, email delivery/bounces, and manual affiliate settlement with an external payment reference. Recording a settlement is not the same as sending money.

## Remaining limitations / launch blockers

- Automated refund and chargeback lifecycle handling is not complete. Establish a manual incident process for credits, activation entitlement, and unpaid/paid affiliate rewards before accepting unrestricted live payments.
- MFA is not implemented; existing metadata must not be presented as MFA protection.
- Exchange coverage is not equivalent across venues: certified futures tracking is Binance-focused; other venue protection and P&L support must be certified individually. Spot research stop/target levels are not automatically guaranteed protective orders.
- Legal terms, geographic eligibility, merchant acceptance, and risk disclosures require business approval. A technical test cannot certify them.
- Full load/soak tests, disaster recovery, independent security review, and every live integration remain outside the completed automated checks.

## Authorization review

Account mutations are owner-only and server-enforced with password/token checks, demo isolation, rate limits, and audit records. Workers are trusted-system operations authenticated by bearer secret; they do not accept user-selected ownership. Operational diagnostics require settings-read permission or the scheduler secret. The new monitoring and delivery records contain no provider credentials. All database test writes are isolated from customer data.
