# Product and business model for an AI crypto trade discovery SaaS

## What should the product sell, and when should credits be charged?

### Takeaway
Sell a clearly defined analysis outcome, not an implied profit. Start with prepaid, nontransferable in-app credits for user-initiated market scans and deeper trade theses; avoid charging repeatedly for cached results, failed jobs, or empty results unless the price page clearly defines a paid scan as the product.

### Cited Findings
- Stripe documents a credit-burndown model where a customer prepays, receives billing credits after the invoice is paid, and consumes them against metered usage. This demonstrates a supported billing pattern, but it does not establish that Stripe will approve this business. — [Stripe recurring pricing models](https://docs.stripe.com/billing/subscriptions/metered-billing/thresholds)
- Stripe says investment/brokerage services and other financial services are restricted and require contact/review; cryptocurrency businesses have limited availability. Its jurisdiction-specific list expressly prohibits, in Japan, consultation/advisory/prediction services offering guidance on profiting from trading or cryptocurrency. Seller-maintained stored value or credits may be subject to limits. — [Stripe restricted businesses](https://stripe.com/legal/restricted-businesses)
- Stripe says a completed Checkout session should be fulfilled through server-side events; relying on the success page alone is unreliable, and asynchronous payment events need handling. — [Stripe post-payment events](https://docs.stripe.com/payments/existing-customers?platform=web&ui=stripe-hosted)
- Stripe's API supports idempotency keys on create/update requests to make retries safe. — [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests)

### Inferences
- Proposed credit catalog: 1 credit for one on-demand market scan over a bounded symbol/timeframe set; 3 credits for a complete thesis with entry zone, invalidation, targets, time horizon, confidence calibration, assumptions, and risk/reward; 0 additional credits to reopen the same immutable report; premium batch scans priced by universe size before confirmation. These quantities are **illustrative**, to be calibrated against measured costs and willingness to pay.
- Settle purchases only from verified payment webhooks; use `(payment provider, payment event/transaction ID)` as a unique credit-grant key. An internal append-only ledger should record `purchase`, `promo`, `reservation`, `capture`, `release`, `refund`, `chargeback`, `expiry`, and `manual_adjustment` with actor, reason, timestamp, and idempotency key. Use a reservation before the AI job, capture exactly once when the promised report becomes available, release on failure/timeout, and show the balance and transaction history to users.
- Separate purchased and promotional balances. Define refund, chargeback, expiry, and credit transfer rules before sale; do not promise convertibility or resale. Consider defaulting to nonexpiring purchased credits until processor and legal review confirms an expiry policy.
- Processor approval is a launch gate. Do not assume that using credits makes a financial or crypto service eligible for a generic SaaS payments account.

### Gaps
- The company's legal entity, target countries, actual payment provider approval, tax treatment, and consumer-credit/expiry law are unknown.
- No credible demand or price elasticity data exists yet for the proposed credit quantities; validate with a pilot.

## How should unit economics and cost controls work?

### Takeaway
Price each credit against the *fully loaded* cost of producing and supporting a report, then cap both user spend and internal inference spend. The product needs an enforceable cost budget per job before promising unlimited scanning.

### Cited Findings
- Stripe's documentation supports credit burndown as a usage-priced pattern, including grants and expiry settings; these are billing mechanics, not a margin guarantee. — [Stripe recurring pricing models](https://docs.stripe.com/billing/subscriptions/metered-billing/thresholds)
- The CFTC warns that AI trading bots cannot predict sudden market changes and that guaranteed/high return claims are associated with fraud. — [CFTC AI trading bot advisory](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/AITradingBots.html)

### Inferences
- Calculate `contribution margin per report = collected net revenue allocated to report - payment fees - market data fees - AI tokens/tools - compute/queue - alert delivery - expected refunds/fraud - incremental support`. For a credit pack, use expected **redeemed** credits and redemption timing, while separately reporting unredeemed credit liability; avoid relying on breakage for healthy unit economics.
- Record actual cost by job, model version, provider, symbols, timeframe, token count, and retry count. Establish per-job token ceiling, daily spend ceiling, user rate limits, bounded market universes, cache TTLs, prefilters before AI calls, and retry caps. Trigger a circuit breaker if provider cost or data freshness breaches the budget.
- Start with a deterministic candidate screener, then pay for AI reasoning on a small shortlist. Meter a report only when it passes freshness and completeness checks. Show expected credit cost before starting; reserve the full maximum to avoid negative balances.
- Pilot metrics: cost per delivered report, gross margin by report type, retry/failure rate, median and p95 latency, credit purchase conversion, paid-user retention, credits redeemed per active user, chargeback/refund rate, and support tickets per 100 reports. Set numerical gates from pilot data rather than inventing targets.

### Gaps
- AI model/provider, data-feed contract, prices, cloud spend, payment fees, customer acquisition cost, and acceptable latency are unspecified; a financial model cannot responsibly assert fixed prices or margins yet.

## What roles, dashboards, and audit controls are needed?

### Takeaway
Use least-privilege roles and dual control for money-like credit changes and live trading controls. The dashboard should let staff resolve issues without silently rewriting signals, balances, or performance history.

### Cited Findings
- MiCA Article 81 requires EU crypto advice/portfolio management providers to assess suitability, inform clients about costs and risks, and provide suitability or periodic reports when those services apply. — [ESMA MiCA Article 81](https://www.esma.europa.eu/publications-and-data/interactive-single-rulebook/mica/article-81-providing-advice-crypto-assets)
- The SEC has flagged investment-adviser marketing deficiencies from unsubstantiated facts, omitted risks, and selective performance periods/results. Applicability depends on whether the firm is an adviser under US law. — [SEC marketing rule risk alert](https://www.sec.gov/compliance/risk-alerts/risk-alert-041724)

### Inferences
- Suggested roles: `user` (own credits/reports/connected exchange only), `support` (read scoped account and ticket status; initiate but not approve credit adjustment), `analyst` (review flagged signals/model evidence; no billing), `operations` (health, data feed and job retries; no content edits), `finance` (payments, refunds and ledger reconciliation), `compliance` (jurisdiction flags, disclosures, incident review), `admin` (policy/config and access), `owner` (break-glass and final approval). A small team can combine operational roles, but permissions remain separate.
- Dashboard sections: revenue/credit liabilities; purchases/refunds/chargebacks; credit ledger reconciliation; active jobs and inference cost; data-feed freshness; published and rejected signals; signal-cohort performance; exchange connector health; customer analytics and tickets; staff activity and audit events. Filter by country, cohort, model version, exchange, symbol, date, and report type.
- Record append-only audit events for staff logins, role changes, payment/credit mutations, model/prompt/config deployments, manually overridden signals, performance restatements, key connection changes, and kill-switch actions. Capture actor, before/after, reason, request ID, approval chain, and timestamp. Require second-person approval for large credit changes, signal suppression/restatement, and live trading limit changes.
- Give users their own event history: credit debits, report availability, methodology changes, and any changes to linked CEX access. Do not expose other users' portfolios to support agents without task-scoped access.

### Gaps
- Team size and exact staff workflow are unknown, so final RBAC matrix and approval thresholds require operator input.

## How should PnL, ROI, signal quality, and attribution be measured?

### Takeaway
Keep four records distinct: the published signal, paper-traded model result, a user's actual exchange fills, and the user's whole account performance. A forecast's outcome is not evidence that a user earned that return.

### Cited Findings
- Binance states spot and futures trade-history records include price, quantity, quote quantity and commission; futures records additionally include realized PnL, side and position side. Its trade API has historical retrieval limits, making timely import and durable reconciliation necessary. — [Binance trade history via API](https://www.binance.com/en/academy/articles/how-to-get-account-trade-history-via-api)
- Binance distinguishes realized PnL from unrealized PnL on open positions and incorporates fees/funding in its futures examples. — [Binance futures grid calculations](https://www.binance.com/en/support/faq/detail/f4c453bab89648beb722aa26634120c3)
- CFA Institute's GIPS overview discusses return methods and the treatment of external cash flows, expenses, and fees; time-weighted returns are intended to remove distortion from external cash-flow timing. — [CFA Institute GIPS overview](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/overview-of-the-global-investment-performance-standards)
- For registered advisers' advertisements, the SEC states gross and net returns must use comparable time periods and methodology; hypothetical results, including model/backtested results, have additional conditions. This is a useful transparency standard even where the rule is not legally applicable. — [SEC marketing compliance FAQ](https://www.sec.gov/rules-regulations/staff-guidance/division-investment-management-frequently-asked-questions/marketing-compliance-frequently-asked-questions); [SEC final marketing rule](https://www.sec.gov/files/rules/final/2020/ia-5653.pdf)

### Inferences
- **Immutable signal record:** signal ID, issuance timestamp/UTC, market-data snapshot ID and exchange, symbol/market type, timeframe, entry zone, invalidation/stop, target(s), max holding time, confidence and calibration bucket, model/prompt/strategy version, risk assumptions, fees/slippage assumptions, and a hash of the original report. Amendments create new versions with reasons; do not overwrite the original.
- **Signal scoreboard:** evaluate every published signal under a predetermined, replayable execution convention (entry trigger, order type, spread/slippage, maker/taker fees, partial fills, target/stop priority if both occur within a candle, stale-signal expiry, missing-data treatment). Include signals that never triggered, were skipped, failed, and lost. Compute closed-signal net return, max adverse/favorable excursion, win rate, expectancy, profit factor, drawdown, and median time to outcome by issuance cohort/model version. Track coverage and calibration of stated probabilities. Use out-of-sample forward results before calling anything a proven strategy.
- **User realized PnL:** derive from actual exchange fills using a declared cost-basis convention, matched quantities, converted fee currency, and funding where applicable. **Unrealized PnL:** mark open lots to a timestamped price source, with conversion and estimated close fees. **Net PnL:** realized + unrealized minus applicable trading/funding costs; show any data gaps or exchange corrections. Display a currency and period on every number.
- **User ROI:** `net PnL / explicitly named capital base`, with period and cash-flow treatment. For whole-account return, use time-weighted return across deposits/withdrawals; display money-weighted return separately if useful for the user's personal cash-flow experience. Never add individual trade ROI percentages to claim portfolio ROI.
- **Attribution:** mark trades as `bot-executed`, `signal-followed/manual`, `manual/unrelated`, or `unknown`. Use exchange order IDs/client order IDs for bot trades; a report click or user assertion is insufficient proof of causation. Show exchange-verified and self-reported data separately.
- **Benchmarks:** same-period BTC and ETH buy/hold (and optional cash/stablecoin baseline), same quote currency, fee assumptions, and starting date. Show the number of eligible signals and the drawdown beside returns. Report model cohorts as-of dates to prevent cherry-picking and survivorship bias.
- **Charts/reports:** account equity curve, realized/unrealized PnL timeline, drawdown, monthly return heatmap, asset exposure, fees/funding/slippage, per-signal cohort outcome, calibration, benchmark comparison, and downloadable CSV with methodology/version. Keep paper and live curves visibly distinct.

### Gaps
- Exchange, product scope (spot only vs futures), accounting method, reference currency, and price-feed license are not set; exact PnL methodology must be fixed before publication.
- No audited historical performance or user fills were provided; no win-rate or ROI claim is supportable now.

## What jurisdiction, marketing, security, and launch gates matter?

### Takeaway
The regulatory category changes sharply when a product moves from general market research to personalized recommendations or discretionary order execution. Prioritize a geographically scoped discovery MVP and obtain jurisdiction-specific counsel and payment approval before paid distribution or live execution.

### Cited Findings
- EU MiCA defines crypto advice as personalized recommendations to a client about crypto transactions/services and portfolio management as discretionary client-by-client management. Article 59 restricts the provision of crypto-asset services in the EU to authorized CASPs or qualifying financial entities. — [ESMA MiCA definitions](https://www.esma.europa.eu/publications-and-data/interactive-single-rulebook/mica/article-3-definitions); [ESMA MiCA authorization](https://www.esma.europa.eu/publications-and-data/interactive-single-rulebook/mica/article-59-authorisation)
- MiCA Article 81 imposes suitability, risk, cost, staff competence, and reporting requirements when crypto advice or portfolio management is provided. — [ESMA MiCA Article 81](https://www.esma.europa.eu/publications-and-data/interactive-single-rulebook/mica/article-81-providing-advice-crypto-assets)
- The UK FCA says cryptoasset promotions targeting UK consumers, including overseas firms' websites and apps, fall within the promotions regime; communications must use a lawful route and be fair, clear, and not misleading. Its registration page says a new cryptoasset regime starts 25 October 2027. — [FCA marketing UK consumers](https://www.fca.org.uk/firms/cryptoassets/marketing-uk-consumers); [FCA registration](https://www.fca.org.uk/firms/cryptoassets/how-apply-registration)
- The SEC's 2026 crypto guidance explains that cryptoasset status under federal securities law depends on the asset and transaction; SEC robo-adviser guidance covers algorithmic investment advice where Advisers Act applies. — [SEC crypto assets and federal securities laws](https://www.sec.gov/resources-small-businesses/capital-raising-building-blocks/crypto-assets-federal-securities-laws); [SEC robo-adviser guidance](https://www.sec.gov/investment/2017-02-robo-advisers)
- The CFTC specifically cautions against guaranteed returns in AI trading bot and crypto signal marketing. — [CFTC AI trading bot advisory](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/AITradingBots.html)
- Stripe categorizes relevant financial/crypto services as restricted and says approval is specific and may be revoked; its Japan list explicitly prohibits trading/crypto profit guidance. — [Stripe restricted businesses](https://stripe.com/legal/restricted-businesses)

### Inferences
- Treat legal review as a product-design input, not a footer disclaimer. Have counsel classify each planned mode for each launch jurisdiction: general research, personalized suggestions, **one-click user-approved execution**, auto-execution, copy trading, derivatives, custody, and marketing. Location of the company alone is insufficient; destination users matter.
- The user's target is a global service with country restrictions. Implement an allowlist of specifically reviewed countries, not a default worldwide launch: collect and verify country of residence and billing country, use IP/geolocation as a fraud signal, check exchange availability by country, block signup/purchase/key connection/execution where ineligible, and recheck at each order. Maintain versioned eligibility policy with reason and approval date; handle travel and residency changes. Obtain local advice for the first launch countries before enabling them.
- Until classification and permissions are resolved for a country, keep it blocked from purchase and execution. Avoid promises of profit and public claims based on backtests. A label such as “educational” does not itself settle the legal classification.
- If/when CEX keys are introduced: separate read-only analytics keys from trade-enabled keys; require explicit user activation and limits; prohibit withdrawal/transfer permissions; encrypt secrets using managed keys; never place keys in client-side code; audit every key access and order; add position/notional/loss limits and a global/user kill switch. These are design controls, not a statement that such access is legally authorized.
- Define launch gates: written jurisdiction assessment, processor approval, market-data redistribution rights, privacy/retention review, independent security test of auth/credits/key handling, methodology review, controlled paper pilot, and incident-response runbook.

### Gaps
- Entity domicile, user jurisdictions, asset list, derivatives availability, whether recommendations use personal data, and execution/custody model are unknown. No blanket license conclusion is possible. Morocco-specific rules were not verified from a primary regulator source in this research, so do not assert a Moroccan permission/prohibition.

## What phased roadmap and success criteria make sense?

### Takeaway
The first release must combine trade discovery with an explicitly user-confirmed CEX order. Run an internal research and paper pilot first; release one-click spot execution only in countries that have passed legal, processor, exchange, and security gates, then expand analytics and consider autonomous trading separately.

### Cited Findings
- The CFTC warns that AI cannot reliably predict sudden market changes and flags exaggerated return claims. — [CFTC AI trading bot advisory](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/AITradingBots.html)
- Binance trade-history records expose fill and fee data needed for reconciliation, while history windows impose collection constraints. — [Binance trade history via API](https://www.binance.com/en/academy/articles/how-to-get-account-trade-history-via-api)
- The EU regulatory definitions distinguish recommendations, discretionary management, and order execution as service types; this makes later stages materially different from general research. — [ESMA MiCA definitions](https://www.esma.europa.eu/publications-and-data/interactive-single-rulebook/mica/article-3-definitions)

### Inferences
- **Phase 0, validation and gates:** choose launch jurisdiction(s), legal classification, payment approval, a licensed market-data source, exchange/market type, and a fixed outcome methodology. Prototype a deterministic screener and AI explanation on historical data with no sales or return claims. Interview prospective users on report value and willingness to pay.
- **Phase 1, discovery plus one-click execution MVP (user clarified):** Next.js user/admin web app, MongoDB event/credit ledger, Auth.js/NextAuth authentication, one spot exchange's public market data and trade API, limited pairs/timeframes, on-demand scans, AI-written theses with deterministic risk checks, immutable reports, prepaid credits, payment reconciliation, staff RBAC, support/admin audit trail, and basic signal scoreboard. Users opt in to a trade-only CEX connection. Each proposed order displays exchange, side, pair, quantity/notional, order type, estimated fees, available balance, stop/exit assumptions, and data age; the user explicitly confirms that exact order. Recheck price, balance, pair rules, country eligibility, and risk caps immediately before submission; use an idempotent client order ID and reconcile order status/fills before showing success. Add kill switch and clear partial-fill/rejection handling. This phase is conditional on country-level classification, processor approval, exchange terms, and security review before paid launch.
- **Phase 2, evidence and retention:** paper portfolio, cohort backtests clearly labeled hypothetical, forward signal tracking, configurable alerts, benchmark/drawdown/fee-aware charts, user report library and downloads, cost dashboards, A/B model version comparisons. Require a meaningful out-of-sample track record and cost/quality gate before broad marketing.
- **Phase 3, expanded CEX analytics:** import all relevant fills, deposits and withdrawals from opt-in read-only scope or exchange-supported OAuth where available, reconcile personal realized/unrealized PnL and equity, fees and attribution, connector-health dashboards, and data export/deletion. Execution-phase fill import must exist in Phase 1; this phase adds whole-account accuracy and deeper reporting.
- **Phase 4, autonomous execution:** user-defined mandate and limits for ongoing trade decisions, and only after a separate jurisdiction/payment/exchange approval; stronger monitoring, circuit breakers, incident response, and paper-to-live rollout. Futures/leverage should be a later separately approved scope.
- Success gates: (a) every public signal is timestamped and outcome-accounted; (b) no unexplained credit-balance divergence; (c) jobs meet freshness and delivery SLOs; (d) signal results are net of declared costs and beat an appropriate benchmark over predeclared forward windows before making efficacy claims; (e) unit margin remains positive after all variable costs; (f) repeat paid use and low complaint/refund rates demonstrate customer value. Set numeric thresholds in the pilot and publish them internally before observing the evaluation cohort.

### Gaps
- Project staffing, capital budget, desired launch date, first allowed countries, launch exchange and assets are unspecified; timeline estimates would be speculative. One-click execution at MVP is now a stated requirement; autonomous execution remains a later possibility.
