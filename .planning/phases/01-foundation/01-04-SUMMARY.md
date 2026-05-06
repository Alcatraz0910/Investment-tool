---
phase: 01-foundation
plan: "04"
subsystem: types
tags: [typescript, domain-types, decimal.js, isa, asset-allocation]
dependency_graph:
  requires: ["01-03"]
  provides: ["pulse/src/types/index.ts"]
  affects: ["All phases 2-6 (import from @/types)"]
tech_stack:
  added: []
  patterns: ["Single flat types file (D-09)", "Decimal for all £ fields (D-08)", "camelCase domain types over raw DB rows"]
key_files:
  created:
    - pulse/src/types/index.ts
  modified:
    - pulse/src/app/dashboard/page.tsx
decisions:
  - "D-08: Hand-written domain types, not generated DB row types"
  - "D-09: Single flat file at src/types/index.ts — all phases import from @/types"
  - "Decimal re-exported from @/types so downstream files have one import point"
metrics:
  duration: "5 minutes"
  completed: "2026-05-06"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 1 Plan 04: TypeScript Domain Types Summary

**One-liner:** 12 domain types in `src/types/index.ts` using Decimal for all £ fields, covering every model needed across Phases 1–6.

## What Was Built

- `pulse/src/types/index.ts` — single authoritative file with 12 exported types
- `AssetCategory` union type covering 8 standard categories (matching schema.sql CHECK constraints)
- All £ fields (`currentValue`, `amount`, `amountGbp`, `budgetGbp`) typed as `Decimal` — never `number`
- `AllocationMap = Partial<Record<AssetCategory, number>>` for JSONB strategy/buy-list columns
- `UserCreatorCategoryWeight` type for Phase 4 per-category trust weight overrides (BLEND-01)
- `DbNumeric` utility type documenting that DB NUMERIC columns must be wrapped in `new Decimal()`
- `@/types` import alias verified end-to-end via `dashboard/page.tsx` type import + full build

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write src/types/index.ts | acd92c1 | pulse/src/types/index.ts |
| 2 | Verify alias + build | acd92c1 | pulse/src/app/dashboard/page.tsx |

## Verification

- `tsc --noEmit` exits 0
- `npm run build` exits 0 (all 3 routes: /, /auth/login, /auth/signup, /dashboard)
- No "Cannot find module '@/types'" error
- `grep "currentValue\|amountGbp\|budgetGbp\|amount:" pulse/src/types/index.ts | grep -v Decimal` returns empty

## Deviations from Plan

None — plan executed exactly as written. npm dependencies were not yet installed in the worktree; `npm install` was run as a prerequisite (Rule 3 auto-fix, not a deviation from plan intent).

## Known Stubs

None. This plan produces type definitions only — no runtime data, no UI rendering, no stubs.

## Threat Flags

None. Type definitions contain no secrets, keys, or runtime logic (T-1-17 accepted as per threat model).

## Self-Check: PASSED

- `pulse/src/types/index.ts` exists and contains 12 exports
- Commit acd92c1 exists in git log
- tsc and build both exit 0
