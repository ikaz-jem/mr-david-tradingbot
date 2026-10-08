# Admin production audit — 2026-10-07

This is a code and read-only database audit, not a certification of external payment settlement, email delivery, market data, or live exchange orders. Demo and live scopes are intentionally separate. The public demo administrator must never be able to change live platform operations.

## Verified in this pass

- Next.js 16.3.6 production build succeeds; TypeScript passes; 50 tests pass; ESLint has no errors (one pre-existing auth navigation warning).
- Remote MongoDB database `enriveabot` is reachable. Read-only inventory found 6 real accounts, 6 demo accounts, 5 non-demo billing purchase records, 10 demo purchase records, and 4 support tickets. These counts do not prove that any purchase settled successfully.
- Global `registrationOpen` is currently `false`. This audit did not change it. A private real administrator must decide when to reopen registrations.
- Latest real payment configuration found NOWPayments enabled in live mode with stored API/IPN credentials. No latest real Paystack gateway configuration was found. Provider API acceptance, webhook delivery, and settlement remain unverified.
- AI and Resend have credential/model/sender configuration through database or deployment environment. Resend webhook verification is not configured in the checked environment. `APP_URL` is set, but its stability and public reachability were not verified.

## Admin feature inventory

| Area | Code-backed behavior | Launch qualification |
| --- | --- | --- |
| Control room | Database counts, recent accounts/scans, availability status, attention counts | Live/demo reporting now separated. Not full observability. |
| Users | Search/filter, access changes, role changes, read-only preview, audited credit/activation adjustments | Real-account path is database-backed; privileged-account protections remain. Needs operator acceptance tests. |
| Access & permissions | Staff invitations, role/permission management, direct overrides, audit | Server permission/organization checks; live invitations require working email. |
| Service availability | Persisted feature gates and messages | Demo operations now write only demo config; live changes require private admin. Existing global state must be reviewed. |
| Activation & credits | Persisted activation price/credits and refill packs | Checkout settlement is a separate prerequisite. |
| Research markets & approval pool | Persisted pairs, intervals, strategies, cadence and cap | Background schedule/provider operation needs deployment validation. |
| Products & strategies | Persisted catalog, credit costs, strategy definitions | Only published/validated live capabilities should be enabled. |
| AI/email provider | Encrypted settings or deployment fallbacks | Presence of credentials is not provider delivery verification. |
| Announcements/notifications | Persisted banner and targeted audited in-app notices | Live/demo recipient scope enforced. |
| Affiliates | Network/settings/commission records and admin payout recording | Recording a payout is not external fund transfer; refunds/reversals need reconciliation. |
| Billing/payments | Purchase records, gateway configuration, audited corrections | Not launch-certified: no complete merchant-authorized settlement/refund/chargeback test. |
| Support | Stored tickets, assignments, priorities, replies, internal notes | Read/update permissions enforced independently; read-only staff cannot reply. |
| Signals/orders | Stored operational records, signal moderation, order status inspection | Live exchange execution is not implemented; orders are read-only here. |
| Activity/data/system/emails | Stored event feeds, paginated records, configuration/integrity indicators, email attempts | Read-only diagnostics; not exhaustive real-time monitoring. Resend webhook pending. |

`/admin/controls/communications` and `/admin/controls/integrations` are legacy redirects to the notification and AI control pages.

## Changes in this pass

1. Removed a public demo-admin path to the global operations record. Demo controls now persist in the demo record only, with a regression test.
2. Enforced support read/update permissions on the API and admin page; denied unauthorized staff-view requests instead of silently returning a personal inbox. Ticket updates now include owner/scope conditions in the write query.
3. Added platform-organization checks to admin configuration, access, product, strategy, notification, email-test, and signal-moderation APIs.
4. Scoped live control-room, activity, orders, signals, data-explorer, and selected system-integrity metrics away from demo-owned records.
5. Restricted direct notifications and signal moderation to the actor's own demo/live scope.

## Blocking launch checks

- Review the currently paused live registration switch and the rest of global operations with a private real administrator.
- Complete Paystack merchant setup if Paystack is to be offered; run sandbox and merchant-authorized live payments for both gateways, reconcile callbacks and exactly-once credit grants, then test refund/chargeback and affiliate reversals.
- Configure a stable public HTTPS origin and Resend delivery webhook; validate actual verification, password-reset, and support-email delivery.
- Run authenticated end-to-end acceptance tests against a safe staging copy for every admin write flow and permission role, then a controlled live smoke test. This pass did not execute UI automation or mutate production records.
- Add production alerting, reconciliation jobs, backup/restore rehearsal, and incident response. The current system page is primarily configuration status, not service-health probing.
- Do not enable live exchange order placement or autopilot merely because their demo and configuration pages render; exchange execution, reconciliation, safety controls, and regulatory review remain incomplete.
