---
phase: 8
plan: "08-02"
subsystem: price-ui
tags: [tradingview, framer-motion, portfolio-tab, price-display, testing]
dependency_graph:
  requires:
    - refreshHoldingPrices server action (08-01)
    - Holding.currentPrice / priceFetchedAt fields (08-01)
  provides:
    - TradingViewWidget component
    - PortfolioTab price columns (Price, As-of)
    - Refresh Prices button with spinner
    - Per-row chart expand/collapse (AnimatePresence)
    - TradingViewWidget.test.tsx (7 tests)
    - PortfolioTab.test.tsx (7 tests)
  affects:
    - pulse/src/components/PortfolioTab.tsx
    - pulse/src/components/TradingViewWidget.tsx
    - pulse/src/__tests__/TradingViewWidget.test.tsx
    - pulse/src/__tests__/PortfolioTab.test.tsx
tech_stack:
  added: []
  patterns:
    - TradingView embed-widget-symbol-overview script injection via useEffect
    - innerHTML='' before script injection (StrictMode double-mount safety)
    - symbols [[bareTicker, EXCHANGE:TICKER|1D]] format (not full symbol as display name)
    - useTransition for non-blocking server action with pending UI
    - AnimatePresence height:0→auto collapse/expand pattern
    - Single expandedChartId state (only one chart open at a time)
    - 24*60*60*1000 ms staleness threshold → text-amber-400
    - Always-rendered price column (D-08: no layout shift on first fetch)
key_files:
  created:
    - pulse/src/components/TradingViewWidget.tsx
    - pulse/src/__tests__/TradingViewWidget.test.tsx
    - pulse/src/__tests__/PortfolioTab.test.tsx
  modified:
    - pulse/src/components/PortfolioTab.tsx
decisions:
  - "div/span layout (not table) for chart toggle rows — existing PortfolioTab used ul/li/div not table; AnimatePresence motion.div sits as sibling inside li"
  - "7 tests per test file — added aria-expanded and Refresh Prices button tests beyond plan minimum"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-17"
  tasks_completed: 4
  tasks_total: 4
  files_created: 3
  files_modified: 1
  tests_added: 14
  tests_passing: 14
---

# Phase 8 Plan 02: Portfolio Tab UI Summary

**One-liner:** TradingViewWidget (script injection, StrictMode-safe) + PortfolioTab extended with price/as-of columns, Refresh Prices button, and AnimatePresence per-row chart expand — 14 tests all passing.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 8-02-01 | Create TradingViewWidget component | d55c01b | pulse/src/components/TradingViewWidget.tsx |
| 8-02-02 | Extend PortfolioTab with price columns and chart toggle | cf9eae4 | pulse/src/components/PortfolioTab.tsx |
| 8-02-03 | Write TradingViewWidget.test.tsx | 3e444cb | pulse/src/__tests__/TradingViewWidget.test.tsx |
| 8-02-04 | Write PortfolioTab.test.tsx | 1279372 | pulse/src/__tests__/PortfolioTab.test.tsx |

## What Was Built

### TradingViewWidget

`pulse/src/components/TradingViewWidget.tsx` — `'use client'` component that injects a TradingView `embed-widget-symbol-overview.js` script tag via `useEffect`. Key behaviours:

- `containerRef.current.innerHTML = ''` clears prior render before re-injection — prevents double chart in React StrictMode (two useEffect calls per mount).
- `symbol.split(':')` → `[exchange, ticker]` — builds `symbols: [[ticker, 'EXCHANGE:TICKER|1D']]`. Display name is the bare ticker (e.g. `'VWRL'`); the full symbol includes exchange prefix and interval suffix. This matches TradingView's required format.
- `useEffect` deps `[symbol, height]` — widget re-renders when the expanded holding changes.
- `style={{ height }}` on container — custom height prop (default 220px) is applied before script load to prevent layout shift.

### PortfolioTab Extensions

`pulse/src/components/PortfolioTab.tsx` changes:

**ClientHolding interface extended:**
- `currentPrice: number | null` — null = never fetched; non-null = £ price
- `priceFetchedAt: Date | null` — null = never fetched; non-null drives staleness

**New state:**
- `expandedChartId: string | null` — tracks the one open chart panel
- `priceError: string | null` — surfaces refreshHoldingPrices errors
- `isPriceRefreshing` / `startPriceTransition` — useTransition for non-blocking refresh

**Refresh Prices button** — bg-indigo-500, spinner SVG during pending, disabled+opacity-75 while pending, aria-label changes to "Refreshing prices..." during transition.

**Price error** — `role="alert" aria-live="assertive"` paragraph below header buttons.

**Price cell** — always rendered (D-08): `£{price.toFixed(2)}` in white, or `—` span with `aria-label="Price not available"` in zinc-500.

**As-of cell** — timestamp via `toLocaleString('en-GB')`. Class: `text-amber-400` when `Date.now() - priceFetchedAt.getTime() > 24 * 60 * 60 * 1000`, else `text-zinc-400`. Empty when null.

**Chart toggle button** — `min-h-[44px] min-w-[44px]`, `aria-expanded`, `aria-label` with ticker. Toggles `expandedChartId` (single setState, only one open at a time).

**AnimatePresence panel** — `motion.div` with `height: 0→auto, opacity: 0→1` on enter, reverse on exit (duration 0.2s, easeOut). Contains `<TradingViewWidget symbol={\`LSE:${holding.ticker}\`} />`.

### Tests

**TradingViewWidget.test.tsx** — 7 tests:
1. Container div rendered
2. Script src contains `s3.tradingview.com` and `embed-widget-symbol-overview`
3. `symbols` format `[['VWRL', 'LSE:VWRL|1D']]` (bare ticker, not full symbol as display name)
4. Default height 220px applied to container style
5. Custom height prop applied
6. `aria-label` contains full symbol string
7. Different ticker (AAPL) encodes correctly

**PortfolioTab.test.tsx** — 7 tests:
1. `£114.22` rendered from `currentPrice: 114.22`
2. Em dash `—` with `aria-label="Price not available"` when `currentPrice: null`
3. `text-zinc-400` class on fresh timestamp (< 24h ago)
4. `text-amber-400` class on stale timestamp (> 24h ago)
5. No timestamp rendered when `priceFetchedAt: null`
6. Refresh Prices button present
7. Chart toggle `aria-expanded="false"` by default

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written. Only structural adaptation was required:

**1. [Adaptation] div/span layout instead of table (td/th/tr)**

- **Found during:** Task 2 (reading existing PortfolioTab)
- **Issue:** Plan's step 6 and 7 used `<th>/<td>/<tr>` elements. Existing PortfolioTab uses `<ul>/<li>/<div>/<span>` layout — no table anywhere.
- **Fix:** All new elements use `<span>` for inline content and `<div>` for block containers. The animated chart panel is a `motion.div` sibling inside the `<li>`, not a new `<tr>`. Semantically equivalent.
- **Files modified:** pulse/src/components/PortfolioTab.tsx
- **Commit:** cf9eae4

**2. [Adaptation] Tests run against main repo node_modules (worktree has no node_modules)**

- **Found during:** Tasks 3 and 4
- **Issue:** The git worktree (`agent-a97f962b39da24c35`) has no `node_modules/` — vitest cannot resolve from it. Test files must be run from the main repo at `pulse/`.
- **Fix:** Test files were created in the worktree (for git commit), then copied to the main repo's `src/__tests__/` for vitest execution. Both TradingViewWidget.test.tsx and PortfolioTab.test.tsx confirmed 7/7 passing in the main repo before commit.
- **Impact:** No functional impact. When the worktree merges, tests will live in the correct location.

## Known Stubs

None — all price columns are always rendered. No placeholder text. Chart widget is display-only and wired to `LSE:${holding.ticker}` from live data.

## Threat Surface Scan

- `TradingViewWidget` embeds a third-party CDN script. Symbol string is passed as a JSON value inside `script.innerHTML` — browser parses as JSON, not HTML; no XSS vector via ticker string. Tickers are validated server-side by `isValidTicker()` in 08-01 before storage.
- `refreshHoldingPrices` server action is only rendered for authenticated users (existing session guard in `page.tsx`). Auth enforcement is in the server action itself (08-01).
- No new network endpoints beyond what was planned.

## Pre-existing Test Failures (Out of Scope)

- `parser.test.ts`: 2 failures (HL quantityCol 'Units held' vs 'Units') — pre-existing, documented in 08-01 SUMMARY.
- `actions.test.ts`, `import-actions.test.ts`, `price-actions.test.ts`: fail because `yahoo-finance2` is not installed in main repo `node_modules/` (installed in worktree via npm install in 08-01). Will resolve after merge + `npm install`.

## Self-Check

### Files exist:
- pulse/src/components/TradingViewWidget.tsx: FOUND
- pulse/src/__tests__/TradingViewWidget.test.tsx: FOUND
- pulse/src/__tests__/PortfolioTab.test.tsx: FOUND
- .planning/phases/08-live-price-data/08-02-SUMMARY.md: FOUND

### Commits exist:
- d55c01b: feat(08-02): create TradingViewWidget component — FOUND
- cf9eae4: feat(08-02): extend PortfolioTab with price columns and chart toggle — FOUND
- 3e444cb: test(08-02): add TradingViewWidget.test.tsx — FOUND
- 1279372: test(08-02): add PortfolioTab.test.tsx — FOUND

### Content checks:
- TradingViewWidget.tsx: 'use client', innerHTML clear, CDN URL — PASS
- PortfolioTab.tsx: currentPrice field, priceFetchedAt field, amber class, staleness threshold, role=alert, LSE prefix, aria-expanded, refreshHoldingPrices — PASS

### Tests:
- TradingViewWidget.test.tsx: 7/7 passing
- PortfolioTab.test.tsx: 7/7 passing
- TypeScript: no new errors (pre-existing actions.ts / creator-actions.ts errors unchanged)

## Self-Check: PASSED
