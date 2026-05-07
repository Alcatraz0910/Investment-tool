---
phase: "06"
plan: "06-03"
title: "Roadmap View: computeRoadmap pure function + RoadmapView Recharts component + PlanTab wiring"
subsystem: dashboard-ui
status: complete
completed: "2026-05-07"
duration: "~20 minutes"

tags: [recharts, roadmap, pure-function, decimal.js, glassmorphism, tdd, divergence-chart]

dependency_graph:
  requires: ["06-00", "06-01", "06-02"]
  provides: ["computeRoadmap", "RoadmapView-chart", "PlanTab-roadmap-wired"]
  affects: ["06-04", "06-05"]

tech_stack:
  added: []
  patterns: ["category-gap divergence formula", "Decimal→number boundary at RoadmapPoint", "largest-gap category selection", "'use client' Recharts client component"]

key_files:
  created:
    - pulse/src/lib/plan/roadmap.ts
    - pulse/src/app/dashboard/components/RoadmapView.tsx
  modified:
    - pulse/src/app/dashboard/components/PlanTab.tsx
    - pulse/src/__tests__/RoadmapView.test.tsx

decisions:
  - "Divergence via largest-gap category: plot £ in that category under current-mix vs target-mix regimes — produces visible divergence when currentMix != targetMix"
  - "monthsBetween uses UTC arithmetic to avoid DST boundary issues"
  - "getLargestGapCategory exported separately so RoadmapView can display category name in subtitle without re-running full computeRoadmap"
  - "GlassTooltip custom Recharts tooltip component matches glassmorphism palette"

metrics:
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 2
  commits: 3
---

# Phase 6 Plan 03: Roadmap View Summary

## One-liner

computeRoadmap pure function plots £-in-largest-gap-category trajectories (current-mix vs blended-target) using Decimal arithmetic; RoadmapView Recharts LineChart ('use client') wired into PlanTab below BuyListTable via lifted budget state.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | computeRoadmap + test upgrades | ab78a25 | roadmap.ts, RoadmapView.test.tsx |
| 2 | RoadmapView.tsx Recharts component | 6ab1d58 | RoadmapView.tsx |
| 3 | Wire RoadmapView into PlanTab | 3019ab1 | PlanTab.tsx |

## What Was Built

**Task 1 — roadmap.ts (TDD):**
- `computeRoadmap(holdings, blend, monthlyBudgetGbp, taxYear) → RoadmapPoint[]`
- Returns `[]` when blend is null or has empty unified allocation
- Finds largest-gap category: `max(targetPct - currentPct)` across blend.unified
- currentPath[i] = holdingsInGapCat + budget × currentMix% × i (Decimal arithmetic)
- creatorVision[i] = holdingsInGapCat + budget × targetMix% × i (Decimal arithmetic)
- Month range: today through 5 April of tax year end (UTC monthsBetween helper)
- Month labels: 'Mon YY' format via en-GB locale (e.g. 'May 26')
- Boundary: `.toDecimalPlaces(2).toNumber()` only at RoadmapPoint construction
- `getLargestGapCategory` exported for RoadmapView subtitle
- 7 real vitest assertions replacing todo stubs

**Task 2 — RoadmapView.tsx:**
- `'use client'` on line 1 (Recharts SSR restriction — Pitfall 2)
- Recharts: ResponsiveContainer + LineChart with CartesianGrid, XAxis, YAxis, Tooltip, Legend
- Two Line series: "Your Current Path" (#818CF8) + "Creator's Vision" (#6366F1)
- GlassTooltip: custom tooltip with glassmorphism styling; £X.XX format per entry
- Y-axis tickFormatter: `£${(v/1000).toFixed(0)}k`
- Empty states: no-blend ("Track a creator…"), no-holdings ("Add holdings…")
- Disclaimer "Creator-derived information — not financial advice" below chart
- Chart subtitle shows largest-gap category name

**Task 3 — PlanTab.tsx:**
- Import `RoadmapView` from `'./RoadmapView'`
- Mount `<RoadmapView holdings={portfolio} blend={strategy} monthlyBudget={budget} />` below ContributionCalculator
- Slot comment removed; live component in place
- Budget slider drag → lifted `budget` state → RoadmapView re-renders

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npx vitest run`: 67 passed, 0 failed (up from 60 in 06-02)
- `grep "export function computeRoadmap" roadmap.ts`: confirmed
- `grep "new Decimal" roadmap.ts`: 6+ occurrences
- `grep "toNumber()" roadmap.ts`: confirmed at boundary
- `head -1 RoadmapView.tsx`: `'use client'`
- `grep "not financial advice" RoadmapView.tsx`: confirmed
- `grep "monthlyBudget={budget}" PlanTab.tsx`: confirmed

## Known Stubs

None — computeRoadmap is fully implemented; RoadmapView renders live chart data.

## Threat Flags

None — no new network endpoints or auth paths introduced. Threat mitigations applied:
- T-06-03-01: Decimal arithmetic throughout; `.toDecimalPlaces(2).toNumber()` at boundary — no NaN in Recharts data
- T-06-03-02: gapCategory rendered as JSX text node — React auto-escapes
- T-06-03-03: disclaimer "Creator-derived information — not financial advice" below chart — confirmed by grep
- T-06-03-04: `'use client'` on line 1 — confirmed by head -1

## Self-Check: PASSED

- pulse/src/lib/plan/roadmap.ts: FOUND
- pulse/src/app/dashboard/components/RoadmapView.tsx: FOUND
- pulse/src/app/dashboard/components/PlanTab.tsx: FOUND (modified)
- Commits: ab78a25, 6ab1d58, 3019ab1 — all in git log
