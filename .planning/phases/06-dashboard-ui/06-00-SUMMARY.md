---
phase: "06"
plan: "06-00"
title: "Test Infrastructure: RTL install, jsdom config, Wave 0 test stubs"
subsystem: dashboard-ui
tags: [testing, vitest, jsdom, react-testing-library, recharts, stubs]
dependency_graph:
  requires: []
  provides:
    - "pulse/src/__tests__/setup.ts — jest-dom matchers auto-imported"
    - "pulse/src/__tests__/*.test.tsx — 6 stub files covering UI-01 through UI-05"
    - "recharts — installed for Wave 1+ Roadmap View"
    - "vitest jsdom environment — browser-like testing for React components"
  affects:
    - "06-01-PLAN.md through 06-05-PLAN.md — all Wave 1+ tests depend on these stubs existing"
tech_stack:
  added:
    - recharts (dependency)
    - "@testing-library/react (devDependency)"
    - "@testing-library/jest-dom (devDependency)"
    - "@testing-library/user-event (devDependency)"
    - jsdom (devDependency)
  patterns:
    - "vitest globals:true with jsdom environment + setupFiles for jest-dom matchers"
    - "it.todo() stubs: compile + run green without implementation"
key_files:
  created:
    - pulse/src/__tests__/setup.ts
    - pulse/src/__tests__/design-system.test.tsx
    - pulse/src/__tests__/GlassCard.test.tsx
    - pulse/src/__tests__/RoadmapView.test.tsx
    - pulse/src/__tests__/BuyListTable.test.tsx
    - pulse/src/__tests__/ContributionCalculator.test.tsx
    - pulse/src/__tests__/StrategyCard.test.tsx
  modified:
    - pulse/vitest.config.ts
    - pulse/package.json
decisions:
  - "vitest environment changed from 'node' to 'jsdom' — required for @testing-library/react DOM rendering"
  - "setupFiles points to src/__tests__/setup.ts which imports @testing-library/jest-dom — matchers auto-available in all test files"
  - "Import stubs commented out in RoadmapView.test.tsx (roadmap.ts doesn't exist yet) — will be uncommented in 06-03"
metrics:
  duration: "< 5 minutes"
  completed_date: "2026-05-07"
  tasks_completed: 2
  tasks_total: 2
  files_created: 7
  files_modified: 2
---

# Phase 6 Plan 00: Test Infrastructure Summary

**One-liner:** RTL + jsdom installed and vitest configured; 29 todo-stubs across 6 test files give Wave 1+ plans runnable test targets that exit green immediately.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install recharts + RTL + configure vitest for jsdom | 8c41873 | vitest.config.ts, package.json, setup.ts |
| 2 | Create 5 Wave 0 test stub files | 6817338 | 6 test files in pulse/src/__tests__/ |

## Verification Results

```
Test Files  5 passed | 6 skipped (11)
     Tests  52 passed | 29 todo (81)
  Start at  19:09:46
  Duration  1.26s
```

All 52 prior tests still pass. All 29 stubs exit green (todo = passing in vitest). Full suite exits 0.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

All stubs are intentional. Each `it.todo()` entry will be implemented by the plan listed:

| File | Plan | Reason |
|------|------|--------|
| design-system.test.tsx | 06-01 | globals.css tokens don't exist yet |
| GlassCard.test.tsx | 06-01 | AnimatedTabPanel component doesn't exist yet |
| RoadmapView.test.tsx | 06-03 | computeRoadmap + roadmap.ts don't exist yet |
| BuyListTable.test.tsx | 06-04 | BuyListTable reskin not yet done |
| ContributionCalculator.test.tsx | 06-05 | ContributionCalculator RTL tests not yet wired |
| StrategyCard.test.tsx | 06-05 | StrategyCard glassmorphism reskin not yet done |

These stubs are structurally intentional — the plan's goal is to create runnable test targets, not implement them.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Test infrastructure only. No threat flags.

## Self-Check: PASSED

- pulse/src/__tests__/setup.ts — FOUND
- pulse/src/__tests__/design-system.test.tsx — FOUND
- pulse/src/__tests__/GlassCard.test.tsx — FOUND
- pulse/src/__tests__/RoadmapView.test.tsx — FOUND
- pulse/src/__tests__/BuyListTable.test.tsx — FOUND
- pulse/src/__tests__/ContributionCalculator.test.tsx — FOUND
- pulse/src/__tests__/StrategyCard.test.tsx — FOUND
- Commit 8c41873 — Task 1 (vitest config + packages)
- Commit 6817338 — Task 2 (stub files)
