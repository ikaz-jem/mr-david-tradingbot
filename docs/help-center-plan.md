# Enrivea Help Center — development plan

Status: core Help Center and admin R2 configuration implemented locally; the targeted access-role migration has been applied. Production launch still requires real R2 credentials, editorial review of the guides, and a live image-upload/deletion test.
Date: 17 October 2026.
Payment work is parked in docs/payment-checkpoint.md.

## 1. Outcome and scope

Give visitors and customers a dependable place to understand the platform, complete tasks, interpret results, resolve common problems, and contact support with useful context. Cover the complete customer journey; provide a route to support when an article cannot answer a question. Avoid promising that a knowledge base can anticipate every question.

Build on the existing Next.js, MongoDB/Mongoose, NextAuth, shared UI components, and ticket system. Preserve /dashboard/support and /admin/support as the existing ticket inboxes. Reuse the established dark green/lime design with a calmer, readable article layout, responsive navigation, accessible contrast, keyboard search, and restrained motion.

The Help Center is available before sign-in, including account recovery guidance. Published articles should remain readable when registration, billing, or product runs are paused. Private ticket history continues to require sign-in.

## 2. User-facing structure

Proposed routes:

| Route | Purpose |
| --- | --- |
| /help | Search, quick-start paths, categories, popular articles, service notices, contact support |
| /help/category/[slug] | Ordered category articles, beginner guides, related topics |
| /help/articles/[slug] | Searchable article with table of contents, steps, related articles, feedback, contact support |
| /help/search?q=... | Search results with snippets, category and product filters, useful empty states |
| /dashboard/support | Existing private tickets, linked from Help Center and contextual help |
| /contact | Existing public contact route for users unable to sign in |
| /admin/help | Article inventory, draft/review queue, stale content, content coverage |
| /admin/help/articles/[id] | Edit, preview, review, publish, archive, inspect revisions |
| /admin/help/categories | Category ordering, descriptions, article organization |
| /admin/help/analytics | Search gaps, helpfulness, article usage, ticket handoffs |

Add Help Center to the public footer and account dropdown. Add a small contextual Help link to scanner, Approval Desk, Autopilot, Exchanges, Billing, Affiliates, Performance, and Settings. Link known error states directly to an appropriate troubleshooting article. These links never alter transactions or dismiss errors.

## 3. Launch content coverage

Prepare approximately 50–70 concise articles across these categories. Inventory actual UI/API behavior before finalizing article claims; the following topics define scope, not a statement that every capability is already live.

| Category | Required topics |
| --- | --- |
| Getting started | What Enrivea does; Trading Companion's three products; account creation and verification; activation; first scan; demo versus real account; setup checklist |
| Account and security | Login and password reset; profile preferences; sessions and sign-out; changing password; email verification; notifications; data export/privacy; restricted accounts; requesting account closure where supported |
| Activation, credits and billing | One-time activation and included shared credits; no monthly subscription under the current model; refill packs; product-specific charging events; failed/no-setup runs; payment email; Paystack; crypto asset/network and memo; pending/failed/review statuses; receipts; missing credits; refund/support process |
| Research scanner | Select market, timeframe and strategy; AI-selected strategy; market data and freshness; cached results; long/short/stay-out decisions; confidence versus probability of profit; entry/stop/target; risk/reward; no setup; history and errors |
| Approval Desk | Enable discovery and set filters; approved scan universe; shared scanning; locked previews; credit cost of unlock; unlock versus execution; accept/decline; expiry and invalidation; Spot/Futures availability; open trades; trade history; unavailable scans |
| Autopilot | Availability and requirements; connection and risk configuration; allowed pairs/strategies; amount and leverage meaning; credit consumption event; enable/pause/stop; order lifecycle; protections; open positions/history; failed/ambiguous orders; what stopping automation does to existing positions |
| Exchange connections | Supported exchanges and markets; one connection per exchange/market as actually enforced; creating API credentials; minimum permissions; IP restrictions; connection test; balances; reconnect/disconnect; Spot SELL versus Futures short; trading permissions; exchange rejection troubleshooting |
| Performance and trade tracking | Real versus paper/user-reported trades; realized/unrealized P&L; fees/funding/slippage inclusion; gross versus net; ROI denominators; timestamps/timezones; partial fills; externally changed positions; delayed reconciliation; unknown/unavailable values |
| Affiliates | Referral link; attribution window; qualifying first activation purchase; direct and configured multi-level rewards; percentage/fixed rewards when supported; hold/pending/available/paid/reversed states; payout profile; manual settlement; payout evidence; disputes |
| Troubleshooting and support | Service pauses; connection errors; missing emails; payment unresolved; insufficient credits; setup expired; execution declined; stale data; opening/replying/reopening tickets; expected next steps; contacting support while signed out |

Create a short glossary for candle, timeframe, entry, stop loss, take profit, long, short, Spot, Futures, leverage, margin, notional, risk/reward, P&L, drawdown, slippage, funding, and confidence. Use worked examples explicitly labeled as examples, not current market advice or promised returns.

For each supported CEX, publish a separate connection guide only after checking its current official documentation and our adapter capabilities. Use synthetic screenshots with no personal information or credentials. Do not imply identical order/protection support across exchanges.

## 4. Article standard and content accuracy

Every article contains a direct answer, who it applies to, prerequisites, numbered steps using actual UI labels, expected outcome, common errors, next steps, related links, and a last-reviewed date. Add screenshots only where they improve a task. Keep trading concepts separate from step-by-step product instructions.

Store structured fields: title, unique slug, summary, category, product tags, keywords/search aliases, body blocks, audience, lifecycle status, content revision, author/reviewer, publishedAt, reviewedAt, reviewDueAt, related article IDs, and related feature/configuration keys.

Use structured rich-text blocks rendered through an allowlist. Support headings, paragraphs, lists, tables, safe links, images with alt text, notes, and code-free examples. Do not execute author-provided JSX, MDX, scripts, or arbitrary HTML.

Draft → review → published → archived. Keep the published revision visible while a revision is being edited. Use optimistic concurrency to prevent editors overwriting each other. Preview stays permission-protected and uncached. Maintain revision history and slug redirects; archiving must not leave misleading search results or broken contextual links.

Keep mutable prices, activation credits, pack availability, per-product credit costs, and supported options in safe structured placeholders backed by existing configuration readers. Resolve demo/live scope correctly. Article text must not hard-code today's activation price or claim a fixed commission when admin controls it. Never expose private settings, provider keys, or AI model details through these placeholders.

Display feature availability separately from publication status: published guidance can describe a feature that is currently paused. Reflect actual operations settings without suggesting that an article enables access. Product status and public notices must use approved public information, not internal logs.

Review existing docs and code together: some current docs still describe retired subscriptions, earlier execution capabilities, or a cron configuration that was missing in the latest audit. Resolve contradictions before using them as published content. Every future feature change should include a help-content impact check in its development acceptance criteria.

## 5. Search and navigation

Start with a MongoDB text index and normalized keywords/aliases; prioritize exact title matches, title terms, then summaries/body. Add aliases such as TP/take profit, SL/stop loss, CEX/exchange, and paid/missing credits. Limit query length, escape any pattern matching, paginate, debounce input, and rate-limit public search.

Return only published articles permitted for the viewer. Suggestions, snippets, result counts, and cache keys must enforce the same visibility as article reads. Public search must never index tickets, user balances, drafts, or internal notes. Test relevance on a maintained list of real customer questions.

Empty results should suggest nearby categories and contact support. Provide keyboard-accessible navigation, visible loading/error states, mobile layouts, breadcrumbs, a collapsible table of contents, and preserved search terms when navigating back.

Use Atlas Search later if typo tolerance and ranking requirements outgrow the initial implementation; do not require a separate search service for the first release.

## 6. Contextual support and onboarding

Use the existing ticket system. An article's Contact support action can preselect the ticket category and include the article ID and the customer's current page. Let the user review any attached order/trade reference; validate ownership server-side. Never attach API keys, payment addresses from unrelated orders, passwords, raw request payloads, or internal notes automatically.

Suggest relevant published articles before ticket submission while keeping submission available. Add article-link insertion to staff replies, using existing support permissions. Do not promise response times unless an actual support policy is configured.

Add an optional onboarding checklist based on existing account facts: verify email, activate, connect an exchange where needed, run research, understand results, configure a product. Do not require exchange connection for features that do not need it. Mark steps from real state and allow users to dismiss the checklist.

## 7. Administration and authorization

Add granular permissions such as knowledge:read, knowledge:create, knowledge:update, knowledge:publish, knowledge:archive, and knowledge:analytics. Register them through the centralized catalog and role system with a non-destructive migration. Editors can prepare drafts; publishing requires the explicit publish permission. Grant nothing implicitly to ordinary users.

Classify public published article reads as public, ticket actions as authenticated owner operations, and content management as platform-staff permission operations. Enforce all checks server-side. Private/member content, if introduced, requires its audience check on every read and search path.

Keep demo admin edits and demo analytics isolated from live published help. Reuse existing demo scope conventions. Record publication, revision, category, archive and role-sensitive changes in the audit system. Require same-origin checks and rate limits for mutations, validate inputs and media, and avoid logging sensitive search text.

Publishing should invalidate the article, category, related navigation, and search caches; publish changes must be visible consistently. Use draft previews and revision comparison before publication. Add content review reminders and a queue of articles linked to changed product configuration/features.

## 8. Analytics and privacy

Track aggregate article views, helpful/not-helpful responses, searches with no results, selected results, and article-to-ticket handoffs. Deduplicate feedback and limit abuse. Do not call a page view a resolved support issue; use an explicit Was this helpful? response and ticket outcomes for interpretation.

Minimize search data: users can paste emails, references or secrets into search. Redact obvious sensitive values, avoid retaining raw queries by default, set retention limits, and obey consent preferences for optional analytics. Operational search must work even if optional analytics are disabled. Restricted analytics remain permission-gated.

## 9. Technical components

Mongoose models: HelpCategory, HelpArticle, HelpArticleRevision, HelpFeedback, and bounded/aggregated HelpSearchMetric. Use the existing audit infrastructure. Add indexes for slug uniqueness, publication/category order, product tags, search, and retention where applicable. Seed articles idempotently without overwriting administrator edits.

APIs: public published article/category/search reads; owner-safe feedback submission; staff CRUD, preview, revision and publication endpoints; permission-protected analytics. Resolve dynamic values through allowlisted configuration DTOs. Avoid starting background timers in Next.js request handlers; any later scheduled review work uses the deployment's existing scheduler approach.

Start with English and stable article identifiers. Design content fields for later translations and explicit fallback; do not present machine-translated payment or execution guidance as reviewed content.

Published public articles receive canonical URLs, descriptive metadata, sitemap entries, and appropriate structured data. Drafts, preview routes, search result pages and private content are excluded from indexing. Link checking, image optimization and accessibility are part of release verification.

## 10. Delivery sequence

1. Content and behavior inventory: map each user screen, key action, error and charging event to an article; identify unresolved behavior; approve the category structure and draft the first 20 highest-value articles.
2. Foundation: models, permission registration, article renderer, public Help Center/category/article pages, and initial reviewed seed content. Preserve the existing ticket routes.
3. Editorial tools and search: admin article/category management, revisions, preview/review/publish, cache invalidation, search and feedback. Expand to the complete launch content set.
4. In-app integration: contextual links, relevant error help, ticket handoffs, staff article shortcuts, optional onboarding checklist, public navigation and mobile polish.
5. Validation and launch: verify instructions against current product behavior, test published/draft/demo isolation, exercise search relevance and broken links, check accessibility/mobile, and release only reviewed content. Enable aggregate analytics and assign review ownership.

Optional later phase: an AI help assistant grounded only in published articles, with source links and a ticket handoff when evidence is missing. Use the central admin-managed AI provider, keep private account data outside retrieval by default, and define a separate support cost policy rather than silently charging trading credits. It must never invent payment status, trading execution, or unpublished capabilities. Conventional search and support remain usable without AI.

## 11. Acceptance criteria

- Every current customer feature and important error state maps to reviewed guidance or an honest support escalation.
- A new user can understand activation, run research, distinguish the three products, and find relevant exchange and payment instructions without contacting staff.
- Prices, credit costs and available products do not contradict active configuration.
- Search relevance covers representative questions; draft/internal/demo content cannot leak through pages, snippets, caches, previews or suggestions.
- Unauthorized publishing, cross-owner ticket references, and cross-scope admin edits are rejected server-side and covered by focused tests.
- Publishing and archiving update all relevant views consistently; concurrent editing cannot silently lose revisions.
- Payment and trade examples are labeled, capability-specific, and distinguish actual execution from research, paper trading and user-reported records.
- Article pages work on mobile and with keyboard/screen-reader navigation; all actionable controls have loading, success and error feedback.
- Support handoff works, stores only permitted context, and does not expose internal notes or promise an unconfigured SLA.
- Test, typecheck and build pass for the implementation. Conduct a separate editorial walkthrough; automated checks cannot certify the accuracy of every instruction.

Recommended first development slice: the Help Center foundation, first 20 reviewed articles, admin publishing workflow, and contextual links from Billing, Research scanner, Exchanges and Approval Desk. Extend the same architecture across the remaining categories before calling the Help Center complete.
