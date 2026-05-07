---
phase: "05-plan-generator"
plan: "04"
subsystem: "dashboard-plan-tab"
tags: ["plan-generator", "dashboard", "ui", "isa", "buy-list"]
dependency_graph:
  requires:
    - "05-01"  # is_fill_ticker schema + setFillTicker action
    - "05-02"  # generatePlan pure function
    - "05-03"  # upsertBuyList server action
  provides:
    - "plan-tab-ui"         # PlanTab, ContributionCalculator, BuyListTable components
    - "server-side-upsert"  # page.tsx calls upsertBuyList on every page load
  affects:
    - "dashboard-page"      # page.tsx extended with 4th tab + always-fetch
tech_stack:
  added: []
  patterns:
    - "useMemo for client-side plan recompute (no network call)"
    - "server component calls server action directly (upsertBuyList)"
    - "always-fetch pattern — holdings + ISA contributions ungated from tab"
key_files:
  created:
    - "pulse/src/app/dashboard/components/BuyListTable.tsx"
    - "pulse/src/app/dashboard/components/ContributionCalculator.tsx"
    - "pulse/src/app/dashboard/components/PlanTab.tsx"
  modified:
    - "pulse/src/app/dashboard/page.tsx"
decisions:
  - "void upsertBuyList — fire-and-forget from server component; non-blocking"
  - "ContributionCalculator uses useMemo keyed on [portfolio, budget, strategy, isaRemaining] — pure client-side recompute"
  - "holdings + ISA contributions always fetched regardless of active tab (Pitfall 3)"
  - "creators/blend fetch runs for both creators and plan tabs"
metrics:
  duration_minutes: 15
  completed_date: "2026-05-07"
  tasks_completed: 2
  tasks_total: 3
  files_created: 3
  files_modified: 1
---

# Phase 5 Plan 04: Dashboard Plan Tab Summary

Dashboard Plan tab wired end-to-end: three client components (BuyListTable, ContributionCalculator, PlanTab) + page.tsx extended with always-fetch, server-side plan generation, and upsertBuyList call on every page load.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create BuyListTable, ContributionCalculator, PlanTab | d290c89 | BuyListTable.tsx, ContributionCalculator.tsx, PlanTab.tsx |
| 2 | Extend page.tsx — Plan tab, always-fetch, generation + upsert | 87ae5fc | page.tsx |
| 3 | Human verify — smoke test | checkpoint | awaiting |

## What Was Built

### BuyListTable.tsx
Renders all three `PlanResult` variants:
- `no-strategy`: placeholder card — "Refresh a creator to generate your first Buy List."
- `no-fill-tickers`: amber banner + gap rows per category
- `buy-list`: ISA warning (amber banner when `isaWarning`), buy items table (Ticker / Category / Amount / Gap Closed), gap rows, PLAN-04 disclaimer

### ContributionCalculator.tsx
Slider (£200–£1000, step 1) + numeric input. `useState(initialBudget)` initialised from `monthly_budget` or 500 fallback (D-11). `useMemo(() => generatePlan(...), [portfolio, budget, strategy, isaRemaining])` — pure client-side recompute, no network call (D-12).

### PlanTab.tsx
Thin `'use client'` wrapper. Renders heading + `ContributionCalculator` with server-fetched props.

### page.tsx changes
1. `Tab` extended to include `'plan'`
2. Tab validation array updated
3. Holdings fetch: conditional `if (activeTab === 'portfolio')` gate removed — always fetched
4. ISA contributions fetch: conditional `if (activeTab === 'isa')` gate removed — always fetched
5. `is_fill_ticker` included in holdings SELECT; `isFillTicker: row.is_fill_ticker as boolean` in mapping
6. Creators/blend fetch now runs for `'creators' || 'plan'` (was `'creators'` only)
7. Server-side `generatePlan` call with `effectiveBudget = Decimal.min(budget, isaRemaining)`
8. `void upsertBuyList(serverPlanResult)` — fire-and-forget persist on every page load
9. `{ id: 'plan', label: 'Plan' }` added to tabs array
10. `{activeTab === 'plan' && <PlanTab ... />}` added to JSX

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `cd pulse && npx tsc --noEmit` — exits 0 (only pre-existing `creator-actions.ts` errors unrelated to this plan)
- `cd pulse && npx vitest run` — 52/52 tests pass, 5/5 test files pass
- `grep "Creator-derived information — not financial advice" BuyListTable.tsx` — 2 matches (no-fill-tickers + buy-list variants)
- `grep "useMemo" ContributionCalculator.tsx` — 1 match
- `grep "generatePlan" ContributionCalculator.tsx` — 1 match
- `grep "isFillTicker.*row.is_fill_ticker" page.tsx` — 1 match
- Human smoke test: awaiting (Task 3 checkpoint)

## Known Stubs

None — all data flows are wired. `ContributionCalculator` receives live `portfolio`, `strategy`, `isaRemaining` from server. `BuyListTable` renders actual `PlanResult`.

## Self-Check: PASSED

Files exist:
- pulse/src/app/dashboard/components/BuyListTable.tsx — FOUND
- pulse/src/app/dashboard/components/ContributionCalculator.tsx — FOUND
- pulse/src/app/dashboard/components/PlanTab.tsx — FOUND

Commits exist:
- d290c89 — feat(05-04): create BuyListTable, ContributionCalculator, PlanTab components
- 87ae5fc — feat(05-04): extend page.tsx with Plan tab, always-fetch, server-side generation
