---
phase: 06-dashboard-ui
reviewed: 2026-05-07T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - pulse/src/__tests__/setup.ts
  - pulse/src/__tests__/design-system.test.tsx
  - pulse/src/__tests__/GlassCard.test.tsx
  - pulse/src/__tests__/RoadmapView.test.tsx
  - pulse/src/__tests__/BuyListTable.test.tsx
  - pulse/src/__tests__/ContributionCalculator.test.tsx
  - pulse/src/__tests__/StrategyCard.test.tsx
  - pulse/vitest.config.ts
  - pulse/package.json
  - pulse/src/app/globals.css
  - pulse/src/app/dashboard/page.tsx
  - pulse/src/app/dashboard/components/AnimatedTabPanel.tsx
  - pulse/src/app/dashboard/components/BuyListTable.tsx
  - pulse/src/app/dashboard/components/PlanTab.tsx
  - pulse/src/app/dashboard/components/ContributionCalculator.tsx
  - pulse/src/lib/plan/roadmap.ts
  - pulse/src/app/dashboard/components/RoadmapView.tsx
  - pulse/src/app/dashboard/components/StrategyCard.tsx
  - pulse/src/app/dashboard/components/BlendSummary.tsx
  - pulse/src/app/dashboard/components/TrustWeightSlider.tsx
  - pulse/src/app/dashboard/components/ContradictionDiff.tsx
  - pulse/src/app/dashboard/creators-tab.tsx
findings:
  critical: 5
  warning: 8
  info: 4
  total: 17
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-05-07T00:00:00Z
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Phase 06 implements the Dashboard UI: tab navigation, Buy List with accordion rationale, Contribution Calculator slider, Roadmap View chart, StrategyCard, and the full Creators tab. The architectural decisions are generally sound — `decimal.js` is used for money arithmetic, RSC/client boundaries are correctly split, and the no-advice language constraint is respected throughout.

Five blockers were found: one date-boundary bug that produces wrong trajectory lengths, one XSS-equivalent text injection risk in `ContradictionDiff`, one ISA limit double-application bug, one `'creators'` tab that is listed in the valid-tab guard but excluded from the rendered `tabs` array (unreachable tab), and one unsafe non-null assertion that crashes at runtime. Eight warnings cover unvalidated slider input, float arithmetic for portfolio display, silent swallowed Server Action errors, and several test reliability gaps.

---

## Critical Issues

### CR-01: `computeRoadmap` uses local wall-clock time for month calculation, producing wrong trajectory length near midnight / in non-UTC timezones

**File:** `pulse/src/lib/plan/roadmap.ts:94-95`

**Issue:** `monthsBetween` computes the month difference using `getUTCFullYear` / `getUTCMonth`, but `today` is constructed with `new Date()` (local time). `endDate` is built with `Date.UTC`, so the end is always in UTC. When a UK user's local date is, say, 23:30 BST on 5 April, `today` in UTC is already 6 April — one month beyond the end date — and `monthCount` becomes negative, `Math.max(0, ...)` clamps it to 0, and `computeRoadmap` returns a single point (month 0 only). The roadmap silently disappears for users in any UTC+ timezone at end-of-day near the tax-year boundary. More subtly, because `today.getUTCMonth()` is used inside the loop at line 104 (`today.getUTCMonth() + i`) but `today` itself was created from local time, dates drift on DST transitions.

**Fix:**
```typescript
// Replace new Date() with a UTC-anchored today
const now = new Date()
const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
// monthsBetween already uses UTC accessors — this makes the start consistent
const monthCount = Math.max(0, monthsBetween(today, endDate))
```

---

### CR-02: `ContradictionDiff` regex accepts externally-sourced text and renders it without sanitization — data injection risk

**File:** `pulse/src/app/dashboard/components/ContradictionDiff.tsx:33-43`

**Issue:** `parseNoteToShifts` extracts `match[1]` (category name) verbatim from `contradictionNote`, which originates from the `contradiction_note` database column. This column is populated by Claude AI output (via the strategy extractor), which means arbitrary strings can appear there. The parsed `row.category` is then rendered directly into JSX at line 88-89. While React's JSX escaping prevents classic XSS, a malicious or malformed `contradictionNote` string (e.g., containing semicolons matching the segment splitter, or extremely long category names) can break the visual layout, inject confusing UI text, or cause the `expanded && shifts.length > 0` guard (line 68) to silently show nothing when all segments fail to parse — leaving the badge visible but the diff empty with no user feedback.

Additionally, there is no maximum-length guard on `contradictionNote`. If the AI produces a very long note (thousands of characters), it will be passed directly into `parseNoteToShifts` and rendered in the DOM without truncation.

**Fix:**
```typescript
// 1. Add a length guard before parsing
function parseNoteToShifts(note: string): ShiftRow[] {
  if (note.length > 2000) return []   // reject pathologically long AI output
  return note.split('; ').map(...).filter(...)
}

// 2. When shifts.length === 0 but contradictionNote exists, show a fallback
{expanded && shifts.length === 0 && (
  <p className="mt-2 text-xs text-amber-400/80 px-1">
    Strategy shift details unavailable.
  </p>
)}
```

---

### CR-03: ISA allowance cap applied twice — `PlanTab` banner uses raw `budget` while `ContributionCalculator` already caps through `generatePlan`

**File:** `pulse/src/app/dashboard/components/PlanTab.tsx:74`

**Issue:** The ISA over-limit warning in `PlanTab` fires when `budget > isaRemaining && isaRemaining > 0`. However the `budget` value here is the raw slider value (£200–£1000), and `generatePlan` inside `ContributionCalculator` already applies `Math.min(budget, isaRemaining)` internally to compute `effectiveBudget`. The PlanTab banner therefore fires correctly. But `BuyListTable` also shows its own ISA warning (from `result.isaWarning`) when the plan is rendered. The user sees **two** concurrent ISA warnings — one from `PlanTab` (line 74–80) and one from `BuyListTable` (line 99–105 in `BuyListTable.tsx`) — whenever `budget > isaRemaining`. This is a duplicate UX state that is confusing and contradicts the UI-SPEC which specifies the banner is only at the top of `PlanTab`. One of the two must be the canonical source.

More critically: when `isaRemaining` is 0 (ISA fully used), `PlanTab` suppresses its banner (`isaRemaining > 0` guard at line 74), but `BuyListTable` will still display `isaWarning: true` from `generatePlan`. The user gets no top-level explanation but still sees a cryptic red box in the buy list. The two components are not coordinated.

**Fix:**
Remove the `isaWarning` block from `BuyListTable` (lines 99–105) and let `PlanTab` own the single canonical ISA warning placement. `BuyListTable` should only render the buy list rows. Alternatively, suppress the `PlanTab` banner and let `BuyListTable` handle it — but pick one owner.

---

### CR-04: `'creators'` tab is in the valid-tab guard but never rendered — dead URL state causes blank panel

**File:** `pulse/src/app/dashboard/page.tsx:37-39`

**Issue:**
```typescript
const activeTab: Tab = ['portfolio', 'creators', 'plan'].includes(rawTab)
  ? (rawTab as Tab)
  : 'portfolio'
```
`'creators'` is in the valid-tab allow-list, but the `Tab` type is `'portfolio' | 'plan'` (line 23), and `creators` is never included in the rendered `tabs` array (lines 299–302). If a user navigates to `?tab=creators`, `activeTab` is assigned `'creators'` (TypeScript allows it due to the `as Tab` cast suppressing the type error), the tab bar shows neither tab as active, and the content panel renders nothing (neither the `portfolio` nor `plan` conditional matches). The page appears broken — blank content area.

**Fix:**
```typescript
// Option A: remove 'creators' from the guard (it has its own route at /dashboard/creators)
const activeTab: Tab = ['portfolio', 'plan'].includes(rawTab)
  ? (rawTab as Tab)
  : 'portfolio'

// Option B: add it to the Tab type and render a panel for it
type Tab = 'portfolio' | 'plan' | 'creators'
```

---

### CR-05: Non-null assertion `userCreatorMap.get(creator.id)!` called three times without a single lookup

**File:** `pulse/src/app/dashboard/creators-tab.tsx:157-163`

**Issue:**
```typescript
{userCreatorMap.has(creator.id) && (
  <TrustWeightSlider
    userCreatorId={userCreatorMap.get(creator.id)!.id}
    initialGlobalWeight={userCreatorMap.get(creator.id)!.trustWeight}
    initialCategoryWeights={
      userCreatorMap.get(creator.id)!.categoryWeights?.map(...)
    }
  />
)}
```
The `.has()` check and three separate `.get()!` calls are not atomic. In a concurrent React render (React 19 + strict mode double-invocation), the map reference could be replaced between the guard check and the property access if a parent re-render swaps the prop. More practically, calling `.get()` three times on a `Map` for the same key is unnecessary; if `has()` returns true but `get()` somehow returns undefined (e.g., if `Map` is replaced by a new reference mid-render), the `!` assertion causes a runtime crash (`TypeError: Cannot read properties of undefined`).

**Fix:**
```typescript
{(() => {
  const uc = userCreatorMap.get(creator.id)
  if (!uc) return null
  return (
    <TrustWeightSlider
      userCreatorId={uc.id}
      initialGlobalWeight={uc.trustWeight}
      initialCategoryWeights={uc.categoryWeights?.map((w) => ({
        category: w.category,
        weight: w.weight,
      })) ?? []}
    />
  )
})()}
```

---

## Warnings

### WR-01: `ContributionCalculator` number input allows out-of-range typed values before `onBlur`

**File:** `pulse/src/app/dashboard/components/ContributionCalculator.tsx:58-60`

**Issue:** The `onChange` handler clamps with `Math.min(1000, Math.max(200, parseInt(e.target.value) || 200))`. While this prevents out-of-range values from being passed to `onBudgetChange`, it means the displayed input value snaps immediately while the user is mid-type (e.g., typing "150" passes "200" to `onBudgetChange` after the first "1" is entered, which is already clamped to 200). The UX is jarring — intermediate keystrokes cause the input to visually jump. Also `parseInt` without a radix is used; while `parseInt(str)` defaults to base 10 in modern engines when the string doesn't start with `0x`, it is an established bad practice.

**Fix:**
```typescript
onChange={(e) => {
  // Allow free typing; clamp only on blur
  const raw = parseInt(e.target.value, 10)
  if (!isNaN(raw)) onBudgetChange(raw)
}}
onBlur={(e) => {
  const clamped = Math.min(1000, Math.max(200, parseInt(e.target.value, 10) || 200))
  onBudgetChange(clamped)
}}
```

---

### WR-02: `PlanTab` uses native float arithmetic for portfolio display totals

**File:** `pulse/src/app/dashboard/components/PlanTab.tsx:28-36`

**Issue:**
```typescript
const totalValue = portfolio.reduce((sum, h) => sum + h.currentValue, 0)
// ...
acc[h.category].total += h.currentValue
```
`h.currentValue` is a plain `number` (serialized from `Decimal` at the RSC boundary in `page.tsx`). Summing plain numbers with `+` accumulates IEEE 754 float errors. The resulting `totalValue` and per-category totals are displayed as `£{totalValue.toFixed(2)}`, so rounding errors will be visible to users (e.g., `£999.9999999999999`). CLAUDE.md mandates `decimal.js` for all £ arithmetic. This component is client-side, so `decimal.js` is available.

**Fix:**
```typescript
import { Decimal } from 'decimal.js'

const totalValue = portfolio
  .reduce((sum, h) => sum.plus(new Decimal(h.currentValue)), new Decimal(0))
  .toNumber()

// In byCategory reducer:
acc[h.category].total = new Decimal(acc[h.category].total)
  .plus(new Decimal(h.currentValue))
  .toNumber()
```

---

### WR-03: `upsertBuyList` error is silently discarded with `void`

**File:** `pulse/src/app/dashboard/page.tsx:297`

**Issue:**
```typescript
void upsertBuyList(serverPlanResult)
```
The Server Action `upsertBuyList` persists the generated Buy List to the database. Any database error (connection failure, RLS violation, schema mismatch) is silently swallowed. The user sees no indication that their plan was not saved. Because this is declared as "fire and forget" in the comment, there is no retry, no logging, and no UI feedback. If the persist fails consistently (e.g., due to a schema migration), the saved Buy List will be stale or absent with no observable signal.

**Fix:** At minimum, log the error server-side:
```typescript
upsertBuyList(serverPlanResult).catch((err) =>
  console.error('[DashboardPage] upsertBuyList failed:', err)
)
```

---

### WR-04: `roadmap.ts` — `getLargestGapCategory` duplicates the entire gap-computation logic from `computeRoadmap`

**File:** `pulse/src/lib/plan/roadmap.ts:119-155`

**Issue:** `getLargestGapCategory` is a near-complete copy of the gap-finding logic in `computeRoadmap` (lines 49–83). Both functions independently compute `totalPortfolioValue`, `categoryValues`, `currentMix`, and the `maxGap` loop. Any bug fix or change to the gap algorithm must be applied in two places. `RoadmapView` calls both `computeRoadmap` and `getLargestGapCategory` separately (lines 63–71 in `RoadmapView.tsx`), meaning all the portfolio arithmetic runs twice per render.

**Fix:** Extract a shared `findLargestGapCategory(holdings, blend)` helper that both `computeRoadmap` and `getLargestGapCategory` call. `computeRoadmap` can then use it directly rather than re-implementing the loop.

---

### WR-05: `BuyListTable` test asserts accordion text that does not match the component's actual rendered string

**File:** `pulse/src/__tests__/BuyListTable.test.tsx:79`

**Issue:**
```typescript
// Test expects:
expect(screen.getByText(/closes 12.5% of your Index Funds gap/i)).toBeTruthy()

// Component renders (BuyListTable.tsx:193):
<p className="text-xs text-zinc-400">
  This purchase closes {item.allocationGapPct.toFixed(1)}% of your {item.category} gap.
</p>
```
The test regex `/closes 12.5% of your Index Funds gap/i` should match the rendered text "This purchase closes 12.5% of your Index Funds gap." However, the test data sets `allocationGapPct: 12.5` and the component calls `.toFixed(1)` — rendering `"12.5"` — so this particular assertion happens to pass. But the `item.rationale` field also contains "closes 12.5%" in the test fixture (line 31), so if the accordion does not expand correctly, the `rationale` `<p>` tag (line 196) might match instead, giving a false-green. The test should use `getByText` with a more specific text node rather than a regex that can match either the rationale or the expansion text.

**Fix:**
```typescript
// Assert on the specific structural text produced by the accordion expansion logic
expect(screen.getByText('This purchase closes 12.5% of your Index Funds gap.')).toBeInTheDocument()
```

---

### WR-06: `vitest.config.ts` missing `include` glob — all test files must be co-located or risk being silently excluded

**File:** `pulse/vitest.config.ts`

**Issue:** The vitest config has no `test.include` pattern. Vitest defaults to `['**/*.{test,spec}.{js,mjs,cjs,jsx,ts,mts,cts,tsx}']`. This works, but the config also sets `globals: true` without a corresponding `types` entry in `tsconfig.json` (not reviewed here). If `@testing-library/jest-dom` matchers such as `toBeInTheDocument()` are used (they are, in `StrategyCard.test.tsx` lines 31, 32 etc.), the TypeScript types for those matchers must be available. The `setup.ts` file imports `'@testing-library/jest-dom'` which registers the matchers at runtime, but without a `tsconfig` `types` or `/// <reference>` entry, TypeScript will not know about them and `toBeInTheDocument()` calls will show type errors at compile time, even if tests pass at runtime.

**Fix:** Add to `vitest.config.ts`:
```typescript
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./src/__tests__/setup.ts'],
  // Ensure jest-dom types are visible
},
```
And in `tsconfig.json` (or a `src/__tests__/tsconfig.json`):
```json
{
  "compilerOptions": {
    "types": ["@testing-library/jest-dom", "vitest/globals"]
  }
}
```

---

### WR-07: `RoadmapView` — `taxYear` included in `useMemo` dependency array but is not reactive

**File:** `pulse/src/app/dashboard/components/RoadmapView.tsx:63-66`

**Issue:**
```typescript
const taxYear = getCurrentTaxYear()   // computed once at render
const data = useMemo(
  () => computeRoadmap(holdings, blend, monthlyBudget, taxYear),
  [holdings, blend, monthlyBudget, taxYear],
)
```
`taxYear` is computed by calling `getCurrentTaxYear()` on every render. Its value does not change within a session (the UK tax year only changes once a year at midnight on 6 April). Including it in the dependency array is not harmful, but `getCurrentTaxYear()` is called on every render to produce the value, which is then used as a dep. If `getCurrentTaxYear()` returns a new string reference each time (it almost certainly does — strings are primitives so reference equality holds, this is low risk), the dep will never change. The real issue: if the page stays open across 6 April midnight (edge case but valid for a long-running SPA), `taxYear` will not update because `getCurrentTaxYear()` is not in a `useState` or `useEffect` — the chart silently continues projecting into the now-expired tax year for the lifetime of that render tree.

**Fix:** Not a showstopper but worth documenting. A `useMemo` with an empty dep for `taxYear` (or accepting stale data) is the pragmatic v1 fix since the app is manually refreshed.

---

### WR-08: `TrustWeightSlider` — save errors from `saveCreatorWeight` are silently discarded

**File:** `pulse/src/app/dashboard/components/TrustWeightSlider.tsx:44-52`

**Issue:**
```typescript
const handleRelease = async () => {
  setSaving(true)
  try {
    await onSave(value)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  } finally {
    setSaving(false)
  }
}
```
If `onSave` (which calls `saveCreatorWeight` Server Action) throws or rejects, the error is swallowed by the `finally` block. `setSaved(true)` is never reached (correct), but no error state is set either. The user sees the spinner disappear and the `✓` tick never appear — no error message, no retry affordance. The user has no idea whether their trust weight was saved.

**Fix:**
```typescript
const [saveError, setSaveError] = useState<string | null>(null)

const handleRelease = async () => {
  setSaving(true)
  setSaveError(null)
  try {
    await onSave(value)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  } catch {
    setSaveError('Save failed — try again')
  } finally {
    setSaving(false)
  }
}
// render: {saveError && <span className="text-red-400 text-xs">{saveError}</span>}
```

---

## Info

### IN-01: `GlassCard.test.tsx` — file name suggests a `GlassCard` component but tests `AnimatedTabPanel`

**File:** `pulse/src/__tests__/GlassCard.test.tsx`

**Issue:** The test file is named `GlassCard.test.tsx` and its header comment says "UI-01: AnimatedTabPanel renders children." There is no `GlassCard` component imported or tested anywhere in this file. The file name is misleading and will confuse future contributors looking for glassmorphism card tests.

**Fix:** Rename to `AnimatedTabPanel.test.tsx` to match the component under test.

---

### IN-02: `creators-tab.tsx` — `useActionState` and `startTransition` both imported but `startTransition` is used twice via different handles

**File:** `pulse/src/app/dashboard/creators-tab.tsx:2`

**Issue:**
```typescript
import { useState, useTransition, useActionState, startTransition } from 'react'
```
Both `useTransition` (aliased to `startT` at line 34) and the named `startTransition` import are present. The form's `action` prop at line 180 uses the named import `startTransition`, while `handleToggle` uses `startT` from `useTransition`. These are semantically different — `useTransition` provides an `isPending` flag tied to `startT`, whereas the standalone `startTransition` does not. This is not a bug per se, but the dual import pattern is confusing and the `isPending` from `useTransition` (line 34) is only tied to the `handleToggle` transitions, not the form submission. The `customPending` from `useActionState` covers the form's pending state correctly, but a reader could assume `isPending` covers both paths.

**Fix:** Remove the named `startTransition` import and use `startT` from `useTransition` everywhere, or document why two separate transition contexts are needed.

---

### IN-03: Magic numbers in `ContributionCalculator` — slider min/max hardcoded in two places

**File:** `pulse/src/app/dashboard/components/ContributionCalculator.tsx:43-56`

**Issue:** The slider range `min={200}` and `max={1000}` appears on both the range input (lines 44-45) and the number input (lines 55-56), and the clamping logic at line 59 repeats `200` and `1000` again. Three separate locations must be updated if the budget range changes.

**Fix:**
```typescript
const BUDGET_MIN = 200
const BUDGET_MAX = 1000
// Use BUDGET_MIN / BUDGET_MAX throughout
```

---

### IN-04: `design-system.test.tsx` reads `globals.css` at module-evaluation time — fragile test coupling

**File:** `pulse/src/__tests__/design-system.test.tsx:9`

**Issue:**
```typescript
const cssContent = fs.readFileSync(cssPath, 'utf8')
```
Reading the file at module-evaluation time (outside any `beforeAll`/`beforeEach`) means if the file does not exist or the path resolution fails, the entire test module throws on import — all tests in the file fail with a confusing "module load error" rather than a clear test failure. This also means the CSS is read once and cached for the lifetime of the test run; changes to `globals.css` mid-run (unlikely but possible in watch mode) are not reflected.

**Fix:**
```typescript
let cssContent: string
beforeAll(() => {
  cssContent = fs.readFileSync(cssPath, 'utf8')
})
```

---

_Reviewed: 2026-05-07T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
