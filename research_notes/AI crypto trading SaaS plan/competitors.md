# Competitor research: CEX connected AI crypto trading SaaS

Research checked 24 September 2026. Prices and audience counts are public page snapshots, not independently audited.

## What do the leading products actually do with AI, and how do users reach execution?

### Takeaway
"AI bot" covers different products: model assisted research and strategy creation, algorithmic selection among fixed strategies, and AI enabled live execution. For a first version that finds trade setups and lets a user execute with one click, Altrady's staged trade and Coinrule's inspectable rule are the closest UX references.

### Cited Findings
- **3Commas V2 / WunderTrading:** 3Commas says v1 stopped on 11 September 2026 and its successor v2 is built with WunderTrading. Existing strategies and API keys do not automatically migrate. The same FAQ describes QuantPilot as a separate AI research/strategy product. — [3Commas transition FAQ](https://help.3commas.io/en/articles/16245835-3commas-v2-everything-you-need-to-know)
- **WunderTrading:** Its AI page positions the platform mainly as an execution layer for a user's own GPT/Claude/other agent through MCP or REST API. The agent can place and manage trades on connected exchanges; its ordinary Signal Bot executes external TradingView/custom signals according to user settings. This is evidence of AI enabled execution, not evidence of a proprietary AI model that discovers profitable setups by itself. — [AI execution page](https://wundertrading.com/en/ai-trading-bot); [Signal Bot](https://wundertrading.com/en/signal-bot); [MCP connection docs](https://wundertrading.com/docs/mcp/connections)
- **Coinrule:** Users describe or paste a strategy; AI converts it to a canonical rule that they review and edit before deployment. Cloud docs list paper and live trading, backtests, P&L, BTC/S&P benchmark, trigger proximity, and an audit log. Its MCP integration permits read only or read/write scopes, including strategy creation and launching. — [Cloud docs](https://cloud.coinrule.com/docs); [MCP permissions guide, 17 July 2026](https://help.coinrule.com/articles/708156-connect-ai-assistant-coinrule-trading-mcp)
- **Cryptohopper:** Its help center explicitly says its "A.I." means **Algorithmic Intelligence**, not artificial intelligence: it backtests and ranks user supplied strategies, then selects one for market conditions. Its Hero plan includes that AI designer; its separate MCP product supplies market data to external AI clients. — [AI explanation](https://support.cryptohopper.com/en/articles/9133522-what-is-algorithm-intelligence-a-i-and-how-does-it-work); [pricing](https://www.cryptohopper.com/pricing); [MCP docs](https://docs.cryptohopper.com/docs/cryptohopper-mcp/setup-overview)
- **Bitsgap:** Its own explanation says AI chooses pairs and configures/diversifies Grid and related bots, after which fixed rules execute. Users choose exchange, investment and duration, inspect a backtest and settings, then press Start bots. — [AI Assistant guide, 7 July 2026](https://bitsgap.com/blog/how-to-use-bitsgap-ai-assistant-set-up-your-first-ai-powered-bot-portfolio); [setup help](https://bitsgap.com/en/helpdesk/article/18009773535260-Getting-Started-with-Bitsgap-AI-Assistant)
- **Altrady:** AI Chat and Market Reports can prepare trade setups; its own assistant or local MCP integration can prefill positions, alerts and bots for one tap confirmation. Its higher level product includes scanners, a journal, paper trading and performance reports. — [pricing and feature comparison](https://www.altrady.com/pricing); [credit help](https://help.altrady.com/en/ai-credits/how-do-ai-credits-work)
- **QuantPilot:** 3Commas team product for agentic market research, strategy generation, backtests and optimization. Its FAQ says it currently supports Hyperliquid only and is working on CEX integrations, so it is adjacent rather than a current CEX competitor. — [QuantPilot home/FAQ](https://quantpilot.com/); [3Commas FAQ](https://help.3commas.io/en/articles/16245835-3commas-v2-everything-you-need-to-know)

### Inferences
- For the user's first release, a strong workflow is AI finds a setup, displays the evidence and complete order ticket, then the user explicitly confirms the order. This combines the staged confirmation demonstrated by [Altrady](https://www.altrady.com/pricing) with review before execution demonstrated by [Coinrule](https://cloud.coinrule.com/docs) and [Bitsgap](https://bitsgap.com/en/helpdesk/article/18009773535260-Getting-Started-with-Bitsgap-AI-Assistant).
- The product should name its AI function precisely. Calling a fixed indicator selector an autonomous AI trader would blur a distinction [Cryptohopper itself makes explicit](https://support.cryptohopper.com/en/articles/9133522-what-is-algorithm-intelligence-a-i-and-how-does-it-work).

### Gaps
- Public pages do not establish competitor AI signal precision, profitable returns, or independently verified user performance.
- Public documentation does not reveal their proprietary models, training data, or internal selection criteria.

## What custody, analytics and customer features set the baseline?

### Takeaway
The baseline is assets held at the user's exchange, narrow API permissions, clear order review, paper trading, and transparent realized and unrealized performance. Competitors already offer considerable analytics, so a simple P&L chart alone is unlikely to stand out.

### Cited Findings
- **Custody:** WunderTrading requires exchange API keys with withdrawal access disabled and recommends IP whitelisting; Coinrule says it rejects withdrawal enabled keys; Bitsgap says keys are encrypted and it does not access user funds; Cryptohopper says Copy Bot funds remain at the exchange. — [WunderTrading pricing FAQ](https://wundertrading.com/en/pricing); [Coinrule Cloud](https://cloud.coinrule.com/); [Bitsgap pricing FAQ](https://bitsgap.com/pricing); [Cryptohopper Copy Bot](https://www.cryptohopper.com/features/copy-bot)
- **WunderTrading:** Public materials list Signal, Grid, DCA, market neutral bots, a pump screener, demo trading, multi API orders, portfolio tracking, take profit, stop loss and trade history statistics. — [home](https://wundertrading.com/en); [pricing](https://wundertrading.com/en/pricing); [MCP docs](https://wundertrading.com/docs/mcp/connections)
- **Coinrule:** Cloud docs describe live P&L, BTC/S&P benchmark comparisons, activity/audit logs, paper trading, backtesting and aggregated portfolios; pricing lists portfolio analytics and, at higher tiers, team seats and shared dashboards. — [Cloud docs](https://cloud.coinrule.com/docs); [Cloud pricing](https://cloud.coinrule.com/pricing)
- **Cryptohopper:** Pricing lists statistics, paper trading, backtesting, a strategy designer, marketplace and social trading. Copy Bot pages show seller profits, currencies, max drawdown, reviews and opened positions. — [pricing](https://www.cryptohopper.com/pricing); [Copy Bot](https://www.cryptohopper.com/features/copy-bot)
- **Bitsgap:** Pricing lists bot analytics, interactive charts, portfolio tracking, smart orders, backtesting windows by plan and AI Portfolio Mode on Pro. — [pricing](https://bitsgap.com/pricing)
- **Altrady:** Its pricing page lists journal and reports, net P&L, win rate, average risk/reward, drawdown, multi exchange balance aggregation and tax export. It also offers AI reviews of journal trades, with a credit cost by period. — [pricing](https://www.altrady.com/pricing); [AI journal review help](https://help.altrady.com/en/trading-journal/ai-trade-reviews-in-the-journal)

### Inferences
- A differentiating analytics surface could connect each AI recommendation to its later outcome: signal timestamp, input snapshot, model/version, confidence and rationale, user's execution choice, actual fill and fees, target/stop outcomes, and a fair benchmark. This goes beyond the standard P&L and backtest surfaces [Coinrule](https://cloud.coinrule.com/docs) and [Altrady](https://www.altrady.com/pricing) advertise.
- Separate **signal quality** from **user portfolio performance**. A user may skip a signal or change size/timing, so attribution cannot be inferred from P&L alone; [Altrady's journal](https://www.altrady.com/pricing) and [Coinrule's audit log](https://cloud.coinrule.com/docs) provide useful precedents.

### Gaps
- Competitors do not publish their staff/admin dashboards, moderation tools, support workflows or complete internal analytics. These cannot be benchmarked from public user pages.
- The cited pages do not establish whether any competitor offers a complete, independently audited signal scorecard with both executed and skipped recommendations.

## How do the competitors package price and AI credits?

### Takeaway
Subscriptions with usage limits are common. Altrady, Coinrule Cloud and QuantPilot make a credit or token balance visible, giving a clear precedent for charging by AI analysis, but the meaning of a credit differs materially by product.

### Cited Findings
- **Coinrule Cloud:** Current Cloud pricing advertises 1,000/10,000/100,000 credits per month on Investor/Trader/Pro, with $0.02 per credit overage. Credits cover AI parsing, deployments, executions, market data subscriptions and TradingView signals. Its older `coinrule.com/pricing.html` page lists different plan counts and 500/5,000/50,000 AI credits, so the company's two official pricing surfaces conflict as of this check. — [Cloud pricing](https://cloud.coinrule.com/pricing); [legacy pricing](https://coinrule.com/pricing.html)
- **Altrady:** Basic/Essential/Premium cost €28/€50/€90 monthly and include 500/1,500/3,000 monthly AI credits. A chat message usually costs 1–10 credits; an AI market report about 10. Top ups cost €10 for 1,000 and €25 for 3,000; purchased credits do not expire, while monthly allowances do. Failed report generation is refunded according to its help center. — [pricing](https://www.altrady.com/pricing); [credit help](https://help.altrady.com/en/ai-credits/how-do-ai-credits-work)
- **QuantPilot:** Its site advertises free daily tokens and an example calculator of 20 million tokens for $20; terms say purchased tokens roll over and free tokens expire. Its CEX support remains planned. — [home](https://quantpilot.com/); [terms](https://quantpilot.com/terms-of-use)
- **Bitsgap:** Basic/Advanced/Pro are shown at $29/$69/$149 per month (or $23/$55/$119 monthly equivalent on annual billing), with AI Assistant in all paid tiers. The page shows a seven day Pro trial. No separate AI credits appear in its public plan table. — [pricing](https://bitsgap.com/pricing)
- **Cryptohopper:** Explorer/Adventurer/Hero are $29/$69/$129 monthly; Hero includes A.I. strategies/designer. Copy Bot runs on a separate $9.99–$99.99 monthly subscription. — [pricing](https://www.cryptohopper.com/pricing); [subscription help](https://support.cryptohopper.com/en/articles/9046776-what-are-the-differences-between-cryptohopper-subscriptions)
- **WunderTrading:** Free/Basic/Pro/Premium tiers limit the number of API profiles and active bots, with a free seven day Pro trial. Its AI execution page says live CEX trading through MCP/API starts with Pro, whereas pricing says API/MCP connectivity is included in every plan; those public statements need clarification. The public page rendered no reliable numeric monthly prices in this check. — [pricing](https://wundertrading.com/en/pricing); [AI execution](https://wundertrading.com/en/ai-trading-bot)

### Inferences
- Price credits on a concrete billable action, such as a completed scan or generated trade setup, and show the cost before execution, balance and refund on failure. [Altrady](https://help.altrady.com/en/ai-credits/how-do-ai-credits-work) establishes these customer expectations.
- A subscription plus monthly credit grant and optional top ups can cover regular users while matching variable AI costs. Both [Altrady](https://www.altrady.com/pricing) and [Coinrule Cloud](https://cloud.coinrule.com/pricing) demonstrate this structure.

### Gaps
- Coinrule's Cloud and legacy pricing pages are inconsistent; live checkout or company confirmation is needed before using exact prices in a financial model.
- Public pricing does not reveal competitors' gross margins, model inference costs or actual credit consumption distributions.

## How popular are these products, and what product opportunities follow?

### Takeaway
These are established competitors, but public popularity numbers are mainly first party marketing claims rather than independently comparable active customer counts. The clearest opening is a focused CEX trade discovery and one click approval workflow with an auditable AI scorecard.

### Cited Findings
- WunderTrading claims 210,000+ traders, 70,000+ bots and $1 billion+ 30 day volume on its own site. These are self reported and do not specify active paying customers. — [WunderTrading home](https://wundertrading.com/en)
- Bitsgap claims a community of 800,000+ traders on its own pricing page; this is self reported and not an active subscriber figure. — [Bitsgap pricing footer](https://bitsgap.com/pricing)
- Altrady claims 130,000+ traders worldwide on its own pricing page; this is self reported and not an active subscriber figure. — [Altrady pricing](https://www.altrady.com/pricing)
- Coinrule Cloud claims 1.4 million+ strategies created, 350+ template bots and 25+ exchanges/chains; strategies created are not a user count. — [Coinrule Cloud](https://cloud.coinrule.com/)
- Cryptohopper promotes a marketplace where strategy and signal providers can sell to subscribers; Copy Bot seller pages expose results and max drawdown. — [Strategy Designer](https://www.cryptohopper.com/features/strategy-designer); [Copy Bot](https://www.cryptohopper.com/features/copy-bot)

### Inferences
- Product opportunities for the requested V1: a curated scanner that surfaces complete trade tickets; a one click user confirmation with exchange side order status; explanation and evidence tied to each signal; credits charged for completed analysis rather than order execution; and a public performance methodology that counts every signal, including misses. The comparative basis is [Altrady's staged confirmations](https://www.altrady.com/pricing), [Coinrule's review and audit flow](https://cloud.coinrule.com/docs), and the opaque strategy selection described by [Cryptohopper](https://support.cryptohopper.com/en/articles/9133522-what-is-algorithm-intelligence-a-i-and-how-does-it-work).
- Keep initial product scope narrower than an all purpose bot marketplace. [Cryptohopper's marketplace](https://www.cryptohopper.com/features/strategy-designer) and [WunderTrading's bot breadth](https://wundertrading.com/en/pricing) are mature feature sets; discovery, explanation, approval and scorekeeping can be a more coherent initial proposition.

### Gaps
- No independent, consistently defined active subscriber or market share data was found for these products. Do not rank them by the marketing counts above.
- Public pages do not establish whether the proposed positioning will attract customers; interviews or a landing page test would be needed.
