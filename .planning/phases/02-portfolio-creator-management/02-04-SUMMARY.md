---
phase: 02-portfolio-creator-management
plan: "04"
subsystem: isa-tracker
tags: [isa, tax-year, server-actions, decimal.js, client-component]
dependency_graph:
  requires: [02-01]
  provides: [isa-tab, isa-actions, tax-year-utility]
  affects: [dashboard/page.tsx]
tech_stack:
  added: []
  patterns: [server-actions, useActionState, useTransition, decimal.js-arithmetic]
key_files:
  created:
    - pulse/src/lib/tax-year.ts
    - pulse/src/app/dashboard/isa-actions.ts
    - pulse/src/app/dashboard/isa-tab.tsx
  modified:
    - pulse/src/app/dashboard/page.tsx
decisions:
  - "Used UTC methods (getUTCFullYear, getUTCMonth, getUTCDate) in getTaxYearForDate to avoid timezone-dependent boundary issues"
  - "Fixed TypeScript union type issue: replaced logState?.error with 'error' in logState && logState.error type guard"
metrics:
  duration: "~20 minutes"
  completed_date: "2026-05-07"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 2 Plan 4: ISA Tracker — ISATab + Server Actions Summary

## One-liner

UK ISA allowance tracker with decimal.js arithmetic, 6-April tax year boundary utility, and server-secured contribution log/delete actions.

## What Was Built

### Task 1: Tax Year Utility + Server Actions

`pulse/src/lib/tax-year.ts` — pure UTC-based utility:
- `getTaxYearForDate(date)` — '2025-04-06' → '2025-26', '2025-04-05' → '2024-25'
- `getCurrentTaxYear()` — wrapper for today's date
- `formatTaxYearDisplay(taxYear)` — '2025-26' → '6 Apr 2025 – 5 Apr 2026'

`pulse/src/app/dashboard/isa-actions.ts` — two server actions:
- `logContribution` — validates date + amount > 0, computes tax_year server-side, inserts row
- `deleteContribution` — scopes by `.eq('user_id', user.id)` (defence-in-depth beyond RLS)
- Both call `getUser()` before any DB operation (T-02-16)

### Task 2: ISATab Component + Dashboard Wiring

`pulse/src/app/dashboard/isa-tab.tsx` — client component:
- Allowance summary: `ISA_ALLOWANCE = new Decimal(20000)`, total via `.reduce(sum.plus(c.amount))`, remaining via `.minus()`
- Color logic: `text-white` / `text-amber-400` (>90%) / `text-red-400` (100%)
- Contribution log with inline delete confirmation ("Remove this contribution? This will update your remaining allowance.")
- Log Contribution form with date + amount inputs, `useActionState` for server action binding

`pulse/src/app/dashboard/page.tsx` updated:
- Imports `ISATab` and `getCurrentTaxYear`
- Fetches `isa_contributions` for current tax year when `activeTab === 'isa'`
- Maps DB rows to `ISAContribution` domain type with `new Decimal(row.amount)`
- Replaces placeholder `<p>` with `<ISATab contributions={contributions} currentTaxYear={currentTaxYear} />`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript union type error on logState.error**
- **Found during:** TypeScript compilation check after Task 2
- **Issue:** `logState` has type `ActionResult | { success: boolean }`. TypeScript correctly rejected `logState?.error` because `{ success: boolean }` has no `error` property.
- **Fix:** Replaced `logState?.error && logState.error` with `'error' in logState && logState.error` type guard pattern. Same for the success check.
- **Files modified:** `pulse/src/app/dashboard/isa-tab.tsx`
- **Commit:** b1f4ff1

## Threat Mitigations Applied

All T-02-16 through T-02-20 mitigations from the plan's threat register are implemented:
- T-02-16: `getUser()` in both server actions before any DB access
- T-02-17: `.eq('user_id', user.id)` in deleteContribution (defence-in-depth + RLS)
- T-02-18: `tax_year` computed server-side via `getTaxYearForDate`; not sourced from FormData
- T-02-19: Server validates `amount > 0`; DB CHECK constraint provides second layer
- T-02-20: `isa_contributions` SELECT scoped by `.eq('user_id', user.id)` + `tax_year` filter

## Commits

| Hash | Message |
|------|---------|
| 1ff708f | feat(02-04): create ISA server actions and tax year utility |
| b1f4ff1 | feat(02-04): build ISATab component and wire ISA tab in dashboard |

## Self-Check

- [x] `pulse/src/lib/tax-year.ts` — exists
- [x] `pulse/src/app/dashboard/isa-actions.ts` — exists
- [x] `pulse/src/app/dashboard/isa-tab.tsx` — exists
- [x] `pulse/src/app/dashboard/page.tsx` — updated with ISATab import and contributions fetch
- [x] TypeScript compiles without errors (`npx tsc --noEmit` exits 0)
- [x] getTaxYearForDate uses UTC boundary (no timezone drift)
- [x] All £ arithmetic via `Decimal` (ISA_ALLOWANCE, totalContributed, remaining, amount display)
- [x] Both server actions call `getUser()` before DB operations
- [x] deleteContribution scopes by user_id

## Self-Check: PASSED
