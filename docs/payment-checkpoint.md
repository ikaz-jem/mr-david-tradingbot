# Payment checkpoint — 17 October 2026

Saved before moving to the Help Center planning task. This is a development checkpoint, not a production certification.

## Completed in the latest Paystack pass

- Billing defaults to the signed-in account email. Users may enter another payment email for Paystack test or live checkout.
- The payment email is stored on the purchase and displayed on checkout. Verification compares the provider response with that saved email, order reference, mode, amount, currency, and transaction identifier.
- Credits remain attached to the purchase owner. An alternative payment email does not change the login, account ownership, or the destination for Enrivea account receipts.
- Existing protections include authenticated owner-scoped purchase APIs, same-origin mutations, signed webhooks, isolated demo/live balances, and transactional fulfillment intended to prevent duplicate credit grants.
- Live Paystack checkout now requires all three existing launch flags: BILLING_LIVE_ENABLED=true, PAYSTACK_MERCHANT_APPROVED=true, and PAYSTACK_WEBHOOK_CONFIRMED=true. Dashboard credentials do not bypass these flags. Existing purchase verification remains available.
- The previous pass reported 90 passing unit tests, successful TypeScript checks, targeted lint, and a successful production build. No end-to-end provider payment or external webhook delivery was completed during that pass.

## How confirmation currently works

- The checkout page checks the provider about every 20 seconds while visible. Closing the page stops that browser polling.
- A reachable, correctly configured Paystack webhook at /api/webhooks/paystack-live can verify and fulfill a payment independently of the browser.
- Localhost cannot receive provider webhooks directly. A returning user can reopen checkout to verify by reference; authorized staff can also verify an order.
- There is no independent scheduled payment reconciliation worker currently established by this audit. Do not describe one as deployed.

## Resume here

1. Confirm the actual deployed environment and dashboard gateway configuration. Local APP_URL and NEXTAUTH_URL are HTTP localhost URLs; do not replace local development values with guessed production values.
2. Confirm Paystack acceptance of the actual merchant activity before enabling live checkout. The previous audit identified provider restrictions relevant to crypto trading; obtain a provider determination for Enrivea's scope.
3. Configure public HTTPS URLs and the correct webhook for each provider environment. Confirm delivery with a provider-originated event and server-side verification.
4. Complete a provider test payment: activation and refill, account email and alternative email, browser closed before confirmation, duplicate webhook, failed/pending payment, and balance/receipt reconciliation.
5. Test simultaneous verification and webhook delivery against a disposable database to verify exactly-once grants; confirm demo/live and ownership isolation.
6. Check refund/chargeback handling, pending-order reconciliation, alerting, and notification retry coverage before declaring payments production-ready. These are not fully certified by unit tests.
7. After merchant acceptance and deployment validation, complete an explicitly authorized live settlement and reconcile provider and platform records.

The local production-readiness command also reported missing vercel.json and exchange execution certification. These relate to scheduled trading/deployment and require separate follow-up. Existing docs that claim a deployed cron schedule must be checked against actual deployment files.

## Relevant files

- src/app/api/billing/checkout/route.ts
- src/app/api/billing/purchases/[reference]/route.ts
- src/app/api/webhooks/paystack-live/route.ts
- src/lib/payment-verification.ts
- src/lib/payment-fulfillment.ts
- src/lib/paystack-checkout-policy.ts
- src/lib/paystack-live-policy.ts
- src/components/payment-billing-console.tsx
- docs/payment-gateways.md

No live flags, merchant approval, external payment, or deployment is authorized merely by resuming this checkpoint.
