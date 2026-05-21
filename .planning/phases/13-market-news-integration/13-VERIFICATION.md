---
phase: 13-market-news-integration
verified: 2026-05-20T00:00:00Z
status: gaps_found
score: 6/7 success criteria verified
overrides_applied: 0
gaps:
  - truth: "rss-parser npm package is installed and importable at runtime"
    status: failed
    reason: "rss-parser is absent from pulse/package.json dependencies AND from node_modules/. pulse/src/lib/news/rss.ts imports Parser from 'rss-parser' at line 8 with import 'server-only' and no fallback. At runtime the Next.js module resolver will throw MODULE_NOT_FOUND, making the RSS fetch path dead. Finnhub-only fallback exists in news-actions.ts but only when RSS fetch throws a network error — a missing module will throw before fetchRssFeeds() is even callable."
    artifacts:
      - path: "pulse/src/lib/news/rss.ts"
        issue: "Line 8: `import Parser from 'rss-parser'` — package not installed"
      - path: "pulse/package.json"
        issue: "rss-parser absent from dependencies object"
    missing:
      - "Run: cd pulse && npm install rss-parser"
      - "Verify rss-parser appears in pulse/package.json dependencies after install"
---

# Phase 13: Market News Integration — Verification Report

**Phase Goal:** Finnhub ticker news + BBC Business/BoE RSS feeds; AI cross-references against watch list tickers and creator-backed sectors; generates a "this month's context" summary (3-4 sentences) combining creator signals and macro news; manual refresh only.
**Verified:** 2026-05-20
**Status:** GAPS FOUND
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | "Refresh News" button triggers Finnhub fetch + RSS parse + Claude cross-reference + Supabase UPSERT | ✗ FAILED | `refreshNewsAndSummary()` wiring is correct in code, but `rss-parser` is not installed — `rss.ts` will throw MODULE_NOT_FOUND at runtime, aborting any RSS fetch before it starts |
| 2 | "This Month's Context" panel renders at the top of the Watch List tab, expanded by default, with 3-4 sentence AI summary | ✓ VERIFIED | WatchListTab.tsx lines 204-264: panel present, `isContextExpanded` defaults to `true`, contextSummary rendered from `newsContext.contextSummary` |
| 3 | News badge column ("News") appears in every ticker table showing per-ticker headline count | ✓ VERIFIED | All Picks table (line 300) and per-creator table (line 497) both have `<th>News</th>` and `newsContext.tickerCounts[item.ticker]` badge cells |
| 4 | Macro theme pills appear below each creator header with sentiment dot (green/amber/red) | ✓ VERIFIED | WatchListTab.tsx lines 451-472: `newsContext.macroThemes.slice(0, 3)` renders pills with sentiment color dots |
| 5 | Staleness indicator turns amber when news_cache.fetched_at > 24h ago | ✓ VERIFIED | `isNewsStale()` defined at line 69; `newsStale ? 'text-amber-400' : 'text-zinc-500'` applied at line 212 |
| 6 | Returning users see cached context immediately on page load (no blank state on first open) | ✓ VERIFIED | page.tsx lines 149-178: `news_cache` read server-side via `maybeSingle()`, `initialNewsContext` prop pre-populated from DB row before page renders |
| 7 | Claude summary never contains "advice", "recommend", or "suggest" (post-call guard throws if detected) | ✓ VERIFIED | `assertNoAdviceLanguage()` in news-actions.ts lines 80-88 called at line 156 before UPSERT; throws on any forbidden word |

**Score:** 6/7 truths verified (1 FAILED — rss-parser not installed)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pulse/src/lib/news/news-types.ts` | Shared types: FinnhubNewsItem, RssItem, NewsContextResult, NewsCacheContext | ✓ VERIFIED | All 5 exported types present; file has no runtime logic |
| `pulse/src/lib/news/finnhub.ts` | Finnhub REST fetch, server-only, throws if key missing | ✓ VERIFIED | `import 'server-only'`, key guard at line 19, `fetchFinnhubMarketNews()` exported |
| `pulse/src/lib/news/rss.ts` | RSS feed parsing via rss-parser, Promise.allSettled | ✗ STUB/BROKEN | File exists and logic is correct, but `import Parser from 'rss-parser'` (line 8) resolves to a missing package — module is unrunnable |
| `pulse/src/app/dashboard/news-actions.ts` | refreshNewsAndSummary server action with full orchestration | ✓ VERIFIED | `'use server'`, auth guard, Finnhub abort (D-12), RSS partial-fail (D-11), Claude tool_choice forced, advice-language guard, UPSERT onConflict user_id, revalidatePath |
| `pulse/src/app/dashboard/page.tsx` | news_cache pre-fetch + initialNewsContext prop | ✓ VERIFIED | Lines 89-178: `initialNewsContext` declared, `from('news_cache').maybeSingle()` query, creatorSectors from creator_strategies, prop passed to `<WatchListTab>` |
| `pulse/src/app/dashboard/components/WatchListTab.tsx` | Extended with news panel, badges, macro themes | ✓ VERIFIED | All four UI elements present and wired to `newsContext` state; no window.location.reload() |
| `pulse/tests/news-cache.test.ts` | Test stubs: TTL logic, Finnhub shape, RSS partial-failure, UPSERT uniqueness | ✓ VERIFIED | 4 describe blocks present: isCacheStale, FinnhubNewsItem shape, RSS partial failure, UPSERT uniqueness |
| `pulse/tests/news-context.test.ts` | Test stubs: Claude tool output shape, advice-language guard | ✓ VERIFIED | 3 describe blocks: NewsContextResult shape, ticker_counts keys, advice-language guard |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| news-actions.ts | lib/news/finnhub.ts | import fetchFinnhubMarketNews | ✓ WIRED | Line 17 of news-actions.ts |
| news-actions.ts | lib/news/rss.ts | import fetchRssFeeds | ✓ WIRED (code) / ✗ BROKEN (runtime) | Line 18 import present; rss.ts itself will fail to load |
| page.tsx | WatchListTab | initialNewsContext prop | ✓ WIRED | page.tsx line 273, WatchListTab accepts prop in interface |
| WatchListTab | refreshNewsAndSummary | import from @/app/dashboard/news-actions | ✓ WIRED | Line 9 of WatchListTab.tsx |
| WatchListTab ticker row | tickerCounts | newsContext.tickerCounts[item.ticker] | ✓ WIRED | Lines 336 and 541 |
| WatchListTab creator card | macroThemes | newsContext.macroThemes.slice(0, 3) | ✓ WIRED | Line 454 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| WatchListTab context panel | newsContext.contextSummary | page.tsx → news_cache Supabase query → NewsContextResult | Yes (DB read from news_cache.context JSONB) | ✓ FLOWING |
| WatchListTab news badges | newsContext.tickerCounts | same chain | Yes | ✓ FLOWING |
| WatchListTab macro themes | newsContext.macroThemes | same chain | Yes | ✓ FLOWING |
| refreshNewsAndSummary | finnhubItems | fetchFinnhubMarketNews() | Yes (live Finnhub API) | ✓ FLOWING |
| refreshNewsAndSummary | rssItems | fetchRssFeeds() | BROKEN — rss-parser not installed | ✗ DISCONNECTED |

---

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| rss-parser importable | `ls pulse/node_modules/rss-parser` | NOT FOUND | ✗ FAIL |
| rss-parser in package.json | grep in package.json dependencies | not present | ✗ FAIL |
| news-types.ts exports correct types | file read — all 5 interfaces exported | confirmed | ✓ PASS |
| finnhub.ts is server-only | `import 'server-only'` at line 7 | confirmed | ✓ PASS |
| assertNoAdviceLanguage wired before UPSERT | news-actions.ts line 156 (before line 165 upsert) | confirmed | ✓ PASS |
| news-cache.test.ts — all 4 describe blocks present | file read | confirmed | ✓ PASS |
| news-context.test.ts — advice-language guard present | file read | confirmed | ✓ PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| NEWS-01 | 13-01, 13-02 | Finnhub ticker-specific news for watch list items | ✓ SATISFIED | fetchFinnhubMarketNews() in finnhub.ts; wired in news-actions.ts |
| NEWS-02 | 13-01, 13-02 | RSS feeds (BBC Business, BoE) provide UK macro context | ✗ BLOCKED | rss.ts code correct; rss-parser package missing — runtime MODULE_NOT_FOUND |
| NEWS-03 | 13-01, 13-02 | AI cross-references news against watch list tickers and creator-backed sectors | ✓ SATISFIED | Claude generate_news_context tool in news-actions.ts with ticker_counts + macro_themes + context_summary |
| NEWS-04 | 13-01, 13-02, 13-03 | Each watch list item shows news flag with count of relevant stories | ✓ SATISFIED | newsContext.tickerCounts[item.ticker] badge in All Picks and per-creator tables |
| NEWS-05 | 13-03 | Creator card shows macro conditions for creator-backed sectors | ✓ SATISFIED | macroThemes.slice(0, 3) strip with sentiment dots below each creator header |
| NEWS-06 | 13-01, 13-02, 13-03 | "This month's context" summary: 3-4 sentences, cached, refreshed on demand | ✓ SATISFIED | Panel in WatchListTab, UPSERT in news-actions.ts, maybeSingle() pre-fetch in page.tsx |
| NEWS-07 | 13-01, 13-02 | One cache row per user; UPSERT uniqueness | ✓ SATISFIED | `onConflict: 'user_id'` in news-actions.ts line 174 |

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `pulse/src/lib/news/rss.ts` | `import Parser from 'rss-parser'` — package missing | BLOCKER | RSS feeds completely non-functional at runtime; fetchRssFeeds() is dead code until package installed |
| `pulse/package.json` | rss-parser absent from dependencies | BLOCKER | npm install will not restore the package across environments; any fresh clone or deployment will fail to start |

Note: The 13-03-SUMMARY.md mentions "4 pre-existing errors in creator-actions.ts and rss.ts" from tsc. The rss.ts TypeScript errors are likely caused by the missing rss-parser type definitions — confirming the package was never installed.

---

### Human Verification Required

None — all remaining checks are programmatic.

---

### Gaps Summary

**One root-cause gap blocking the phase goal:**

`rss-parser` was listed as a Wave 0 setup step (task 13-01-01 — "run `cd pulse && npm install rss-parser`") but was never installed. The package is absent from both `pulse/package.json` and `pulse/node_modules/`. This causes `pulse/src/lib/news/rss.ts` to be unrunnable — its top-level `import Parser from 'rss-parser'` will throw MODULE_NOT_FOUND when Next.js attempts to load the module.

Impact: NEWS-02 (RSS feeds) is blocked. The `refreshNewsAndSummary()` action calls `fetchRssFeeds()` which imports from rss.ts — this will fail at module load time in a Next.js server action context, not at the call site. The Finnhub-only fallback in news-actions.ts only catches errors thrown by `fetchFinnhubMarketNews()`, not a module resolution failure in rss.ts.

**Fix:** `cd pulse && npm install rss-parser` — takes under 30 seconds. All other phase implementation is complete and correct.

---

_Verified: 2026-05-20_
_Verifier: Claude (gsd-verifier)_
