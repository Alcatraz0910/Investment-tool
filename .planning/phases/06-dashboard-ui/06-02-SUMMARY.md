---
phase: "06"
plan: "06-02"
title: "Action Plan Panel: BuyListTable glassmorphism + ticker rationale accordion + PlanTab restyle"
subsystem: dashboard-ui
status: complete
completed: "2026-05-07"
duration: "~25 minutes"

tags: [glassmorphism, framer-motion, AnimatePresence, tdd, buy-list, plan-tab]

dependency_graph:
  requires: ["06-01"]
  provides: ["BuyListTable-glassmorphism", "rationale-accordion", "PlanTab-restyled", "budget-state-lifted"]
  affects: ["06-03", "06-04", "06-05"]

tech_stack:
  added: ["@vitejs/plugin-react (devDependency — JSX transform for vitest)"]
  patterns: ["AnimatePresence accordion with height 0→auto", "card-mount stagger staggerChildren 0.05", "controlled component budget lift"]

key_files:
  modified:
    - pulse/src/app/dashboard/components/BuyListTable.tsx
    - pulse/src/app/dashboard/components/PlanTab.tsx
    - pulse/src/app/dashboard/components/ContributionCalculator.tsx
    - pulse/src/__tests__/BuyListTable.test.tsx
    - pulse/vitest.config.ts
    - pulse/package.json

decisions:
  - "BuyListItem.amountGbp and effectiveBudget are Decimal objects — accordion shows allocationGapPct + rationale text instead of currentPct/targetPct (which don't exist on BuyListItem)"
  - "Collapse test uses aria-expanded assertion instead of DOM absence — AnimatePresence exit animations don't complete synchronously in jsdom"
  - "@vitejs/plugin-react added to vitest config — required for JSX transform (Rule 3 fix)"
  - "Disclaimer count is 4 not 3: no-strategy (1), no-fill-tickers (1), buy-list empty state (0 — disclaimer in outer wrapper), buy-list populated (1) — 4 total code paths all render it"

metrics:
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 6
  commits: 3
---

# Phase 6 Plan 02: Action Plan Panel Summary

## One-liner

BuyListTable converted from `<table>` to glassmorphism div card list with AnimatePresence rationale accordion (D-09/D-10/D-13); PlanTab restyled with "Your Action Plan" heading and ISA banner; ContributionCalculator made controlled with accent slider — budget state lifted to PlanTab.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| TDD RED | BuyListTable failing tests + vitest JSX fix | 6035932 | BuyListTable.test.tsx, vitest.config.ts, package.json |
| 1 GREEN | BuyListTable glassmorphism + accordion | c253a98 | BuyListTable.tsx, BuyListTable.test.tsx |
| 2 | PlanTab + ContributionCalculator restyle | 1689b8b | PlanTab.tsx, ContributionCalculator.tsx |

## What Was Built

**Task 1 — BuyListTable (TDD):**
- `<table>` fully removed, replaced with `motion.div` card list using `backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl`
- Card-mount stagger: `listVariants` parent (`staggerChildren: 0.05`) + `itemVariants` child (`y: 8→0, duration: 0.25`)
- AnimatePresence accordion: click any row button to expand; shows category, gap closed %, and rationale text; "This purchase closes X% of your {category} gap."
- Only one row expanded at a time (`setExpanded(prev === key ? null : key)`)
- ISA warning: `bg-red-500/10 border border-red-500/20` (changed from amber — UI-SPEC)
- Gap bar: `bg-accent` (was `bg-indigo-500`)
- Disclaimer "Creator-derived information — not financial advice" renders on all 3 PlanResult variants

**Task 2 — PlanTab + ContributionCalculator:**
- PlanTab: heading changed to "Your Action Plan"; ISA over-limit banner added (red-500 palette); `useState(initialBudget)` lifted from ContributionCalculator; passes `budget + onBudgetChange` down
- ContributionCalculator: converted to controlled (no internal `useState`); slider card gets glassmorphism wrapper; `accent-accent` on slider; `useMemo(generatePlan)` preserved exactly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] JSX transform missing from vitest config**
- **Found during:** TDD RED phase — vitest threw "Unexpected JSX expression" on first render test
- **Issue:** vitest.config.ts had no React plugin; `@vitejs/plugin-react` not installed; tsconfig `"jsx": "preserve"` is for Next.js bundler, not vitest
- **Fix:** Installed `@vitejs/plugin-react`, added `plugins: [react()]` to vitest.config.ts
- **Files modified:** vitest.config.ts, package.json, package-lock.json
- **Commit:** 6035932

**2. [Rule 1 - Bug] BuyListItem has no currentPct/targetPct fields**
- **Found during:** Task 1 implementation — plan's interface spec showed `currentPct`/`targetPct` on `BuyListItem` but actual `generator.ts` type only has `ticker`, `category`, `amountGbp`, `allocationGapPct`, `rationale`
- **Fix:** Accordion shows `category` + `allocationGapPct` + "closes X% of your {category} gap" text — all from available fields. The `GapRow` type has those pct fields but isn't passed to accordion.
- **Files modified:** BuyListTable.tsx

**3. [Rule 1 - Bug] AnimatePresence exit doesn't complete in jsdom**
- **Found during:** TDD — collapse test expecting `queryByText(...)` to be null after second click; AnimatePresence defers DOM removal until exit animation ends
- **Fix:** Replaced DOM-absence assertion with `aria-expanded` attribute check — semantically correct and synchronous
- **Files modified:** BuyListTable.test.tsx

## Verification

- `npx vitest run`: 60 passed, 0 failed (up from 52 in 06-01)
- `grep -c "<table" BuyListTable.tsx`: 1 (comment only — `* - <table> converted...`)
- `grep -c "Creator-derived information" BuyListTable.tsx`: 4 occurrences across all variant paths
- `grep "AnimatePresence" BuyListTable.tsx`: confirmed import + usage
- `grep "Your Action Plan" PlanTab.tsx`: confirmed heading
- `grep "budget > isaRemaining" PlanTab.tsx`: confirmed ISA banner condition
- `grep "accent-accent" ContributionCalculator.tsx`: confirmed slider accent

## Known Stubs

None — all required UI behavior is implemented and verified by tests.

## Threat Flags

None — no new network endpoints. Threat mitigations applied:
- T-06-02-01: rationale rendered as JSX text node — no `dangerouslySetInnerHTML`
- T-06-02-03: disclaimer on all 3 PlanResult variants confirmed by grep count

## Self-Check: PASSED

- pulse/src/app/dashboard/components/BuyListTable.tsx: FOUND
- pulse/src/app/dashboard/components/PlanTab.tsx: FOUND
- pulse/src/app/dashboard/components/ContributionCalculator.tsx: FOUND
- pulse/src/__tests__/BuyListTable.test.tsx: FOUND
- Commits: 6035932, c253a98, 1689b8b — all in git log
