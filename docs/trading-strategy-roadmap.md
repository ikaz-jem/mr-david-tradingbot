# Trading strategy roadmap

## Goal

Add reproducible, versioned strategy engines that produce candidate trades from closed candles. Treat published research as a hypothesis to test, not a claim of a high win rate or guaranteed return. AI may explain or veto an eligible candidate; it must not invent eligibility, prices, exits, or historical performance.

## Current baseline

- The scanner supports trend breakout, momentum continuation, mean reversion, and experimental ICT-style and Elliott-style heuristics. The AI router ranks the nonexperimental eligible engines.
- Research uses 100 closed Binance Spot candles, even when a resulting idea could later be executed on Futures. Test whether that source matches the intended Futures venue and contract before any automation decision.
- Both candle and eligible AI decisions are shared by market, timeframe, strategy version, and closed-candle facts through MongoDB cache records. They expire after five minutes. Candle entries are also rechecked against the next expected close, with a two-minute provider-publication grace period. Same-process requests share an in-flight promise; separate serverless workers can still duplicate an AI call.
- A failed deterministic entry check now returns named failed checks without calling the AI provider. No-setup results have no confidence gauge.

## Candidate sequence

| Priority | Engine | Initial rules | Products | Why test it |
| --- | --- | --- | --- | --- |
| 1 | Time-series momentum | Positive or negative trailing return with a trend and volatility filter; ATR-based invalidation. Start on 4h and 1d. | Research, then Approval Desk | Published time-series momentum evidence exists across futures; recent cryptocurrency work reports stronger time-series than cross-sectional momentum after realistic constraints. Validate on our own universe before rollout. |
| 2 | Donchian breakout | Closed-candle 20/55-bar breakout, trend alignment, volume/liquidity gate, ATR stop, explicit expiry. Compare with current breakout engine. | Research, then Approval Desk | Fully specified and directly testable with current OHLCV input. |
| 3 | Regime-gated mean reversion | Band extension plus RSI exhaustion only in a measured range regime; stop beyond the excursion and target toward the mean. | Research | Current engine lacks an explicit range-regime filter. Avoid routing it into Autopilot until it survives out-of-sample testing. |
| 4 | Volatility compression breakout | Falling realized volatility followed by a directional expansion and liquidity confirmation. | Research | Can complement trend breakout, but requires an independent test and duplicate-signal control. |
| Later | Funding/basis carry | Position and hedge rules using venue funding history, mark/index basis, fees, and liquidation margin. | Separate product | Requires data and execution capabilities beyond the current closed-candle scanner. |

Keep ICT-style and Elliott-style engines labeled experimental. Their current code is a bounded OHLCV heuristic, not objective proof of institutional behavior or an authoritative wave count. Do not enable either for Autopilot without separately specified rules and validation.

## Evaluation and release gates

1. Publish an immutable rule specification per engine and version: input fields, supported pair/timeframe, side, entry, stop, target, expiry, and every disqualifying condition. Admins can enable a tested version per product; changes create a new version and invalidate decision caches.
2. Build point-in-time backtests from venue-specific closed candles. Include delistings where relevant, maker/taker fees, spread, slippage, funding, liquidation, partial fills, and latency. Avoid selecting thresholds from the final test period.
3. Compare walk-forward and untouched holdout periods with buy-and-hold, always-flat, and the existing scanner baseline. Report trade count, expectancy after costs, profit factor, max drawdown, Sharpe with uncertainty, win rate, payoff ratio, exposure, and results by regime and pair. A high win rate alone is not a release criterion.
4. Paper trade and shadow-run each engine before allowing Approval Desk. Require enough observations to estimate uncertainty; record every no-setup, veto, signal, invalidation, and hypothetical fill, not only winners.
5. Permit Autopilot only after venue-specific order protection, reconciliation, cancellation, and monitoring tests pass. Add a kill switch and rollback to the prior strategy version. Live enablement remains separate from research publication.

## Scanner and cache follow-up

- Add a MongoDB lease or queue for distributed single-flight AI calls. The current in-memory promise map only deduplicates requests handled by one process.
- Measure cache freshness around provider publication delays and interval boundaries; tune the two-minute grace period from observed Binance latency.
- Persist `decisionSource`, deterministic failed checks, strategy version, cache key, and model policy version with every run so support and admins can explain repeated results.
- Build an operator chart for setup rate, rule-rejection rate, AI-veto rate, cache hit rate, actual AI tokens, cost per published idea, and outcomes by strategy/pair/timeframe.
- Never label the AI decision score as a probability of profit. Calibrate any future predictive probability against settled out-of-sample outcomes before displaying one.

## Research basis

- [Moskowitz, Ooi, and Pedersen, *Time Series Momentum*](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2089463): evidence across liquid noncrypto futures, useful as a hypothesis, not proof for our crypto implementation.
- [Han, Kang, and Ryu, *Momentum in the Cryptocurrency Market: A Comprehensive Analysis under Realistic Assumptions*](https://academic.oup.com/raps/advance-article-abstract/doi/10.1093/rapstu/raag011/8914819): cryptocurrency momentum with liquidation and other frictions; warns against relying on mean returns or cross-sectional momentum alone.
- [Dobrynskaya, *Cryptocurrency Momentum and Reversal*](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3913263): horizon-dependent momentum and reversal; not a direct validation of our intraday rules.
- [Ilmanen et al., *How Do Factor Premia Vary Over Time?*](https://www.aqr.com/Insights/Research/Journal-Article/How-Do-Factor-Premia-Vary-Over-Time-A-Century-of-Evidence): out-of-sample effects and transaction costs caution against overfit performance claims.
