---
phase: 13
plan: 13-03
subsystem: market-news-ui
tags: [wave-2, watchlist-tab, news-panel, news-badges, macro-themes, ui]
dependency_graph:
  requires: [13-02]
  provides: [news-ui-layer, context-panel, news-badge-column, macro-themes-strip]
  affects: []
tech_stack:
  added: []
  patterns: [useRouter-refresh, useState-news-context, css-max-h-collapse, iife-badge-render]
key_files:
  created: []
  modified:
    - pulse/src/app/dashboard/components/WatchListTab.tsx
decisions:
  - "handleRefreshNews updates local state via setNewsContext() + router.refresh() — no window.location.reload()"
  - "Pre-existing tsc errors in creator-actions.ts and rss.ts are out-of-scope (Wave 1 / prior phases); WatchListTab introduces zero new TS errors"
  - "Macro themes strip uses shared newsContext.macroThemes (not per-creator filtered) — consistent with plan spec"
metrics:
  duration: ~10m
  completed: 2026-05-20
---

# Phase 13 Plan 03: Market News Wave 2 UI Layer Summary

WatchListTab extended with four new UI elements: collapsible "This Month's Context" panel (expanded by default), inline staleness indicator (amber >24h), News badge column in all ticker tables, and macro themes strip per creator card — all driven by the `initialNewsContext: NewsCacheContext` prop from Wave 1.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 13-03-01 | Add news state, prop, helpers, handler | ee8c5ad | pulse/src/app/dashboard/components/WatchListTab.tsx |
| 13-03-02 | Add context panel, news badges, macro themes JSX | ee8c5ad | pulse/src/app/dashboard/components/WatchListTab.tsx |

## Test Results

`npx vitest run tests/news-cache.test.ts tests/news-context.test.ts` — 21 passed, 0 failed.

`npx tsc --noEmit` — 0 errors in WatchListTab.tsx or news-related files. 4 pre-existing errors in creator-actions.ts and rss.ts (out of scope, not introduced by this plan).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All UI elements wire to live newsContext state.

## Threat Surface Scan

- T-13-06: initialNewsContext is user-scoped (RLS from Wave 1) — no cross-user disclosure.
- T-13-07: Both buttons carry `disabled={newsRefreshing || refreshing}` — double-click DoS prevented.

No new threat surface introduced.

## Self-Check: PASSED

- pulse/src/app/dashboard/components/WatchListTab.tsx: FOUND, contains initialNewsContext prop, handleRefreshNews, formatRelativeTime, isNewsStale, This Month's Context, news-context-body, newsContext.macroThemes.slice, newsContext.tickerCounts
- Commit ee8c5ad: FOUND
- Vitest: 21/21 passed
- No window.location.reload() in file
