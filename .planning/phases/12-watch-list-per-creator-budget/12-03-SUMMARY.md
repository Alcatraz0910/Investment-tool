---
plan: 12-03
phase: 12-watch-list-per-creator-budget
status: complete
completed: 2026-05-20
---

# Plan 12-03: WatchListTab + page.tsx Rewire + Dead Code Removal — Summary

## What Was Built

### `pulse/src/app/dashboard/components/WatchListTab.tsx`
- Full `'use client'` component with per-creator glassmorphism cards
- Budget display/edit: inline number input, Save Budget / Discard Changes, persisted via `saveCreatorMonthlyBudget`
- Refresh Prices: calls `fetchTickerPrices`, stores prices + currencies + previous prices; price-change % indicators (green/red arrows) on second refresh
- TradingView ticker links: LSE-prefixed for GBP stocks, bare symbol for US stocks
- Conviction badges (High/Medium/Low) and Signal pills (Established / This Month)
- Qty + Spend columns via `calcShareQuantity` (Decimal.floor — whole shares only)
- "All Picks" merged section at top via `buildMergedWatchList` (deduped across creators)
- Stale price detection (>24h → amber colour + tooltip)
- Accessibility: `role="alert"`, `aria-live`, `aria-label` on all price/qty cells, `sr-only` label on budget input, `min-h-[44px]` touch targets
- Disclaimer footer: exact copy from UI-SPEC.md; no advice/recommend/suggest language

### `pulse/src/app/dashboard/page.tsx`
- Tab type reduced to `'portfolio' | 'watchlist'` (Creators moved to `/dashboard/creators` standalone page in Phase 11)
- ISA tab, Plan tab, Buy List tab removed
- `isa_contributions` query removed; `generatePlan` call removed
- Added: creator profile fetch (`profile_stable`, `profile_latest`), `buildWatchLists` call, `WatchListTab` render
- `monthly_budget_gbp` added to `user_creators` select

### Dead code deleted (5 files)
- `pulse/src/app/dashboard/isa-tab.tsx`
- `pulse/src/app/dashboard/isa-actions.ts`
- `pulse/src/app/dashboard/components/PlanTab.tsx`
- `pulse/src/app/dashboard/components/ContributionCalculator.tsx`
- `pulse/src/app/dashboard/components/BuyListTable.tsx`

## Deviation from Plan

WL-01 specified "Portfolio | Creators | Watch List" tab bar. Implementation has "Portfolio | Watch List" with Creators as a separate page (`/dashboard/creators`). This was an existing Phase 11 architectural decision — accepted by user, not a regression.

## Verification

- `npx tsc --noEmit` — only pre-existing errors in `creator-actions.ts` (TS2353/TS2339, carried from v1.0)
- `npx vitest run tests/watch-actions.test.ts` — passes
- Full vitest suite: 4 failing files are pre-existing (Phase 7 CSV, Phase 8 price-actions, Phase 8 PortfolioTab, Phase 11 extractor) — all pre-date Phase 12
- Visual verification: approved 2026-05-20

## Self-Check: PASSED
