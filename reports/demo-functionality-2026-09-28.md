# Demo functionality revision

## Fixed

- Profile/password buttons now explicitly submit their forms. Demo display names save to MongoDB and refresh session names.
- Demo password changes persist an isolated hash; the published sample password remains accepted so shared visitors cannot lock out the showcase. No real password or session is changed.
- New product IDs remain editable until the product has actually been saved.
- Admins can edit customer display names with an audit reason. Access controls still protect the public entry accounts.
- Demo billing supports audited scanner-credit adjustments and membership extensions, with balance validation and optimistic concurrency.
- Email tests write to a separate simulated outbox, never Resend.
- Demo scans now appear in scan activity. Outcome refresh creates idempotent synthetic results. Demo research moderation and activity pages use demo-scoped records.
- Same-origin validation accepts exact configured application and Vercel deployment URLs without trusting incoming host headers.

## Verification

- Production build, ESLint, and 24 unit tests passed.
- `scripts/smoke-demo-editing.mjs`: actual profile/password/product/model-setting clicks, reload persistence, billing changes, email outbox, synthetic outcomes, moderation, and activity.
- `scripts/smoke-upgrade.mjs`: renewal, top-ups, expiry, idempotency, support privacy, resolution, exchanges, desktop/mobile rendering.
- `scripts/smoke-admin-users.mjs`: bans, suspension, role changes, session revocation, protected logins, and audited read-only customer preview.

Run browser checks against a running app with MongoDB using `TEST_BASE_URL` and `node --env-file=.env.local scripts/<script>.mjs`. Tests create clearly labeled sample activity and restore edited profile/model/announcement values. Never run them against real customer credentials.

## Explicit boundaries

This is an interactive shared demo, not production financial execution. Other visitors can see demo edits. Do not enter private information or real provider keys. Payments, exchange connections, market prices, outcomes, and delivery tests remain simulated. Email-address changes need a verified change workflow. Customer impersonation remains read-only. Live-only system/data/order administration and unfinished future-product executors remain unavailable; this revision does not claim those features are complete. Deployment to Vercel is still required to publish these local changes.
