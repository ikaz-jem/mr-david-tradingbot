# Reusable Strategy Catalog Architecture and Governance

## Should administrators or end users create strategies first, and why?

### Takeaway
Launch with an administrator-curated catalog of immutable, versioned templates. Users should initially select `AI decides` or a published template and adjust only bounded parameters; user-created strategies should come later as paper-only, reviewable rule documents—not prompts or executable code.

### Cited Findings
- Freqtrade separates templates from backtesting, optimization, dry/forward testing, live, and AI modes and recommends dry mode before risking capital. — [Freqtrade strategy customization](https://docs.freqtrade.io/en/latest/strategy-customization/)
- Freqtrade says public strategies are learning material, not automatically production-ready, and should be backtested for the relevant exchange/pairs and then dry-run. — [Freqtrade strategy customization](https://docs.freqtrade.io/en/latest/strategy-customization/)
- TradingView supports typed strategy inputs with defaults, options, bounds, and types including integer, float, boolean, string, enum, symbol, and timeframe, so a user can adapt a script without editing source. — [TradingView inputs](https://www.tradingview.com/pine-script-docs/concepts/inputs/)
- QuantConnect keeps parameters outside algorithm code and injects them into backtests, live deployments, and optimization jobs. — [QuantConnect parameters](https://www.quantconnect.com/docs/v2/writing-algorithms/optimization/parameters)
- OpenAI recommends keeping user content out of higher-authority developer instructions and using extracted fields, validated JSON/enums, confirmations, guardrails, and least privilege. — [OpenAI agent safety](https://developers.openai.com/api/docs/guides/agent-builder-safety)
- The CFTC warns that AI cannot predict future or sudden market changes and cautions against bots and signal services advertised with unreasonable or guaranteed returns. — [CFTC AI trading-bot advisory](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/AITradingBots.html)

### Inferences
- Admins should create, review, publish, pause, deprecate, and revoke catalog templates. Users may save presets containing only server-validated overrides marked `userAdjustable`.
- Admin CRUD should be lifecycle operations (`create draft`, `clone version`, `validate`, `publish`, `pause`, `deprecate`), not in-place edits to a published object. Once used by a scan, approval, or order, a version should only be soft-deleted.
- Do not treat a free-text prompt as a strategy. Descriptions can explain intent, but executable behavior must compile from a typed rule document; never concatenate descriptions into privileged AI instructions.
- Safe customization ladder: curated templates → bounded user presets → private no-code composites in research/paper mode → reviewed approval-desk eligibility → separately authorized live/autopilot use.
- Do not allow user JavaScript, Python, Pine, Mongo expressions, arbitrary URLs, or prompt fragments. A user preset references an immutable strategy version plus validated values.
- This is preferable at launch because the present product has a scanner but not yet a mature bias analyzer, reproducible backtester, paper observation system, or strategy review queue.

### Gaps
- Sources establish prudent engineering patterns but not which Nigerian or destination-country licensing, advisory, derivatives, marketing, or suitability rules govern Enrivea. Counsel must map each product mode and country before execution release.
- There is no universally accepted deterministic definition of branded/discretionary methods such as ICT or Elliott Wave. Each entry should disclose Enrivea's exact interpretation and sources rather than imply endorsement or an official implementation.

## What structured fields and deterministic rule types are needed so strategies are reusable rather than arbitrary prompts?

### Takeaway
Use an immutable definition version with typed indicators, rule trees, parameter schema, data requirements, risk/invalidation policy, product permissions, and release state. AI may rank eligible strategies and explain outcomes; deterministic services must compute evidence, enforce risk, and control execution.

### Cited Findings
- TradingView strategies model long/short entries, orders, cancellations, exits, sizing, leverage, commissions, slippage, and other execution properties; entry logic alone is not a complete strategy. — [TradingView strategies](https://www.tradingview.com/pine-script-docs/concepts/strategies/)
- Published TradingView reports preserve date range, symbol, timeframe, inputs, initial capital, size, leverage, pyramiding, commission, and slippage. — [TradingView strategies](https://www.tradingview.com/pine-script-docs/concepts/strategies/)
- Binance Spot klines are identified by open time and provide symbol/timeframe OHLCV across intervals from seconds through months, with request weight. — [Binance Spot market data](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints)
- Binance enforces symbol price, quantity, step-size, and notional filters, so a valid signal may still be impossible to execute. — [Binance Spot filters](https://developers.binance.com/docs/binance-spot-api-docs/filters)
- OpenAI Structured Outputs constrains responses to a developer JSON Schema; its safety guidance recommends fixed schemas/enums to reduce free-form injection channels. — [Structured Outputs](https://openai.com/index/introducing-structured-outputs-in-the-api/); [agent safety](https://developers.openai.com/api/docs/guides/agent-builder-safety)

### Inferences
- **Entities:** `Strategy` (stable identity/metadata/source); immutable `StrategyVersion` (semantic version, schema version, content hash, lifecycle, reviewers); `StrategyPreset` (user/version/overrides); `StrategyAssignment` (product selection or `AI_AUTO`); `StrategyEvaluation` (evidence, trace, AI output, cache provenance); and `StrategyRelease` (product, market, country/cohort, paper/live, rollout, kill switch).
- **Definition fields:** name, method family, directions, market types, symbol universe, timeframes, required bars/feeds, indicator graph, entry/exit/invalidation rules, risk policy, parameter schema, explanation rubric, product capabilities, validation summary, attribution, limitations, change log, creator/reviewer/approver and timestamps.
- **Typed indicators:** SMA/EMA, RSI, MACD, ATR, ADX, Bollinger bands, rolling high/low, volume/relative volume, VWAP only where supported, change, and swing/pivot structures with explicit confirmation delay. Multi-timeframe data must align to closed candles.
- **Rule DSL:** `GT/GTE/LT/LTE/BETWEEN`, crossover/crossunder, rising/falling, breakout/breakdown of prior closed ranges, percent/ATR distance, `WITHIN_CLOSED_BARS`, `TRUE_FOR_N_BARS`, `ALL/ANY/NOT`, deterministic scoring, and mutually exclusive long/short outcomes. Operands may reference only allow-listed features or typed parameters.
- **Risk/invalidation:** minimum risk/reward, maximum stop distance, ATR stop/target, maximum age, candle-close requirement, invalidation condition/price, spread/slippage assumptions, exposure/open-position limits, cooldown, and product permission. Execution additionally validates live Binance filters and balances.
- Treat ICT/Elliott entries as named Enrivea interpretations made of deterministic primitives. An Elliott template must define pivot algorithm, ratios, confirmation and invalidation. An ICT template must define liquidity sweep, displacement, imbalance, session, structure, confirmation and invalidation. A label alone is not executable.
- **`AI_AUTO`:** evaluate every published version eligible for product/symbol/timeframe/direction/data. Deterministic scoring supplies candidates; AI ranks/explains them using a strict schema. Risk policy remains authoritative; no eligible candidate yields `NO_SETUP`. AI does not invent a method.
- **Cross-product reuse:** one evaluator emits a normalized `TradeProposal`. Scanner displays it; approval desk adds expiry and confirmation; autopilot requires a live-approved release, account risk envelope, exchange validation and execution permission.
- Cache keys must include strategy version/hash, parameters, symbol, timeframe, last closed candle, evidence hash, risk-policy version, and AI policy/model version.

### Gaps
- Binance Spot OHLCV cannot reliably support methods requiring historical order book, liquidations, derivatives funding/open interest, cross-exchange flow, macro/news, or tick sequence. Templates must declare requirements and be unavailable without them.
- Commercial/personality-linked strategy names and source material need legal/brand review; do not claim an official implementation or reproduce proprietary paid content.

## How should templates, parameters, backtests, paper trading, and live execution be separated?

### Takeaway
Use a gated lifecycle: draft template → validated immutable version → reproducible backtest → held-out test → paper/forward test → approval-desk eligibility → separate live/autopilot authorization. Historical results must never automatically grant execution rights.

### Cited Findings
- QuantConnect defines backtesting as historical simulation and notes past performance does not guarantee future results. — [QuantConnect backtesting](https://www.quantconnect.com/docs/v2/cloud-platform/backtesting/getting-started)
- QuantConnect defines paper trading as live real-time data with fictional capital and separates it from brokerage deployment. — [QuantConnect paper trading](https://www.quantconnect.com/docs/v1/live-trading/paper-trading)
- Alpaca says paper orders are not routed to exchanges, fills are simulated from real-time quotes, and results can differ from live markets. — [Alpaca paper versus live](https://alpaca.markets/support/difference-paper-live-trading)
- Freqtrade says forward tests are more realistic than backtests but still differ because backtests may assume fills while dry-run timing, prices, ROI, stops and exits differ. — [Freqtrade strategy quickstart](https://www.freqtrade.io/en/stable/strategy-101/)
- TradingView recommends historical and real-time validation and notes liquidity, costs and slippage affect performance; neither past nor present guarantees future results. — [TradingView strategies](https://www.tradingview.com/pine-script-docs/concepts/strategies/)

### Inferences
- States: `DRAFT → SCHEMA_VALID → BACKTESTED → OOS_VALIDATED → PAPER → REVIEW → PUBLISHED_RESEARCH → PUBLISHED_APPROVAL → LIVE_CANARY → LIVE`, plus `PAUSED`, `FAILED_VALIDATION`, `DEPRECATED`, `REVOKED`.
- Promotion is a signed review decision storing validator versions, dataset windows, assets/timeframes, fee/slippage assumptions, metrics, reviewer and date; win rate or AI confidence alone cannot promote a strategy.
- Snapshot content hash, parameters, data source, exact dates, last candle, fees/slippage, capital, simulator version and trades. Never blend backtest, paper and live metrics.
- Validation suite: schema/bounds; warm-up sufficiency; closed-candle/timeframe alignment; long/short/invalidation tests; collision detection; look-ahead/recursive checks; in-sample vs held-out/OOS; diverse assets/regimes/timeframes; cost sensitivity; paper observation period and trade sample.
- Scanner accepts research-published versions. Approval requires expiration/invalidation and supported venue. Autopilot additionally requires live release, risk controls, connection health, kill switches, notional/drawdown limits, idempotency, and reconciliation. Futures/short execution remains a distinct phase.
- Admin UX should separate backtest/paper/live tabs and show version, failures, permissions, active presets/users, rollout, pause and rollback. Editing published content clones a draft.
- User UX should distinguish template vs preset and show version, inputs, assumptions, markets/timeframes, validation date, limitations and performance class.

### Gaps
- There is no universal minimum backtest duration, regime count, paper duration or trade count; Enrivea needs risk-tiered internal promotion criteria reviewed before live release.
- The five-minute scan cache is not a backtester. Execution-grade validation needs an event-driven simulator for fees, slippage, rejection, partial fills, latency and exchange filters.

## What guardrails prevent prompt injection, impossible configurations, look-ahead bias, and misleading performance claims?

### Takeaway
Put AI inside a deterministic safety envelope: structured I/O, no arbitrary instructions, static and historical validation, immutable evidence, exchange checks, staged release, audit logs, and conspicuous separation of simulated and live results. Approval remains human-confirmed; autopilot requires independent execution authorization.

### Cited Findings
- OpenAI recommends structured outputs, field extraction, confirmations, input guardrails, least privilege, trace graders and evals, and warns against placing untrusted content in developer messages. — [OpenAI agent safety](https://developers.openai.com/api/docs/guides/agent-builder-safety)
- Freqtrade identifies negative shifts, absolute dataframe indexes, whole-column means, incorrect resampling and unsafe timeframe merges as future-data leakage, and recommends lookahead and recursive analyses. — [Freqtrade customization](https://docs.freqtrade.io/en/latest/strategy-customization/)
- TradingView identifies look-ahead bias, selection bias and overfitting and recommends diverse datasets plus in-sample/out-of-sample separation. — [TradingView strategies](https://www.tradingview.com/pine-script-docs/concepts/strategies/)
- QuantConnect says optimizing and retesting the same period introduces look-ahead bias and recommends held-out recent data or walk-forward optimization. — [QuantConnect parameters](https://www.quantconnect.com/docs/v2/writing-algorithms/optimization/parameters)
- The CFTC says hypothetical results may over/underestimate performance, fail to reflect liquidity and must not be represented as actual; no trading system can guarantee profit. — [CFTC trading-system advisory](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/fraudadv_tradingsystem.html)
- Binance imposes price, quantity, step-size and notional rules that executable proposals must satisfy. — [Binance Spot filters](https://developers.binance.com/docs/binance-spot-api-docs/filters)

### Inferences
- **Injection:** build AI context only from server-computed numeric evidence and allow-listed fields; put data at lower authority; strict enum/schema output; reject unknown fields; cap strings; no order tool in research calls; validate before storing or acting.
- **Impossible configurations:** check type/min/max/step, cross-field constraints, lookback, timeframe/direction/product/feed support, nonzero stop, correct target direction, risk/reward, filters, and collisions. Refuse publication/execution with field errors.
- **Bias:** closed candles only; explicit as-of timestamps; no negative offsets; causal rolling windows; delayed pivot confirmation; right-aligned higher-timeframe joins; deterministic warm-up; immutable run data; OOS/walk-forward and parameter-sensitivity tests; avoid cherry-picking assets/timeframes.
- **Claims:** keep simulated, paper and live metrics separate; disclose dates, sample size, costs, universe, version and net/gross basis; show risk/hypothetical language beside results; prohibit “guaranteed”/“safe profit”; never present AI confidence as probability of profit.
- **Audit:** append-only create/edit/validate/review/publish/select/evaluate/approve/reject/execute/pause events; snapshot version/hash, parameters, evidence/as-of times, rule trace, AI response ID/schema version, cache source, actor, result and overrides. Never log secrets/API keys.
- **Rollout:** product/cohort flags, research default, paper canary, reviewer separation, notional/loss/drawdown/rate limits, health checks, global/strategy/exchange/user kill switches, automatic pauses for stale data, reconciliation mismatch, rejection/slippage or validation drift, and immutable rollback.
- AI evidence confidence means confidence in the classification—including `NO_SETUP`—not win probability. Backtest, paper and live hit rates are separate metrics.

### Gaps
- CFTC guidance is investor-protection evidence, not proof its rules govern every Enrivea user. Counsel must define jurisdiction-specific disclosures and restrictions.
- Market-data redistribution, strategy-name trademark issues, and whether shared cached analysis is regulated advice in each country require separate legal review.
