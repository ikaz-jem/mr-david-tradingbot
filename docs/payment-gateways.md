# Payment gateway setup

## Administration

Platform controls → Payments (`/admin/controls/payments`) requires platform `settings:read`; saves require `settings:update` and an audit reason. Secret values are encrypted and never returned to the browser. Each save creates a configuration revision so outstanding payments can settle using their original credentials.

Demo administrators configure a separate demo scope. Simulation requires no keys and grants only demo credits. Provider sandbox mode needs actual provider sandbox credentials. Real administrators configure live payments; live methods start disabled.

## Paystack

Enter the appropriate secret key, merchant-supported currency, and the settlement currency amount per USD. Catalog prices are stored in USD minor units; checkout freezes the converted amount and credit grant. The exchange rate is manually maintained, not a live FX feed.

Configure the provider webhook as `https://YOUR_DOMAIN/api/webhooks/paystack-live`. Merchant approval and availability must be confirmed with Paystack before enabling live checkout.

## Crypto

The integration uses NOWPayments, not a self-hosted wallet processor. Set the receiving/settlement wallet in NOWPayments and enter its API key and IPN secret in platform controls. The selector lists the intersection of merchant-selected coins, available currencies for the current payout setup, and enabled payment assets. Names and networks come from the provider catalog; memo/tag values are shown when returned. The catalog is cached for five minutes.

Set the callback to `https://YOUR_DOMAIN/api/webhooks/nowpayments`. Checkout obtains a per-payment address and quoted amount. Only independently verified, fully settled payments grant credits. Partial or mismatched payments require review. No wallet private key belongs in this application.

## Deployment and settlement

- Configure a public HTTPS `APP_URL`, MongoDB transaction support, and the existing service-secret encryption key. Back up that key securely; do not rotate it without migrating encrypted credentials.
- Disabling a gateway blocks new checkouts, not settlement of already-created invoices.
- Activation grants access and starting credits; refills require an activated account.
- Credits, the purchase receipt, and first-purchase affiliate commission commit in one database transaction. Repeated provider events do not grant credits twice.
- Payment methods share the first-purchase affiliate rule: switching gateways does not create another first-purchase commission.
- Refunds, chargebacks, affiliate reversals, failed notification retries, and recovery of interrupted initialization require operational reconciliation; automated refunds are not implemented.
- Do not remove/revoke old provider credentials while invoices using them are outstanding without reconciling those invoices first.

## Dashboard checklist

1. In NOWPayments Settings → Payments, configure and verify your payout wallet and network.
2. Select accepted currencies in Coins settings. The app only shows currently available selected assets.
3. Set USD as the base currency. Keep live credentials in the real admin gateway configuration, never the demo sandbox scope.
4. Configure the full HTTPS callback URL under Instant payment notifications and keep ngrok online during testing. New API payment requests also send the callback explicitly.
5. Use NOWPayments Payments history to match order reference and payment ID with our Admin → Billing records. Settlement must be finished before credits are granted.
6. For Paystack, activate the merchant account, enter its live secret key in the real admin scope, configure settlement currency/FX rate, and set `/api/webhooks/paystack-live` on the same public origin.

Check saved credentials verifies API access, not signed callbacks or settlement. Rotate credentials shared in chat and perform a small merchant-authorized live payment and reconciliation before launch.

## Verification

`npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` cover the local checks. `node scripts/smoke-payments.mjs` tests demo checkout, permissions, enabled switches, and exactly-once grants against the local server. It creates sample demo refill receipts and restores gateway settings afterward.

`scripts/test-payment-engine.mjs` uses a uniquely named temporary database and mocked provider responses to test signed webhooks, partial payments, activation, refills, and cross-gateway affiliate eligibility. It does not prove connectivity to a merchant account. Complete actual provider sandbox tests, then a merchant-authorized live reconciliation test before accepting customer funds.
