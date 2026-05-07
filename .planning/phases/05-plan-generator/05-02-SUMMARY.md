---
phase: 05-plan-generator
plan: 02
subsystem: plan-generator
tags: [typescript, vitest, decimal.js, tdd, pure-function, isa, buy-list]

# Dependency graph
requires:
  - phase: 05-plan-generator
    plan: 01
    provides: "Holding.isFillTicker and BuyListItem.allocationGapPct types"

provides:
  - pulse/src/lib/plan/generator.ts — generatePlan pure function
  - pulse/src/lib/plan/generator.test.ts — 18 vitest tests covering all 5 requirements
  - PlanResult, BuyListItem, GapRow, HoldingWithFillTicker exported types
  - ISA-capped proportional buy list with penny-exact rounding

affects:
  - 05-03 (server action uses generatePlan)
  - 05-04 (ContributionCalculator uses generatePlan in browser)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD RED/GREEN cycle with vitest globals (describe/it/expect, no import needed)
    - Decimal.min for ISA cap, last-item rounding diff to guarantee exact sum
    - Discriminated union PlanResult for type-safe caller handling
    - vitest/globals added to tsconfig types to fix tsc --noEmit on test files

key-files:
  created:
    - pulse/src/lib/plan/generator.ts
    - pulse/src/lib/plan/generator.test.ts
  modified:
    - pulse/tsconfig.json

key-decisions:
  - "generatePlan takes HoldingWithFillTicker (subset of Holding) so it can be called with plain objects in tests without mocking the full Holding type"
  - "last-item absorbs rounding diff (not first) to preserve ordering by gap size — largest gap item gets extra penny"
  - "tsconfig types array set to vitest/globals so tsc --noEmit passes on test files (deviation Rule 3)"
  - "creator-actions.ts pre-existing TS errors are out of scope and deferred"

patterns-established:
  - "Pure functions in lib/ have zero server-only imports — safe for both server and client contexts"
  - "Discriminated union PlanResult makes all edge cases explicit at the call site"

metrics:
  duration: "~12 minutes"
  completed: "2026-05-07"
  tasks_completed: 2
  files_changed: 3
---

# Phase 05 Plan 02: generatePlan Pure Function Summary

Pure ISA-capped buy list generator implemented via TDD — proportional gap allocation with Decimal arithmetic and full vitest coverage.

## What Was Built

`pulse/src/lib/plan/generator.ts` — pure TypeScript function with zero server-only imports. Accepts current holdings, monthly budget, blended strategy, and ISA remaining allowance; returns a `PlanResult` discriminated union covering all five plan requirements.

**Algorithm:**
1. Guard: return `no-strategy` if strategy is null or empty
2. `effectiveBudget = Decimal.min(budget, isaRemaining)` — ISA cap (ISA-02)
3. For each category in strategy: compute gap = target − current; emit GapRow for missing/unflagged categories
4. Allocate effectiveBudget proportionally to gaps; last item absorbs rounding diff
5. Return `buy-list` | `no-fill-tickers` | `no-strategy` based on state

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (failing tests) | `94d0492` | PASS — `Cannot find module './generator'` |
| GREEN (all pass) | `cb17e73` | PASS — 18/18 vitest tests |
| REFACTOR | — | Skipped — no cleanup needed |

## Test Coverage

| Requirement | Test Cases | Status |
|-------------|-----------|--------|
| PLAN-01: sum == effectiveBudget | 3 (normal, ISA cap, odd split) | PASS |
| PLAN-02: allocationGapPct correct | 1 | PASS |
| PLAN-03: strategy update → new items | 1 (80/20 switch) | PASS |
| PLAN-04: no advice language | 3 (advice/recommend/suggest) | PASS |
| ISA-02: isaWarning + effectiveBudget cap | 3 | PASS |
| D-03: no-fill-ticker GapRow | 1 | PASS |
| D-04: no-holdings GapRow | 1 | PASS |
| D-08: no-fill-tickers result | 1 | PASS |
| Rounding: last-item diff | 1 | PASS |
| **Total** | **18** | **18/18 PASS** |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added vitest/globals to tsconfig types**
- **Found during:** Verification (`npx tsc --noEmit`)
- **Issue:** vitest globals (describe/it/expect) had no TypeScript type declarations; tsc emitted TS2582 errors across all test files
- **Fix:** Added `"types": ["vitest/globals"]` to `pulse/tsconfig.json` compilerOptions
- **Files modified:** pulse/tsconfig.json
- **Commit:** cb17e73

### Out-of-Scope Pre-existing Issues (deferred)

**creator-actions.ts TS errors** — `channel_url` and `.id` type errors at lines 93, 100. Pre-existing, not caused by this plan. Deferred.

## Known Stubs

None — generator produces real calculated output from inputs.

## Threat Surface Scan

No new network endpoints or auth paths introduced. generator.ts is a pure function with no I/O. Threat mitigations T-05-02-01 and T-05-02-02 confirmed implemented:
- T-05-02-01: generator accepts what caller passes (server action in Wave 2 re-reads budget from DB)
- T-05-02-02: rationale template verified to contain no prohibited language (PLAN-04 tests pass)

## Self-Check

- [x] `pulse/src/lib/plan/generator.ts` exists
- [x] `pulse/src/lib/plan/generator.test.ts` exists (313 lines > 80 minimum)
- [x] RED commit `94d0492` exists
- [x] GREEN commit `cb17e73` exists
- [x] 18/18 vitest tests pass
- [x] Zero server-only imports in generator.ts
- [x] Exports: `generatePlan`, `PlanResult`, `BuyListItem`, `GapRow`, `HoldingWithFillTicker`
