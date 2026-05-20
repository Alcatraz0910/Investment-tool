---
phase: 13
plan: 13-02
subsystem: market-news
tags: [wave-1, finnhub, rss, claude-tool-use, news-cache, server-action]
dependency_graph:
  requires: [13-01]
  provides: [news-data-layer, refreshNewsAndSummary, initialNewsContext-prop]
  affects: [13-03]
tech_stack:
  added: []
  patterns: [claude-tool-choice, promise-allSettled, supabase-upsert, server-only, advice-language-guard]
key_files:
  created:
    - pulse/src/lib/news/news-types.ts
    - pulse/src/lib/news/finnhub.ts
    - pulse/src/lib/news/rss.ts
    - pulse/src/app/dashboard/news-actions.ts
  modified:
    - pulse/src/app/dashboard/page.tsx
decisions:
  - "general market-news endpoint used (not company-news) per RESEARCH.md Pitfall 1 — LSE free-tier coverage unreliable"
  - "8s timeout on rss-parser per RESEARCH.md Pitfall 6 and CONTEXT.md Claude's discretion"
  - "assertNoAdviceLanguage() throws before UPSERT to enforce CLAUDE.md no-advice constraint"
  - "page.tsx reads creator_strategies.profile_stable sector_focus to resolve RESEARCH.md open Q3"
  - "TypeScript error on WatchListTab initialNewsContext prop is expected; WatchListTab not yet updated (Wave 2)"
metrics:
  duration: ~15m
  completed: 2026-05-20
---

# Phase 13 Plan 02: Market News Wave 1 Data Layer Summary

Complete server-side news pipeline: Finnhub REST fetch + BBC/BoE RSS via rss-parser + Claude forced tool-use structured output + Supabase UPSERT, with page.tsx extended to pre-fetch cached news context and sector hints for WatchListTab.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 13-02-01 | Create lib/news/news-types.ts | 3ffa242 | pulse/src/lib/news/news-types.ts |
| 13-02-02 | Create finnhub.ts and rss.ts | c095ab0 | pulse/src/lib/news/finnhub.ts, pulse/src/lib/news/rss.ts |
| 13-02-03 | Create news-actions.ts and extend page.tsx | 4fcecb5 | pulse/src/app/dashboard/news-actions.ts, pulse/src/app/dashboard/page.tsx |

## Test Results

`npx vitest run tests/news-cache.test.ts tests/news-context.test.ts` — 21 passed, 0 failed.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All files contain real implementation logic.

## Threat Surface Scan

All T-13-01 through T-13-05 mitigations applied:
- T-13-01: RLS on news_cache enforced by Wave 0 migration
- T-13-02: `import 'server-only'` in finnhub.ts prevents key leakage
- T-13-03: `tool_choice: { type: 'tool' }` forces structured output; headlines passed as numbered data
- T-13-04: `assertNoAdviceLanguage()` throws before UPSERT
- T-13-05: `supabase.auth.getUser()` check at action entry

No new threat surface introduced beyond the plan's threat register.

## Self-Check: PASSED

- pulse/src/lib/news/news-types.ts: FOUND
- pulse/src/lib/news/finnhub.ts: FOUND
- pulse/src/lib/news/rss.ts: FOUND
- pulse/src/app/dashboard/news-actions.ts: FOUND
- pulse/src/app/dashboard/page.tsx: MODIFIED (contains initialNewsContext, from('news_cache'), maybeSingle, creatorSectors)
- Commits 3ffa242, c095ab0, 4fcecb5: FOUND
- Vitest: 21/21 passed
