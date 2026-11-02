# User feature parity

For every future user-facing web change, review and update the native screen and `/api/mobile` contract in the same change. Admin and staff features remain web-only.

| Web user area | Native screen | Backend |
| --- | --- | --- |
| Account registration, login, password reset | `register`, `login`, `forgot` | `/api/mobile/auth/*`, selected existing auth APIs |
| Dashboard, market pulse | `home` | `/api/mobile/data?section=overview`, market overview |
| Research scanner, market/candle/strategy, history | `research` | existing scan APIs, mobile-owned history |
| Approval Desk, filters, unlock, exchange execution, history | `approval` | existing Approval API |
| Autopilot policy, arming, emergency stop, trades | `autopilot` | existing Autopilot API |
| Exchange credentials and balances | `exchanges` | existing exchange APIs |
| Forward paper scorecard and actual exchange P&L | `performance` | owner-scoped `/api/mobile/data?section=performance` |
| Credit balance and purchase history | `credits` | existing billing methods and mobile billing data |
| Notifications | `notifications` | existing notification API, Expo push |
| Affiliates and payout destination | `affiliates` | existing affiliate API |
| Support tickets | `support` | existing support API |
| Profile, email, research and notification preferences, password, sessions, data export/closure | `settings` | existing account APIs |
| Public help center | `help` | `/api/mobile/help` |

## Intentional difference

Native credit checkout is read-only until Apple/Google digital-goods in-app purchase products and verified server-side receipts are available. Web payment gateways are not routed through native checkout. This must be resolved before claiming full native commerce parity or distributing a paid-feature build.

The merchant does not yet have App Store Connect and Google Play Console purchase products configured. The mobile billing screen therefore presents the actual balance, activation price, and purchase history without an in-app purchase action. Push registration is implemented; delivery on physical devices still requires an EAS project ID and Apple/Google push credentials.
