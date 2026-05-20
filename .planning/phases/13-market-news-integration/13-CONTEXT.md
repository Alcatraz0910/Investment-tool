# Phase 13: Market News Integration - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 13 layers a news intelligence system on top of the existing WatchListTab. It delivers:

1. **Ticker-specific news** — Finnhub general market-news endpoint provides recent headlines; Claude cross-references them against watch list tickers and creator-backed sectors to produce per-ticker relevance counts.
2. **UK macro context** — RSS feeds (BBC Business, Bank of England, Reuters UK) supply macro headlines; these feed the same Claude cross-reference call.
3. **AI-generated monthly summary** — Claude produces a 3-4 sentence `context_summary` (observational language only; no "advice/recommend/suggest") plus `ticker_counts` and `macro_themes[]` — all cached in a new `news_cache` Supabase table.
4. **WatchListTab UI additions** — "This Month's Context" panel (top of tab), news badge column (per ticker row, ALL Picks + per-creator sections), macro themes strip (per creator card, below header).
5. **Manual refresh** — user-triggered only via "Refresh News" button; no cron, no background jobs.

Phase ends when:
- "Refresh News" triggers Finnhub fetch → RSS fetch → Claude cross-reference → Supabase UPSERT
- WatchListTab renders context panel, news badges, and macro theme pills from cached data
- Cached data is pre-loaded server-side on page load (shows stale data immediately for returning users)

**Out of scope for Phase 13:**
- Automatic/scheduled news refresh (Phase 14+ or never — manual-first constraint)
- Headline detail popover or drawer (badge is display-only count)
- Any changes to portfolio, creators tab, or buy list
- Creator strategy extraction (Phase 11 delivered this)

</domain>

<decisions>
## Implementation Decisions

### Page Load Strategy
- **D-01:** `page.tsx` reads the latest `news_cache` row for the current user from Supabase **server-side** and passes it as `initialNewsContext` prop to `WatchListTab`. This means returning users see their last-refreshed context summary and news counts immediately on tab load — no "click to load" required.
- **D-02:** Empty state only appears when `news_cache` has no row for the user yet (first-ever visit, or data was never refreshed). The context panel shows: `"No news context yet — click Refresh News to generate your first summary."` (no advice language).

### News Badge Interaction
- **D-03:** The "N news" badge on each ticker row is **display-only**. No click interaction, no popover, no drawer. It shows only the integer count of relevant headlines. This is the simplest correct choice — if a user wants to read headlines they can visit the source directly after seeing the count.

### API Key Provisioning
- **D-04:** The plan MUST include a **Wave 0 manual step**: "Obtain Finnhub free-tier API key at finnhub.io and add `FINNHUB_API_KEY=...` to `.env.local`." The refresh server action returns an actionable error if the env var is missing (not a silent failure). RSS feeds have no API key requirement and work independently of Finnhub.

### Context Panel Default State
- **D-05:** The "This Month's Context" panel is **expanded (open) by default** on every visit. No localStorage persistence of collapse state. This is the headline feature of Phase 13 — users should see it immediately. A single collapse toggle per session is sufficient for users who want to minimise it temporarily. Resetting to open on next load ensures the feature is always discoverable.

### Claude Model
- **D-06:** Use `claude-sonnet-4-6` (same as `extractor.ts`). No model override. Cost per refresh ≈ $0.005 (acceptable for user-triggered calls).

### Claude Tool Pattern
- **D-07:** Reuse the forced-structured-output pattern from `extractor.ts`: `tool_choice: { type: 'tool', name: 'generate_news_context' }`. System prompt must not contain "advice", "recommend", or "suggest" (CLAUDE.md constraint). Framed as observation: "You are analysing recent financial news headlines to identify themes relevant to an investor's watch list."

### Data Architecture
- **D-08:** One `news_cache` row per user (`user_id` unique constraint). UPSERT on every refresh — prior row is replaced, not appended. TTL is checked by reading `fetched_at` in the UI to show staleness indicator (amber if > 24 h old).
- **D-09:** `news_cache` stores the full Claude tool output as a JSONB `summary_json` field: `{ ticker_counts, macro_themes, context_summary }`. Raw headlines are stored separately in `headlines_json` for potential future use but not rendered in the UI.
- **D-10:** No `news_context_cache` / `news_cache` split — a single table `news_cache` holds both the headline list and the AI summary. Simpler, and Phase 13's volume (one row per user) does not justify two tables.

### Partial Failure Handling
- **D-11:** Graceful degradation on partial RSS failure. If 1-2 RSS feeds timeout or return errors, the refresh continues with available feeds. The Claude call proceeds with whatever headlines were collected. Error state: an error banner below the context panel notes which feeds failed — `"News refresh partially failed. Some feeds were unavailable. Summary generated from available data."` Both buttons re-enable.
- **D-12:** Full failure (Finnhub + all RSS fail): refresh aborts, context panel retains previous cached data, error banner shown. Both buttons re-enable.

### File Structure
- **D-13:** New files follow project conventions:
  - `pulse/src/lib/news/finnhub.ts` — `fetchFinnhubMarketNews()`
  - `pulse/src/lib/news/rss.ts` — `fetchRssFeeds()`
  - `pulse/src/lib/news/news-types.ts` — shared types
  - `pulse/src/app/dashboard/news-actions.ts` — `refreshNewsAndSummary()` server action
  - Migration SQL snippet delivered as Wave 0 (user runs in Supabase SQL Editor — same pattern as Phases 7/8/11)

### Migration Delivery
- **D-14:** SQL migration delivered as a Wave 0 snippet for the user to run in Supabase SQL Editor. Same delivery pattern as Phases 7, 8, 11. No automated migration runner.

### Claude's Discretion
- Finnhub category parameter (`general` vs `forex` vs `crypto`) — research recommends `general`; planner should use that
- `rss-parser` timeout value per feed — research recommends 10 s; planner should use that
- Exact Supabase column types — follow RESEARCH.md DB schema section exactly
- Order of RSS feed fetches — parallel via `Promise.allSettled` so order doesn't matter

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Constraints
- `CLAUDE.md` — no "advice/recommend/suggest" language; decimal.js mandate; manual-refresh-only model; RAG pattern
- `.planning/PROJECT.md` — project goals, constraints, key decisions
- `.planning/REQUIREMENTS.md` — NEWS-01 through NEWS-07 (Phase 13 requirements)

### Phase Research & Design Contracts
- `.planning/phases/13-market-news-integration/13-RESEARCH.md` — Finnhub patterns, RSS feed URLs, Claude tool schema, DB schema, pitfalls, anti-patterns
- `.planning/phases/13-market-news-integration/13-UI-SPEC.md` — UI design contract: component specs, states, interaction contracts, copywriting, accessibility
- `.planning/phases/13-market-news-integration/13-VALIDATION.md` — per-task validation map, test strategy

### Existing Code to Read Before Modifying
- `pulse/src/app/dashboard/components/WatchListTab.tsx` — component being extended; read all props and state before adding new
- `pulse/src/lib/strategy/extractor.ts` — Claude tool-use pattern to replicate (`tool_choice`, `PROFILE_TOOL_DEF`, `SYSTEM_PROMPT` structure)
- `pulse/src/app/dashboard/watchlist-actions.ts` — server action pattern to follow for `news-actions.ts`
- `pulse/src/app/dashboard/actions.ts` — `fetchTickerPrices` pattern (parallel Supabase + external fetch)
- `pulse/src/app/dashboard/page.tsx` — server component that pre-fetches data and passes as props; extend to fetch `news_cache`

### Prior Phase Context (for integration consistency)
- `.planning/phases/12-watch-list-per-creator-budget/12-CONTEXT.md` — WatchListTab props, CreatorWatchList type, budget logic
- `.planning/phases/11-creator-intelligence-extraction/11-CONTEXT.md` — extractor.ts pattern, profile_stable/profile_latest shape

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WatchListTab.tsx` — main component to extend; currently accepts `initialWatchLists`, `userCreatorIdMap`; will need `initialNewsContext` prop
- `extractor.ts` → `PROFILE_TOOL_DEF`, `SYSTEM_PROMPT`, `tool_choice` pattern — copy structure for `NEWS_CONTEXT_TOOL` and `NEWS_SYSTEM_PROMPT`
- `watchlist-actions.ts` → `saveCreatorMonthlyBudget` — server action pattern: `'use server'`, Supabase service client, typed return
- Existing `<SpinnerSVG />` component in WatchListTab — reuse for "Refresh News" loading state
- Glassmorphism card pattern: `backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4`

### Established Patterns
- Server-side pre-fetch in `page.tsx` with `initialX` props → client component hydration (used for all tabs)
- `Promise.allSettled` for parallel price fetches → use same pattern for parallel RSS feed fetches
- `framer-motion` `AnimatePresence` + `motion.div` for new sections
- `Decimal.js` for all £ arithmetic (not needed in news layer, but carry the mandate)
- `-actions.ts` suffix for server action files per feature area

### Integration Points
- `page.tsx`: add `news_cache` Supabase query + `initialNewsContext` prop to `<WatchListTab />`
- `WatchListTab.tsx`: accept `initialNewsContext` prop; add context panel above price error banner; add news column to all ticker tables; add macro themes strip per creator card
- `watchlist-actions.ts` or new `news-actions.ts`: `refreshNewsAndSummary()` server action
- New `lib/news/` directory — scoped utilities, no cross-contamination with existing `lib/strategy/`

</code_context>

<specifics>
## Specific Ideas

- The "This Month's Context" panel sits at the top of the Watch List tab, above everything else (above the price error banner, below the tab heading row)
- Refresh News and Refresh Prices are mutually exclusive — both buttons disable while either operation is loading
- News column header: "News" — each cell shows "N news" badge or empty if count is 0
- Macro theme pills format: `"{sector}: {theme}"` with a 1.5 px sentiment dot (green/amber/red) — max 3 pills per creator card
- Staleness indicator: shows time since last refresh; turns amber text when > 24 h old
- Migration creates one table: `news_cache` (user_id UUID PK FK, headlines_json JSONB, summary_json JSONB, fetched_at TIMESTAMPTZ)

</specifics>

<deferred>
## Deferred Ideas

- Headline detail view (popover/drawer showing actual headline titles + source links) — Phase 14+ if desired
- Auto-scheduled news refresh (cron job or background polling) — violates v1 manual-first constraint; Phase 14+ if desired
- Per-ticker news feed page — out of scope; Phase 14+

</deferred>

---

*Phase: 13-market-news-integration*
*Context gathered: 2026-05-20*
