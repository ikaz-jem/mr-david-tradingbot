# Feasibility and technical architecture

## Can the requested core stack deliver the product?

### Takeaway
Yes for a signal discovery SaaS with user-confirmed, one-click CEX execution, account management, credits, and analytics. Next.js, MongoDB, Auth.js, and an AI API can be the application core. External exchange market-data/trading APIs and an AI provider are still needed; payment processing is needed to sell credits. Continuous market monitoring and order reconciliation additionally need a reliable scheduler/worker runtime, whether deployed from the same TypeScript codebase or hosted separately.

### Cited Findings
- Next.js Route Handlers provide public HTTP endpoints and can call data sources or perform side effects. Its documentation explicitly says the backend-for-frontend capability is not a full backend replacement; in serverless deployments long-running handlers may be terminated, requests do not share memory, and WebSockets are unsuitable. — [Next.js backend guide](https://nextjs.org/docs/app/guides/backend-for-frontend)
- Auth.js provides an official MongoDB adapter; its Next.js example uses `MongoDBAdapter` with a MongoDB client. — [Auth.js MongoDB adapter](https://authjs.dev/getting-started/adapters/mongodb)
- Auth.js documents both JWT and database role persistence and says the application determines user roles. — [Auth.js RBAC guide](https://authjs.dev/guides/role-based-access-control)
- Binance Spot exposes public market data (`NONE`) separately from signed `TRADE` and `USER_DATA` permissions. Public-only data may use `data-api.binance.vision`. — [Binance Spot REST overview](https://developers.binance.com/en/docs/products/spot/rest-api)
- Coinbase Advanced Trade provides REST trading/order management and WebSocket real-time market data. — [Coinbase Advanced Trade overview](https://docs.cdp.coinbase.com/advanced-trade/docs/ws-overview/)
- Current local repository inspection (2026-09-24) found only `reports/` and `research_notes/`; there is no app or `package.json` yet. — [local project root](D:/development/mr%20david/mothercompany/enriveatradingbot)

### Inferences
- Scope the MVP as public-market signal discovery plus opt-in user-confirmed spot execution. Discovery needs no customer exchange keys and can share each candle ingestion and model run across subscribers, with a per-user credit ledger for generation/consumption. One-click execution needs users to connect a CEX key with trading permission and whatever account/order-read permission that exchange requires for reconciliation, without withdrawal/transfer permission; account analytics also needs account-read access. Support explicit country/exchange eligibility restrictions for a global launch.
- “Only Next.js” can mean one TypeScript repository and one product UI/API. It cannot mean no exchange API, payment service, AI inference service, reliable scheduler, or production hosting. A self-hosted Node process can run the Next.js server plus a separate worker from the same repository; on Vercel, scheduled functions or an external worker become operational dependencies.

### Gaps
- No deployment target, exchange, jurisdiction, payment provider, signal timeframe, or desired execution autonomy was specified. Those choices affect architecture and legal review.

## How should market data and AI signals work?

### Takeaway
Build deterministic data and risk stages around a versioned AI scoring/explanation stage. Preserve exact data, model, prompt, and strategy versions for every signal so claims can be evaluated against later outcomes.

### Cited Findings
- Binance Spot publishes OHLCV candlestick data at `GET /api/v3/klines`; bars are identified by opening time, are paginated with `startTime`/`endTime`, and currently have a maximum `limit` of 1000 per request. The same official specification documents test-order and order endpoints. — [Binance Spot API specification](https://github.com/binance/binance-spot-api-docs/blob/master/rest-api.md)
- Binance documents limits for request weight and order count; 429 requires backoff, repeated violations can trigger 418 bans, and IP weight is shared across keys using that IP. — [Binance Spot REST overview](https://developers.binance.com/en/docs/products/spot/rest-api)
- MongoDB time-series collections optimize storage/querying of timestamped measurements; they do not support unique indexes or change streams. — [MongoDB time-series collections](https://www.mongodb.com/docs/v8.0/core/timeseries-collections/), [time-series indexes](https://www.mongodb.com/docs/manual/core/timeseries/timeseries-index/), [change streams](https://www.mongodb.com/docs/manual/changestreams/)
- The repository currently has no running application or existing market-data schema to migrate. — [local project root](D:/development/mr%20david/mothercompany/enriveatradingbot)

### Inferences
- Ingest closed candles by exchange/symbol/interval/open-time; reject incomplete candles, gaps, out-of-order bars, and symbols with insufficient history. For manageable initial volume, an ordinary MongoDB `candles` collection with a compound unique index is simpler and gives hard duplicate prevention. Use time-series storage later if volume justifies its unique-index limitations.
- Pipeline: exchange candle ingest → deterministic universe/liquidity filters → feature computation → candidate strategies → AI structured assessment with rationale/uncertainty → deterministic validation and sizing limits → signal record. AI should not be the sole source of prices or the sole risk gate. If the model fails or data is stale, skip the signal.
- Save `signalId`, exchange/symbol/timeframe, candle cutoff, entry/stop/target/expiry assumptions, fees/slippage assumptions, strategy version, model identifier, prompt hash, confidence as a calibrated internal score, cost, and status. Show users that model confidence is not a probability of profit until validated.
- Historical backtests must use only information available at each candle cutoff, account for maker/taker fees, spread/slippage, latency, delistings, and order constraints; use chronological out-of-sample and walk-forward evaluation. Paper trading should use a simulated fill engine and report simulated returns separately from executed returns.

### Gaps
- No sourced evidence currently establishes a profitable signal model; viability of trading performance remains an empirical research question. Exchange historical depth, symbol availability, and data redistribution rights require review for the selected exchange.

## What changes for live CEX execution and robust operation?

### Takeaway
User-confirmed, one-click execution is feasible while user funds stay on their CEX account, but it raises reliability and security requirements substantially. The order click should be a deliberate, authenticated action after a current order preview; execution status must come from the exchange.

### Cited Findings
- Binance distinguishes `TRADE` from `USER_DATA` API-key scopes and says keys are sensitive; trading must be explicitly enabled for a key. — [Binance Spot REST overview](https://developers.binance.com/en/docs/products/spot/rest-api)
- Binance says a timeout can leave execution status unknown; it instructs clients to check the User Data Stream or query order status before assuming failure. — [Binance Spot REST overview](https://developers.binance.com/en/docs/products/spot/rest-api)
- Binance supports a caller-defined `newClientOrderId` and returning `clientOrderId`, enabling application-side tracking and reconciliation. — [Binance Spot glossary](https://developers.binance.com/en/docs/products/spot/faqs/spot_glossary)
- Vercel cron invokes functions; its cron documentation says failed invocations are not retried, executions can overlap or duplicate, and idempotency plus locking is needed. Hobby cron runs at most daily; Pro/Enterprise allow minute schedules. — [Vercel cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- MongoDB provides single-document atomic updates and multi-document transactions on replica sets/sharded clusters. — [MongoDB atomicity](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/)

### Inferences
- Use the minimum exchange permissions for each capability, ideally separate read-only and trade-enabled connections, with no withdrawal/transfer rights. Use encryption at rest for exchange secrets with a dedicated managed key, server-side decryption only, key rotation/revocation, audit logs, per-user circuit breakers, daily loss and size caps, exchange symbol/precision filters, and an emergency kill switch.
- On the one-click path, show the current price, order type, quantity/notional, estimated fees, available balance, exchange, and a stale-quote warning. Require an explicit user click and server-side eligibility/permission/risk check; then reserve an order intent with a unique operation ID in MongoDB. Submit a stable `clientOrderId`; on ambiguous failure, reconcile exchange order status rather than blindly resubmit. Store fills and fees from exchange events and periodically compare them with REST account/order history. Disable the click for stale/expired signals or unavailable exchange connectivity.
- Use a MongoDB-backed job/outbox collection with claim leases, attempt counters, idempotency keys, expiry, and dead-letter status for a minimal stack. A cron endpoint may claim bounded batches for low-frequency signals. Continuous WebSocket streaming, sub-minute response, and high account volume warrant a dedicated Node worker runtime; Vercel Functions cannot serve as a persistent WebSocket client/server reliably.
- Rate-limit by exchange IP/account and user, cache and fan out public market data, back off on 429, and disable execution on stale data or unreconciled orders. This is essential before multi-exchange rollout.

### Gaps
- Specific spot/futures and exchange choices are unknown. Futures add leverage, liquidation, funding, margin modes, and larger safety/legal surface; recommend spot first.
- Cloud KMS, static egress IP, scheduler, incident alerting, and exchange account-permission details depend on the hosting/exchange selections.

## What is the recommended implementation path?

### Takeaway
The first release can pair signal discovery with user-confirmed, one-click spot orders, credits, and a complete audit trail. A separate paper mode and verifiable forward tracking are still needed to establish the signal engine's performance claims.

### Cited Findings
- Auth.js supports database-backed user roles for application RBAC. — [Auth.js RBAC guide](https://authjs.dev/guides/role-based-access-control)
- Next.js advises checking authorization in protected resources and validating all incoming request data, rather than relying solely on a proxy layer. — [Next.js backend guide](https://nextjs.org/docs/app/guides/backend-for-frontend)
- MongoDB single-document operations are atomic, and transactions support multi-document consistency when needed. — [MongoDB atomicity](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/)

### Inferences
- Phase 0: define first CEX, spot markets, country restrictions, timeframes, signal semantics, evaluation benchmark, product claims, and payment/jurisdiction choices. Phase 1: Next.js UI/API, Auth.js+MongoDB, staff/admin permissions, market-data pipeline, signal engine, immutable credit ledger, purchase webhooks, signal and outcome dashboards, exchange connection, and explicit user-confirmed one-click spot execution with reconciliation. Phase 2: backtest and paper-trade engine with reproducible assumptions and forward-tracked model quality; this should be implemented during Phase 1 development if possible so signal quality can be tested before launch. Phase 3: richer account sync for exact balances/fills and account ROI/P&L, then more exchanges and automation only after robust operating evidence.
- Keep three result categories separate in the UI: hypothetical backtest, paper simulation, and verified exchange fills. ROI/P&L are undefined for an unexecuted signal unless the product declares a simulation assumption. For signals, report signal hit rates and forward outcomes with fee/slippage assumptions; for connected accounts, calculate realized/unrealized P&L, net deposits/withdrawals, fees, and time-weighted or money-weighted returns explicitly.
- Credits need an append-only ledger (`purchase`, `reserve`, `consume`, `refund`, `adjustment`) and idempotent payment webhook processing. Reserve before costly AI work; consume on a delivered result, refund on failure. Admin/staff actions should be permission-scoped and audited.

### Gaps
- Need product decision on whether users purchase one-off AI searches, subscribe to continuously generated alerts, or pay for each delivered signal. This changes job scheduling and credit charging.
