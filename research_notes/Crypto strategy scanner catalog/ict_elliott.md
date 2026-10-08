# ICT / Smart Money Concepts and Elliott Wave for a Crypto Research Scanner

## What official/primary ICT sources define, and which elements are objectively codable from OHLCV

### Takeaway
ICT/SMC can be implemented responsibly as a **transparent price-pattern ruleset**, not as proof of “institutional” intent. Fair value gaps, confirmed swing points, breaks of selected swing levels, equal-high/low clusters, and premium/discount relative to a declared dealing range are mechanically detectable from closed OHLCV candles; deciding which swing, range, order block, liquidity pool, or higher-timeframe narrative matters remains partly subjective.

### Cited Findings
- The official verified Inner Circle Trader channel's 2022 Mentorship Episode 6 is specifically described as a deep dive into Fair Value Gaps and Market Structure Shifts. The source establishes that these are ICT's own public concepts, although the YouTube page itself does not publish a formal machine-readable specification. — [Official ICT video: 2022 Mentorship Episode 6](https://www.youtube.com/watch?v=Bkt8B3kLATQ)
- In a transcript of ICT's public Fair Value Gap lesson, an FVG is described as a price range where only one side of liquidity was offered; the worked bearish example marks the untraded interval between the first candle's low and the third candle's high around a large down candle. The reverse applies to a bullish gap. This supports the familiar three-candle OHLC test, while the claim that price will “want” to revisit it is a theory, not an observable fact. — [Transcript of ICT Mentorship Core Content: Fair Value Gaps](https://youtubetotranscript.com/transcript?current_language_code=en&v=FgacYSN9QEo)
- ICT's public Episode 6 transcript describes the bullish sequence as a run below an old low, then a move that takes a short-term high, with a three-candle gap used in the setup; the bearish formulation is the inverse after a run above old-high liquidity. This gives a codable candidate sequence only after the scanner defines pivots, breakout thresholds, and allowed lookback windows. — [Official ICT video](https://www.youtube.com/watch?v=Bkt8B3kLATQ); [search-indexed transcript mirror](https://pickscribe.com/de/v/Bkt8B3kLATQ)
- ICT's public teaching on liquidity does not reduce to a single universal formula. The official channel describes an “NFP Liquidity Drill” as training to understand runs on liquidity, while the public Episode 6 material uses old highs/lows as reference levels. Therefore “liquidity sweep” can be encoded as a **declared heuristic**—for example, a wick or close beyond a confirmed pivot followed by a close back inside—not as proof that stop orders or institutions were present. — [Official ICT NFP Liquidity Drill](https://www.youtube.com/watch?v=Qx87ZAANzyA); [Official ICT Episode 6](https://www.youtube.com/watch?v=Bkt8B3kLATQ)
- ICT's public premium/discount lesson defines equilibrium as 50% of a chosen price swing/dealing range, with prices above it treated as premium and below it as discount. The same transcript stresses “clear discernible” price swings and says questionable/sloppy swings should not be used, revealing a subjective range-selection step even though the 50% calculation itself is objective. — [Transcript of ICT Mentorship Core Content: Equilibrium vs. Premium](https://pickscribe.com/fr/v/YuefjnUKQdM)
- A transcript of ICT's public order-block explanation says a bearish order block is an up-close candle before a down move, but explicitly warns that not every up-close or down-close candle is an order block: there must be context or a “storyline.” That makes candle direction mechanically detectable but order-block validity context-dependent. — [Transcript: ICT Forex — What New Traders Should Focus On](https://pickscribe.com/v/7WM8qdkanIY); [original official ICT video](https://www.youtube.com/watch?v=7WM8qdkanIY)
- Binance defines a kline/candlestick as open, close, high, low, volume and related market data for a symbol and duration. These fields support deterministic price-pattern calculations, but they do not expose resting stop orders, trader identities, or “institutional intent.” — [Binance Spot API glossary](https://developers.binance.com/en/docs/products/spot/faqs/spot_glossary)

### Inferences
- Implement **ICT/SMC Price Structure v1** with two layers:
  1. `observations`: confirmed swing highs/lows, equal-high/low clusters within a configurable ATR tolerance, three-candle bullish/bearish FVGs, candle displacement, selected dealing-range high/low/midpoint, FVG fill percentage, and close/wick position;
  2. `interpretation`: candidate liquidity sweep, market-structure shift, premium/discount context, candidate order block, and directional setup score.
- Use closed candles only. Declare all parameters in the result: pivot width, lookback, ATR tolerance, displacement threshold, whether a break requires a wick or close, dealing-range selection rule, FVG minimum size, and maximum setup age.
- Recommended deterministic definitions for the first implementation:
  - bullish FVG candidate: candle `i-2.high < i.low`; bearish FVG candidate: `i-2.low > i.high`; optionally require middle-candle body/range above an ATR threshold;
  - swing high/low: fractal pivot using an explicit left/right bar count, confirmed only after the right-side bars close;
  - sweep candidate: price exceeds a confirmed swing or equal-level cluster by a small ATR/tick buffer and closes back through the level within a bounded number of bars;
  - structure-shift candidate: after an opposing sweep, price closes beyond the latest confirmed internal swing with minimum displacement;
  - premium/discount: current price above/below the midpoint of an explicitly named dealing range selected by a deterministic pivot rule;
  - order block: label only as **candidate order block** and require published confluences (preceding sweep, displacement, structure break, unmitigated zone). Do not claim that it contains institutional orders.
- Because current inputs are Spot closed candles, avoid terms such as “we detected stop orders,” “banks accumulated here,” or “institutional order flow confirms.” Prefer “price swept the selected prior high,” “a three-candle imbalance was detected,” and “this candle zone met the configured order-block heuristic.”
- Treat the ICT strategy as bidirectional research. A bearish pattern can produce a “short research setup,” but the UI must keep actual Spot sell/short execution disabled unless the user owns the asset or a separately approved margin/futures execution product exists.

### Gaps
- There is no concise, official public ICT machine specification that fixes pivot selection, dealing-range selection, equal-high tolerance, displacement threshold, order-block validity, or setup expiry. The official public material is chart-based and context-heavy.
- No reliable primary evidence found establishes a general win rate, expectancy, or superiority for ICT/SMC in cryptocurrency markets. Any performance number must come from Enrivea's own reproducible, fee/slippage-aware backtests and clearly separated live results.
- The “institutional” explanation behind order blocks and liquidity pools is not verifiable from Binance OHLCV alone.

## What official Elliott Wave sources define, and which elements require subjective labeling

### Takeaway
Elliott Wave supplies hard **validity rules** for a proposed count, but finding the count and its degree is not fully objective. The scanner can validate or invalidate candidate pivot sequences and expose alternate counts; it should not claim that one automatically generated wave count is the market's true count.

### Cited Findings
- Elliott Wave International (EWI) defines the basic pattern as five-wave motive movement in the direction of the next-larger trend and three-wave corrective movement against it. — [EWI Introduction to the Wave Principle](https://www.elliottwave.com/free/introduction-to-the-wave-principle/)
- For a motive wave, EWI states that wave 2 retraces less than 100% of wave 1, wave 4 retraces less than 100% of wave 3, wave 3 travels beyond wave 1, and wave 3 is never the shortest of waves 1, 3 and 5. — [EWI Waveopedia: Motive Waves](https://www.elliottwave.com/waveopedia/motive-waves/)
- For an impulse, EWI specifies a 5-3-5-3-5 subdivision and states that wave 4 does not enter wave 1 price territory in non-leveraged cash markets. — [EWI Waveopedia: Impulse](https://www.elliottwave.com/waveopedia/impulse/)
- EWI classifies major corrections as zigzags (5-3-5), flats (3-3-5), triangles (3-3-3-3-3), and combinations; it also says corrections are more varied, often difficult to identify until complete, and their terminations are less predictable. — [EWI Waveopedia: Corrective Waves](https://www.elliottwave.com/waveopedia/corrective-waves/)
- EWI says common corrective retracements include approximately 38%, 50%, and 62%, but warns that using Fibonacci ratios requires a valid wave interpretation first. Fibonacci levels are therefore guidelines/relationships, not standalone proof of a count. — [EWI Introduction to the Wave Principle](https://www.elliottwave.com/free/introduction-to-the-wave-principle/)
- EWI explicitly says two or more valid interpretations usually exist, uses “preferred” and “alternate” counts, and gives an example in which a move below the start of wave 1 invalidates the preferred interpretation. — [EWI Waveopedia](https://www.elliottwave.com/waveopedia/)
- EWI further says Wave analysis provides probability rather than certainty, that mastering application takes years, and that software claiming to produce the best count cannot remove all variables. — [EWI Introduction to the Wave Principle](https://www.elliottwave.com/free/introduction-to-the-wave-principle/)

### Inferences
- Implement **Elliott Wave Assist v1**, not “Automatic Elliott Wave Truth.” The engine should:
  - extract confirmed pivots at more than one sensitivity/degree;
  - enumerate a bounded set of impulse and ABC candidates;
  - reject candidates that violate hard rules;
  - score remaining candidates using transparent guidelines such as retracement proximity, alternation, channel fit, momentum/volume characteristics, and simplicity;
  - return a preferred count plus up to two alternate counts, each with an explicit invalidation level and evidence score;
  - mark incomplete counts as provisional and re-evaluate them when a candle closes.
- Keep “pattern confidence” separate from “trade probability.” A high score means the observed pivots fit the selected wave template; it does not mean the trade has the same probability of profit.
- Require enough historical bars across at least two timeframes. Elliott degree is relative and nested; a single 100-candle window can produce unstable labels. If history or pivot clarity is insufficient, return “ambiguous count / no setup.”
- Use Fibonacci levels only after a valid candidate count exists. Display them as target/retracement zones, never exact guaranteed reversal prices.
- Version pivot extraction and scoring. A change in ZigZag/deviation parameters changes the count and must produce a new strategy version, cache key, and audit record.

### Gaps
- Official sources do not provide one algorithm that uniquely converts arbitrary OHLCV into wave labels. Pivot scale, wave degree, alternates, and incomplete corrections remain analyst judgments.
- EWI's examples and educational claims do not establish a universal audited crypto performance rate. Enrivea must validate its own implementation independently.
- The classic non-overlap language contains market/context nuance; crypto Spot should use the cash-market impulse rule, while any later leveraged futures implementation should document how exceptional intrabar extremes are handled rather than silently relaxing rules.

## How these methods should be represented in a reusable strategy catalog

### Takeaway
The best fit is a platform-wide, versioned strategy catalog with curated built-ins and admin-controlled lifecycle. Users should select a built-in or “AI Decide”; user-authored strategies can be added later as private, research-only drafts after a safe rule-builder exists—not as arbitrary prompts that can immediately drive execution.

### Cited Findings
- EWI distinguishes mandatory rules from typical but non-mandatory guidelines and says a rule should not be disregarded. A strategy schema should preserve that distinction instead of mixing every condition into one opaque AI score. — [EWI Waveopedia: Impulse](https://www.elliottwave.com/waveopedia/impulse/)
- EWI says alternate counts are essential and invalidation levels eliminate candidates. Strategy output therefore needs alternates, state, and invalidation—not only `BUY`, `SELL`, or `NO_SETUP`. — [EWI Waveopedia](https://www.elliottwave.com/waveopedia/)
- The ICT order-block source makes context essential and the premium/discount source makes range selection conditional on a discernible swing. This supports exposing the scanner's selected pivots/range and configured confluences instead of asserting an unexplained label. — [ICT order-block transcript](https://pickscribe.com/v/7WM8qdkanIY); [ICT premium/discount transcript](https://pickscribe.com/fr/v/YuefjnUKQdM)

### Inferences
- Initial catalog entries:
  1. **AI Decide** (default): AI selects one compatible, enabled catalog strategy after comparing objective market-regime features; it must return the chosen strategy ID/version and reason. It may not invent an unnamed method.
  2. **Trend + Breakout**: current deterministic baseline.
  3. **ICT/SMC Price Structure v1**: rules above, with candidate terminology.
  4. **Elliott Wave Assist v1**: preferred/alternate-count research with invalidation.
- Reusable data model (MongoDB) should separate catalog metadata from immutable versions:
  - `Strategy`: `id`, stable `slug`, name, description, owner type (`platform|admin|user`), owner ID, visibility (`public|private|team`), lifecycle (`draft|testing|active|paused|retired`), compatible products, supported markets/directions/timeframes, risk tier, source links, and current version ID.
  - `StrategyVersion`: immutable version number, engine type, objective rules, subjective/AI rubric, indicator and lookback requirements, minimum candles, long/short eligibility, invalidation/expiry rules, risk defaults, prompt template ID, policy constraints, created-by, approval timestamps, and checksum.
  - Every `ScanRun`, signal, approval candidate, and autopilot decision stores `strategyId`, `strategyVersionId`, selected-by (`user|ai|admin_default`), normalized parameters, and the objective evidence snapshot.
- Put strategy selection in a shared component/API so Research Scanner, Approval Desk, and Autopilot use the same IDs and compatibility rules. Each product may allow different strategies and tighter execution policies.
- Make the cache key include `symbol + timeframe + candleClose + strategyVersionId + normalized parameters + risk-policy version + model/prompt version`. A result generated for AI Decide must also preserve the chosen underlying strategy.
- Admin controls are the right first release: admins can create drafts, clone a built-in, edit parameters/rubrics, test on historical data, activate/retire versions, choose product compatibility, and set defaults. Editing an active strategy creates a new immutable version; it never mutates past runs.
- User strategy creation should be phase two and constrained:
  - private by default;
  - research scanner only until backtested and reviewed;
  - built through validated indicators/conditions and bounded AI instructions, not raw system prompts or arbitrary code;
  - no direct autopilot execution without admin approval and explicit user risk limits;
  - clear “custom / unvalidated” badge, separate analytics, and no platform-performance implication.
- “AI Decide” safe default: compare strategy compatibility and regime, choose at most one strategy, and prefer `NO_SETUP` when evidence is ambiguous or strategies conflict. Show `Selected method: ICT/SMC Price Structure` (or equivalent) after analysis even though the OpenAI model name remains hidden.
- Strategy analytics should report setup frequency, accepted/rejected/expired, win/loss/flat, realized and unrealized P&L, drawdown, average R, expectancy, fees/slippage, sample size, and date range by immutable version. Never combine materially changed versions into one performance claim.

### Gaps
- Enrivea still needs policy decisions on who may publish a user-created strategy to other users, whether creators can charge for strategies, and what review/compliance threshold applies.
- Strategy-specific backtest methodology, minimum sample size, and promotion thresholds have not yet been defined.
- ICT names may create attribution/trademark expectations. Product naming and source attribution should receive legal review; a neutral label such as “Liquidity & Imbalance Structure” may be safer while crediting source inspiration in documentation.

## What the product must not claim about performance or certainty

### Takeaway
Neither method can be marketed as guaranteed, proven, institutional certainty, or a fixed probability of profit. Outputs should be framed as research hypotheses derived from historical market data, with observable evidence, limitations, invalidation, and separate verified performance reporting.

### Cited Findings
- EWI itself states that the Wave Principle does not provide certainty, that multiple valid interpretations usually exist, and that error and uncertainty are inherent in assessing future probabilities. — [EWI Introduction to the Wave Principle](https://www.elliottwave.com/free/introduction-to-the-wave-principle/)
- EWI's site disclaimer says information is not guaranteed, no market service is error-free, leveraged trading can lose more than initial margin, and testimonials are not indicative of future results. — [EWI Introduction, disclaimer](https://www.elliottwave.com/free/introduction-to-the-wave-principle/)
- The CFTC warns that no trading system can guarantee profits, that hypothetical results may over- or underestimate performance because assumed fills are not exposed to actual market conditions, and that costs and the trader's ability to withstand losses may be omitted. — [CFTC: Commodity Trading Systems Sold on the Internet](https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/fraudadv_tradingsystem.html)
- The FTC says all investments carry risk and no one can guarantee a specific return or successful investment; it flags “proven” secret systems, guaranteed profit, and low-risk claims as scam signals. — [FTC: Investment Scams](https://consumer.ftc.gov/articles/investment-scams)
- The FTC specifically warns that cryptocurrency is not low-risk and that promises of guaranteed crypto profit or big payouts are false. — [FTC: What To Know About Cryptocurrency and Scams](https://consumer.ftc.gov/articles/what-know-about-cryptocurrency-scams)

### Inferences
- Do not claim or imply:
  - “guaranteed profits,” “risk-free,” “institutional-grade accuracy,” “the AI knows where banks are buying,” “smart money confirmed,” or “price must fill this gap”;
  - a confidence meter is the probability of profit unless it is a separately calibrated statistic with methodology and out-of-sample validation;
  - backtest or synthetic results are live returns;
  - one selected Elliott count is certain;
  - results associated with one strategy version apply to another version, market, timeframe, fee tier, or execution mode.
- Preferred UI language:
  - `Evidence fit 72/100`, not `72% chance to win`;
  - `Candidate liquidity sweep`, not `stop hunt confirmed`;
  - `Preferred wave count; Alternate A remains valid`, not `market is in Wave 3`;
  - `Historical simulation before fees/slippage` or `Live executed results after fees`, never an ambiguous “ROI” number;
  - `No qualifying setup` is a normal research result, not an AI failure.
- Every result should show data venue, symbol, timeframe, last closed-candle timestamp, strategy/version, evidence observations, subjective assumptions, invalidation/expiry, data freshness, and whether results were cached. Execution products should also show fees, slippage assumptions, and connected-account permissions.
- Keep platform confidence dimensions separate: `data quality`, `pattern/rule fit`, `AI explanation confidence`, and, only if later validated, `calibrated outcome probability`. Never average them into one unexplained score.

### Gaps
- This research is product/methodology guidance, not jurisdiction-specific legal advice. Enrivea requires qualified counsel for Nigeria-based operations and each country it serves, especially before selling personalized trade recommendations or enabling futures/margin execution.
- Exact required hypothetical-performance wording and recordkeeping obligations depend on jurisdictions, product scope, and whether Enrivea is considered an adviser, signal provider, CTA, or similar regulated actor.
