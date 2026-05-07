---
phase: 05-plan-generator
plan: 03
subsystem: plan-generator
tags: [typescript, server-actions, supabase, react, portfolio-ui, fill-ticker, buy-list]

# Dependency graph
requires:
  - phase: 05-plan-generator
    plan: 01
    provides: "is_fill_ticker column + Holding.isFillTicker type"
  - phase: 05-plan-generator
    plan: 02
    provides: "PlanResult and BuyListItem types from generator.ts"

provides:
  - pulse/src/app/dashboard/plan-actions.ts — upsertBuyList and setFillTicker server actions
  - pulse/src/components/PortfolioTab.tsx — fill-ticker toggle button per holding row

affects:
  - 05-04 (ContributionCalculator will call upsertBuyList after generatePlan)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - createClient() for auth check + createServiceClient() for DB write (same as saveCreatorWeight)
    - Decimal.toFixed(2) serialization before JSONB upsert
    - useTransition (startT) for non-blocking server action calls in client component
    - onConflict: 'user_id,month' upsert for one-plan-per-user-per-month invariant

key-files:
  created:
    - pulse/src/app/dashboard/plan-actions.ts
  modified:
    - pulse/src/components/PortfolioTab.tsx

key-decisions:
  - "setFillTicker two-step write: clear old fill ticker first then set new — prevents partial unique index violation on holdings_one_fill_ticker_per_category"
  - "upsertBuyList passes unified_allocation as empty object — placeholder for Wave 3 which will supply blended strategy"
  - "Star toggle (★/☆) at end of holding row (before Edit/Delete) — consistent with existing right-side action cluster"
  - "fillTickerState error display below holdings list — matches deleteState pattern already in file"

metrics:
  duration: "~10 minutes"
  completed: "2026-05-07"
  tasks_completed: 2
  files_changed: 2
---

# Phase 05 Plan 03: Server Actions and Fill-Ticker Toggle Summary

plan-actions.ts server actions for buy list persistence and fill-ticker management, plus PortfolioTab star toggle UI.

## What Was Built

**`pulse/src/app/dashboard/plan-actions.ts`** — two server actions following the `saveCreatorWeight` pattern:

- `upsertBuyList(result: PlanResult)`: persists buy-list to `buy_lists` table. Serializes `amountGbp` and `effectiveBudget` via `.toFixed(2)` before JSONB insert. Upserts on `(user_id, month)` conflict key — D-07 one-plan-per-user-per-month invariant.
- `setFillTicker(holdingId, category)`: two-step write — clears existing fill ticker for user+category (`is_fill_ticker=false`), then sets new one (`is_fill_ticker=true`). Both writes scoped with `.eq('user_id', user.id)`.

**`pulse/src/components/PortfolioTab.tsx`** — extended with:
- Import of `setFillTicker` from `plan-actions`
- `handleSetFillTicker` using existing `startT` (useTransition)
- Star toggle button (★ indigo / ☆ zinc) per holding row with 44px touch target
- `fillTickerState` error display below holdings list

## Task Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Create plan-actions.ts | `1de5d14` |
| 2 | Add fill-ticker toggle to PortfolioTab | `31d12cb` |

## Verification Results

- `tsc --noEmit`: exits 0 (only pre-existing `creator-actions.ts` errors, unchanged)
- `vitest run`: 52/52 tests pass (5 test files)
- All acceptance criteria met

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- `unified_allocation: {}` in `upsertBuyList` — placeholder. Wave 3 (05-04) will pass the real blended strategy. Intentional per plan spec ("Wave 3 integration").

## Threat Flags

No new network endpoints or auth paths beyond those in the plan's threat model.

Threat mitigations confirmed:
- T-05-03-01: `.eq('user_id', user.id)` on both holdings UPDATE queries in `setFillTicker`
- T-05-03-02: `user.id` from server-authoritative `getUser()` in `upsertBuyList` — client cannot spoof user_id
- T-05-03-03: `effectiveBudget` comes from `PlanResult` (computed by generator from DB values in Wave 3 flow)

## Self-Check

- [x] `pulse/src/app/dashboard/plan-actions.ts` exists
- [x] `upsertBuyList` exported
- [x] `setFillTicker` exported
- [x] `onConflict: 'user_id,month'` present
- [x] `toFixed(2)` used for both `amountGbp` (per item) and `effectiveBudget`
- [x] `is_fill_ticker: false` clear step present before `is_fill_ticker: true` set step
- [x] `.eq('user_id', user.id)` appears 3 times (upsertBuyList + 2 in setFillTicker)
- [x] `setFillTicker` imported and used 7 times in PortfolioTab
- [x] `isFillTicker` used for conditional render in PortfolioTab
- [x] `useTransition` present in PortfolioTab
- [x] Task 1 commit `1de5d14` exists
- [x] Task 2 commit `31d12cb` exists
- [x] 52/52 vitest tests pass

## Self-Check: PASSED
