---
phase: 06-dashboard-ui
fixed_at: 2026-05-07T00:00:00Z
review_path: .planning/phases/06-dashboard-ui/06-REVIEW.md
iteration: 1
findings_in_scope: 13
fixed: 13
skipped: 0
status: all_fixed
---

# Phase 06: Code Review Fix Report

**Fixed at:** 2026-05-07
**Source review:** `.planning/phases/06-dashboard-ui/06-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 13 (5 Critical + 8 Warning)
- Fixed: 13
- Skipped: 0

## Fixed Issues

### CR-01: computeRoadmap UTC date boundary bug

**Files modified:** `pulse/src/lib/plan/roadmap.ts`
**Commit:** 95959bb
**Applied fix:** Replaced `new Date()` with a UTC-anchored `today` via `new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))` so both `today` and `endDate` are UTC, preventing off-by-one month counts near midnight in UTC+ timezones.

---

### CR-02: ContradictionDiff length guard and empty-shifts fallback

**Files modified:** `pulse/src/app/dashboard/components/ContradictionDiff.tsx`
**Commit:** 869647a
**Applied fix:** Added `if (note.length > 2000) return []` guard at top of `parseNoteToShifts`. Added a fallback `<p>` element rendered when `expanded && shifts.length === 0` so users see "Strategy shift details unavailable." instead of a visible badge with no content.

---

### CR-03: Duplicate ISA warning removed from BuyListTable

**Files modified:** `pulse/src/app/dashboard/components/BuyListTable.tsx`, `pulse/src/__tests__/BuyListTable.test.tsx`
**Commit:** 614b2df
**Applied fix:** Removed the `isaWarning` block (lines 98–105) from `BuyListTable`. `PlanTab` is now the sole canonical owner of the ISA over-limit banner. Updated the corresponding test to assert that `BuyListTable` does NOT render the ISA warning.

---

### CR-04: Remove 'creators' from tab valid-tab guard

**Files modified:** `pulse/src/app/dashboard/page.tsx`
**Commit:** 7cc2ea6
**Applied fix:** Changed `['portfolio', 'creators', 'plan'].includes(rawTab)` to `['portfolio', 'plan'].includes(rawTab)`. `'creators'` was never rendered as a tab panel and has its own route at `/dashboard/creators`, so `?tab=creators` now correctly falls back to `'portfolio'` instead of producing a blank content area.

---

### CR-05: Triple non-null .get()! replaced with single null-checked lookup

**Files modified:** `pulse/src/app/dashboard/creators-tab.tsx`
**Commit:** 484019e
**Applied fix:** Replaced the `userCreatorMap.has()` guard + three separate `.get()!` calls with a single IIFE that does one `const uc = userCreatorMap.get(creator.id)` lookup followed by `if (!uc) return null`, eliminating the non-null assertion crash risk.

---

### WR-01: Budget input clamps on blur instead of onChange

**Files modified:** `pulse/src/app/dashboard/components/ContributionCalculator.tsx`
**Commit:** 0fb0205
**Applied fix:** Split the number input handler into `onChange` (allows free typing, passes raw value if not NaN) and `onBlur` (clamps to 200–1000 range). Also added radix `10` to `parseInt` calls.

---

### WR-02: decimal.js for portfolio totals in PlanTab

**Files modified:** `pulse/src/app/dashboard/components/PlanTab.tsx`
**Commit:** a7f9bb4
**Applied fix:** Imported `Decimal` from `decimal.js`. Changed `totalValue` reducer to use `.plus(new Decimal(h.currentValue))` chain. Changed `byCategory` accumulator to use `new Decimal(...).plus(...).toNumber()` instead of `+=`. Satisfies CLAUDE.md mandate for all £ arithmetic.

---

### WR-03: upsertBuyList error logged instead of silently discarded

**Files modified:** `pulse/src/app/dashboard/page.tsx`
**Commit:** 20fb05f
**Applied fix:** Replaced `void upsertBuyList(serverPlanResult)` with `upsertBuyList(serverPlanResult).catch((err) => console.error('[DashboardPage] upsertBuyList failed:', err))`.

---

### WR-04: Shared findLargestGapCategory helper extracted in roadmap.ts

**Files modified:** `pulse/src/lib/plan/roadmap.ts`
**Commit:** 736e4b8
**Applied fix:** Extracted `computeMix` (shared portfolio-mix calculation) and `findLargestGapCategory` (shared gap-finding loop) as internal helpers. Both `computeRoadmap` and `getLargestGapCategory` now delegate to these helpers, eliminating the duplicated gap-computation code.

---

### WR-05: BuyListTable accordion test uses exact text matcher

**Files modified:** `pulse/src/__tests__/BuyListTable.test.tsx`
**Commit:** 7dabccc
**Applied fix:** Changed `expect(screen.getByText(/closes 12.5% of your Index Funds gap/i)).toBeTruthy()` to `expect(screen.getByText('This purchase closes 12.5% of your Index Funds gap.')).toBeInTheDocument()` — exact text prevents false-green via rationale field matching.

---

### WR-06: @testing-library/jest-dom added to tsconfig types

**Files modified:** `pulse/tsconfig.json`
**Commit:** 5e41e05
**Applied fix:** Added `"@testing-library/jest-dom"` to the existing `"types"` array alongside `"vitest/globals"`. The array already existed so no duplication occurred.

---

### WR-07: taxYear stale-across-midnight limitation documented in RoadmapView

**Files modified:** `pulse/src/app/dashboard/components/RoadmapView.tsx`
**Commit:** c086af8
**Applied fix:** Added a 4-line comment above `const taxYear = getCurrentTaxYear()` documenting that the value is stable within a session, the edge-case of page staying open across 6 April midnight, and that manual refresh is the acceptable v1 mitigation.

---

### WR-08: TrustWeightSlider save errors surfaced to user

**Files modified:** `pulse/src/app/dashboard/components/TrustWeightSlider.tsx`
**Commit:** f3e2f62
**Applied fix:** Added `const [saveError, setSaveError] = useState<string | null>(null)` to `SingleSlider`. Added `setSaveError(null)` at start of `handleRelease`, replaced `finally`-only pattern with a `catch` block that sets `setSaveError('Save failed — try again')`. Rendered `{saveError && <span className="text-red-400 text-xs">...}` below the slider row.

---

_Fixed: 2026-05-07_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
