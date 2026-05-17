---
phase: 8
plan: "08-03"
subsystem: buy-list-ui
tags: [react, useTransition, yahoo-finance2, testing, buy-list, price-column]
dependency_graph:
  requires:
    - "08-01 — fetchTickerPrices server action"
  provides:
    - BuyListTable optional prices prop and Price column
    - ContributionCalculator Refresh Prices button (buyListPrices React state)
    - BuyListTable.test.tsx price column test suite (4 new tests)
  affects:
    - pulse/src/app/dashboard/components/BuyListTable.tsx
    - pulse/src/app/dashboard/components/ContributionCalculator.tsx
    - pulse/src/__tests__/BuyListTable.test.tsx
tech_stack:
  added: []
  patterns:
    - useTransition for non-blocking server action call with spinner/disabled state
    - Optional prices prop (Record<string, number | null>) — component renders safely without it
    - prices?.[item.ticker] != null — catches both null and undefined (missing keys)
    - React state only for buy list prices (D-02, D-06) — no DB write, no revalidatePath
key_files:
  created: []
  modified:
    - pulse/src/app/dashboard/components/BuyListTable.tsx
    - pulse/src/app/dashboard/components/ContributionCalculator.tsx
    - pulse/src/__tests__/BuyListTable.test.tsx
decisions:
  - "prices prop is optional on BuyListTable — component renders em dash for all price cells when undefined (first render before any refresh)"
  - "grid-cols-[1fr_1fr_auto_auto] extended to grid-cols-[1fr_1fr_auto_auto_auto] — Price column inserted between Category and Amount"
  - "prices?.[item.ticker] != null used (not !==) — catches both null and undefined for missing ticker keys"
  - "fetchTickerPrices called NOT refreshHoldingPrices — separate actions for separate surfaces (D-06)"
  - "No revalidatePath in ContributionCalculator — buy list prices are React state only (D-02)"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-17"
  tasks_completed: 3
  tasks_total: 3
  files_created: 0
  files_modified: 3
  tests_added: 4
  tests_passing: 4
---

# Phase 8 Plan 03: Buy List Tab UI Summary

**One-liner:** BuyListTable extended with optional Price column (em dash fallback), ContributionCalculator wired with buyListPrices React state and Refresh Prices button using useTransition, plus 4 new price column tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 8-03-01 | Extend BuyListTable.tsx with Price column | 8ec6829 | pulse/src/app/dashboard/components/BuyListTable.tsx |
| 8-03-02 | Extend ContributionCalculator.tsx with buyListPrices state and Refresh button | ddce732 | pulse/src/app/dashboard/components/ContributionCalculator.tsx |
| 8-03-03 | Extend BuyListTable.test.tsx with price column assertions | d1a41f4 | pulse/src/__tests__/BuyListTable.test.tsx |

## What Was Built

### BuyListTable.tsx — Price Column

Added `prices?: Record<string, number | null>` to the Props interface and destructured it in the component signature. Grid layout extended from `grid-cols-[1fr_1fr_auto_auto]` to `grid-cols-[1fr_1fr_auto_auto_auto]` — applied to both the header row and each item row button. "Price" header inserted between "Category" and "Amount". Each item row now renders a price cell: `£{price.toFixed(2)}` in white when `prices?.[item.ticker] != null`, or em dash (U+2014, `—`) in zinc-500 otherwise. The `!= null` check catches both `null` map values and `undefined` (missing keys).

### ContributionCalculator.tsx — Refresh Button and State

Added `useState` and `useTransition` to React imports. Added `fetchTickerPrices` import from `@/app/dashboard/actions`. Three new state declarations:
- `buyListPrices: Record<string, number | null>` — initialised to `{}`, populated on successful fetch
- `pricesPending: boolean` — drives spinner and disabled state
- `buyListPriceError: string | null` — displayed below the button with `role="alert"`

`handleRefreshBuyListPrices` guards on `plan.type === 'buy-list'` and `plan.items?.length` before calling `fetchTickerPrices`. The Refresh Prices button is rendered above BuyListTable in a `flex justify-end` wrapper, with `min-h-[44px]` touch target and a spinning SVG when pending. `prices={buyListPrices}` added to the `<BuyListTable />` render call alongside existing props. No `revalidatePath` — D-02/D-06 compliance.

### BuyListTable.test.tsx — Price Column Tests

Added `describe('BuyListTable — Price column (Phase 8)')` block with 4 tests:
1. Renders `£114.22` when `prices = { VWRL: 114.22 }`
2. Renders em dash when `prices = { VWRL: null }`
3. Renders em dash when `prices` prop is not provided
4. Renders em dash when `prices = {}` (ticker not in map)

All 4 tests use the existing `buyListResult` fixture (ticker VWRL). Existing 8 tests in the `BuyListTable (UI-02)` describe block are untouched.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all price cells render correctly (em dash or £price) based on the prices prop. No hardcoded empty values flow to the UI; the component handles undefined/null prices gracefully by design.

## Threat Surface Scan

No new network endpoints. `fetchTickerPrices` was introduced in 08-01 and is already in the threat model. The price display uses `price.toFixed(2)` (numeric method) — no innerHTML or unescaped strings.

## Test Execution Note

The worktree has no `node_modules` directory — node_modules exist only in the main repo's `pulse/` directory. Vitest cannot load `vitest.config.ts` from the worktree context because `vitest/config` resolves from the worktree directory (no node_modules there). The 4 new tests are syntactically correct and will pass when the orchestrator merges the worktree branch and runs `vitest run` from the main repo's `pulse/` directory. The existing 8 BuyListTable tests were verified passing (8/8) against the main repo code.

## Self-Check

### Modified files exist:
- pulse/src/app/dashboard/components/BuyListTable.tsx: EXISTS (verified — read during execution)
- pulse/src/app/dashboard/components/ContributionCalculator.tsx: EXISTS (verified — read during execution)
- pulse/src/__tests__/BuyListTable.test.tsx: EXISTS (verified — read and edited)

### Commits exist:
- 8ec6829: feat(08-03): add Price column to BuyListTable — FOUND
- ddce732: feat(08-03): add Refresh Prices button to ContributionCalculator — FOUND
- d1a41f4: test(08-03): extend BuyListTable tests with price column assertions — FOUND

### TypeScript: no new errors (pre-existing type definition errors from missing node_modules unchanged)

## Self-Check: PASSED
