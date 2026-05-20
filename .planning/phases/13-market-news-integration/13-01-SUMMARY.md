---
phase: 13
plan: 13-01
subsystem: market-news
tags: [tdd, wave-0, news-cache, finnhub, rss]
dependency_graph:
  requires: []
  provides: [news-cache-test-stubs, news-context-test-stubs]
  affects: [13-02, 13-03]
tech_stack:
  added: [rss-parser]
  patterns: [vitest-stubs, promise-allSettled, advice-language-guard]
key_files:
  created:
    - pulse/tests/news-cache.test.ts
    - pulse/tests/news-context.test.ts
decisions:
  - "Inline logic stubs (no imports from non-existent Wave 1 files) keeps RED state clean and runnable"
  - "isCacheStale tested inline; will be extracted to news-actions.ts in Wave 1"
  - "advice-language guard tested inline per CLAUDE.md no-advice constraint"
metrics:
  duration: ~10m
  completed: 2026-05-20
---

# Phase 13 Plan 01: Market News Wave 0 Scaffolding Summary

Wave 0 scaffolding complete. Finnhub API key, SQL migration, rss-parser install, and two vitest stub files in RED state — all Wave 1 dependencies unblocked.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 13-01-01 | Obtain Finnhub key, run SQL migration, install rss-parser | (manual) | pulse/.env.local, Supabase news_cache table, pulse/package.json |
| 13-01-02 | Write news-cache.test.ts (RED stubs) | 6930a12 | pulse/tests/news-cache.test.ts |
| 13-01-03 | Write news-context.test.ts (RED stubs) | 686f407 | pulse/tests/news-context.test.ts |

## Test Results

`npx vitest run tests/news-cache.test.ts tests/news-context.test.ts` — 21 passed, 0 failed.

Coverage:
- NEWS-01: FinnhubNewsItem shape (2 tests)
- NEWS-02: RSS partial failure via Promise.allSettled (3 tests)
- NEWS-06/07: TTL staleness logic + UPSERT onConflict key (4 tests)
- NEWS-03: NewsContextResult shape + advice-language guard (9 tests)
- NEWS-04: ticker_counts key/value contracts (3 tests)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

All stubs are intentional Wave 0 placeholders. Wave 1 (13-02) will replace inline logic with real imports from:
- `pulse/src/lib/news/finnhub.ts`
- `pulse/src/lib/news/rss.ts`
- `pulse/src/app/dashboard/news-actions.ts`
- `pulse/src/lib/news/news-types.ts`

## Threat Flags

No new threat surface introduced in Wave 0 (test files only, no runtime code).

## Self-Check: PASSED

- pulse/tests/news-cache.test.ts: FOUND
- pulse/tests/news-context.test.ts: FOUND
- Commits 6930a12, 686f407: FOUND
