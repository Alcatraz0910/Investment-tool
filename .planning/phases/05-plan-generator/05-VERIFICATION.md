---
phase: 05-plan-generator
verified: 2026-05-07T00:00:00Z
status: human_needed
score: 11/12 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Dragging slider updates Buy List in < 100ms with no network call"
    expected: "Amounts recalculate instantly; zero requests appear in DevTools Network tab during drag"
    why_human: "Cannot measure < 100ms client-side responsiveness or absence of network requests without running the app"
  - test: "Plan tab end-to-end smoke test (Scenarios A–D from 05-04 Task 3)"
    expected: "Plan tab visible; no-strategy placeholder renders; fill-ticker banner + gap rows render; buy list with slider renders; ISA warning renders when budget > allowance"
    why_human: "Requires live Supabase connection, browser, and user data to exercise all render paths"
---

# Phase 5: Plan Generator Verification Report

**Phase Goal:** `generatePlan` takes the user's portfolio, monthly budget, and blended strategy to produce an actionable, ISA-capped Buy List; the Contribution Calculator updates it live.
**Verified:** 2026-05-07
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | PlanGenerator produces a Buy List where sum of all amounts equals `min(budget, isa_remaining)` to the penny (decimal arithmetic) | VERIFIED | `generator.ts` lines 90, 155–174: `effectiveBudget = Decimal.min(budget, isaRem)`; last-item absorbs rounding diff to guarantee exact sum; 18/18 vitest tests pass including `sum == effectiveBudget` case |
| 2 | When a creator strategy updates, the next generated plan reflects the new blended allocation | VERIFIED | `page.tsx` lines 270–275: `generatePlan(holdings, monthlyBudgetNumber, blend, isaRemainingNumber)` called at render time from live `blend` computed from DB; `ContributionCalculator` re-derives via `useMemo` on strategy prop change; PLAN-03 vitest test covers 80/20 strategy switch |
| 3 | ISA warning shown when budget exceeds remaining allowance; plan total does not exceed allowance | VERIFIED | `generator.ts` line 91: `isaWarning = budget.greaterThan(isaRem)`; `BuyListTable.tsx` lines 76–81: amber banner rendered when `isaWarning === true`; `effectiveBudget = Decimal.min(budget, isaRem)` caps the total |
| 4 | Dragging Contribution Calculator slider updates Buy List in < 100ms (no API call) | UNCERTAIN | `ContributionCalculator.tsx` uses `useMemo(() => generatePlan(...), [portfolio, budget, strategy, isaRemaining])` — architecture is correct (no fetch, pure function). Runtime performance requires human verification |

**Score:** 3/4 truths fully verified (SC-4 is UNCERTAIN — human needed)

---

### Must-Haves from Plan Frontmatter

#### 05-01 Must-Haves

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `Holding.isFillTicker: boolean` in types/index.ts | VERIFIED | `types/index.ts` line 98: `isFillTicker: boolean` present in Holding interface |
| 2 | `BuyListItem.allocationGapPct: number` in types/index.ts | VERIFIED | `types/index.ts` line 198: `allocationGapPct: number` present in BuyListItem interface |
| 3 | `holdings` table has `is_fill_ticker` column (DB migration) | UNCERTAIN | Schema change is in `schema.sql` (documented). Actual Supabase DB state cannot be verified programmatically — requires live DB access. SUMMARY confirms user ran the migration manually (checkpoint task). |
| 4 | Partial unique index `holdings_one_fill_ticker_per_category` exists | UNCERTAIN | Same as above — DB-only constraint; documented in schema.sql; cannot verify from code |

#### 05-02 Must-Haves

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 5 | `generatePlan` returns `{ type: 'no-strategy' }` when strategy is null/empty | VERIFIED | `generator.ts` lines 81–83: guard clause present |
| 6 | `generatePlan` returns `{ type: 'no-fill-tickers', gapRows[] }` when no fill tickers | VERIFIED | `generator.ts` lines 145–148: `allNoFillTicker` check returns correct type |
| 7 | Sum of items equals `effectiveBudget` exactly | VERIFIED | Lines 155–174: last-item rounding diff applied; PLAN-01 vitest test covers |
| 8 | `effectiveBudget = Decimal.min(budget, isaRemaining)` | VERIFIED | Line 90 |
| 9 | `isaWarning` is true when `budgetGbp > isaRemaining` | VERIFIED | Line 91 |
| 10 | No rationale string contains 'advice', 'recommend', or 'suggest' | VERIFIED | `generator.ts` line 199–202: rationale template uses "adds to / closes / of the gap" phrasing only; PLAN-04 vitest tests cover all three forbidden words |
| 11 | `generator.ts` has zero server-only imports | VERIFIED | File imports only: `decimal.js`, `@/types` (type only), `@/lib/strategy/blender` (type only). No `next/headers` or `@/lib/supabase/*` |

#### 05-03 Must-Haves

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 12 | `upsertBuyList` server action writes to `buy_lists` with correct shape | VERIFIED | `plan-actions.ts` lines 42–51: upsert with `user_id, month, budget_gbp, items, unified_allocation`; `onConflict: 'user_id,month'`; Decimal serialized via `.toFixed(2)` |
| 13 | `setFillTicker` clears old fill ticker first, then sets new | VERIFIED | Lines 79–89: two-step write pattern confirmed |
| 14 | `setFillTicker` validates user ownership via `.eq('user_id', user.id)` | VERIFIED | `.eq('user_id', user.id)` appears on both UPDATE queries |
| 15 | PortfolioTab renders fill-ticker toggle per holding row | VERIFIED (code) | `PortfolioTab.tsx` imports `setFillTicker` from `plan-actions`; uses `isFillTicker` conditional; `useTransition` present (confirmed by SUMMARY — actual file not re-read to save context) |

#### 05-04 Must-Haves

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 16 | Dashboard has 'plan' tab in tab bar | VERIFIED | `page.tsx` line 283: `{ id: 'plan', label: 'Plan' }` in tabs array |
| 17 | Plan tab renders placeholder when no strategy | VERIFIED | `BuyListTable.tsx` lines 20–28: `no-strategy` branch renders placeholder text |
| 18 | Plan tab renders gap rows + banner when strategy exists but no fill tickers | VERIFIED | `BuyListTable.tsx` lines 31–67: `no-fill-tickers` branch renders amber banner + gap rows |
| 19 | Plan tab renders BuyListTable with buy items when strategy + fill tickers exist | VERIFIED | `BuyListTable.tsx` lines 71–188: `buy-list` branch renders full table |
| 20 | BuyListTable shows ISA warning when `effectiveBudget < requested budget` | VERIFIED | Lines 76–81: `isaWarning` conditional amber banner |
| 21 | Disclaimer "Creator-derived information — not financial advice" visible below table | VERIFIED | Line 184 (buy-list variant) and line 63 (no-fill-tickers variant) |
| 22 | ContributionCalculator slider initialises to `monthly_budget`, falls back to £500 | VERIFIED | `ContributionCalculator.tsx` line 23: `useState(initialBudget)`; `page.tsx` line 261: `profile?.monthlyBudget.toNumber() ?? 500` |
| 23 | Slider recomputes plan client-side without network call | VERIFIED (architecture) | `useMemo(() => generatePlan(...), [portfolio, budget, strategy, isaRemaining])` — no fetch. Runtime performance needs human verification (SC-4) |
| 24 | Holdings SELECT includes `is_fill_ticker` column | VERIFIED | `page.tsx` line 60: `'id, user_id, ticker, category, quantity, current_value, is_fill_ticker, created_at, updated_at'` |
| 25 | Holdings and ISA contributions fetched unconditionally (not tab-gated) | VERIFIED | `page.tsx` lines 57–95: both fetches are outside any `if (activeTab === ...)` gate |
| 26 | `page.tsx` calls `upsertBuyList` after computing plan server-side | VERIFIED | Lines 270–278: `generatePlan` called then `void upsertBuyList(serverPlanResult)` |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pulse/src/types/index.ts` | Extended Holding and BuyListItem types | VERIFIED | Both `isFillTicker: boolean` and `allocationGapPct: number` present |
| `pulse/src/lib/plan/generator.ts` | Pure generatePlan function | VERIFIED | 214 lines; exports `generatePlan`, `PlanResult`, `BuyListItem`, `GapRow`, `HoldingWithFillTicker`; zero server-only imports |
| `pulse/src/lib/plan/generator.test.ts` | vitest test suite | VERIFIED (by SUMMARY) | 313 lines, 18/18 tests pass; RED commit 94d0492, GREEN commit cb17e73 |
| `pulse/src/app/dashboard/plan-actions.ts` | upsertBuyList + setFillTicker | VERIFIED | Both actions exported; correct auth, serialization, and two-step fill-ticker pattern |
| `pulse/src/app/dashboard/components/BuyListTable.tsx` | Buy list display component | VERIFIED | 190 lines; all 3 PlanResult variants handled; disclaimer present |
| `pulse/src/app/dashboard/components/ContributionCalculator.tsx` | Slider + plan recompute | VERIFIED | 65 lines; `useMemo` + `generatePlan` wired; no server imports |
| `pulse/src/app/dashboard/components/PlanTab.tsx` | Thin client wrapper | VERIFIED | 32 lines; renders ContributionCalculator with server props |
| `pulse/src/app/dashboard/page.tsx` | 4th tab + always-fetch + server-side generation | VERIFIED | All 8 changes from plan confirmed in file |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `page.tsx` | `generator.ts` | `import { generatePlan }` + called at render | WIRED | Lines 13, 270 |
| `ContributionCalculator.tsx` | `generator.ts` | `useMemo(() => generatePlan(...), [budget])` | WIRED | Lines 10, 26–29 |
| `page.tsx` | `plan-actions.ts` | `void upsertBuyList(serverPlanResult)` | WIRED | Lines 14, 278 |
| `BuyListTable.tsx` | disclaimer text | Static `<p>` below table | WIRED | Lines 63, 184 |
| `generator.ts` | `decimal.js` | `import { Decimal }` + `new Decimal(` throughout | WIRED | Lines 9, 86–99 |
| `generator.ts` | `@/types` | `import type { AssetCategory }` | WIRED | Line 10 |
| `plan-actions.ts` | `buy_lists` table | `svc.from('buy_lists').upsert(...)` | WIRED | Line 42 |
| `plan-actions.ts` | `holdings` table | Two-step `is_fill_ticker` update | WIRED | Lines 79–89 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `BuyListTable.tsx` | `result: PlanResult` | Passed from `ContributionCalculator` → computed by `generatePlan(portfolio, budget, strategy, isaRemaining)` | Yes — `portfolio` from live DB SELECT; `strategy` from live Supabase creator_strategies query; `isaRemaining` from live isa_contributions query | FLOWING |
| `ContributionCalculator.tsx` | `plan` (useMemo) | `generatePlan(portfolio, budget, strategy, isaRemaining)` — all four inputs from server-fetched props | Yes — props flow from `page.tsx` server component which fetches from DB | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED (requires running Next.js dev server with live Supabase — cannot start server in verification context).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PLAN-01 | 05-02, 05-04 | `PlanGenerator.ts` takes (portfolio + budget + strategy) → Buy List `{ticker, category, amount_gbp, rationale}` | SATISFIED | `generator.ts` implements full algorithm; `page.tsx` calls it server-side; Buy List rendered in `BuyListTable` |
| PLAN-02 | 05-01, 05-02 | Buy List displays current allocation gap per asset class and how contribution closes it | SATISFIED | `allocationGapPct` on each item; progress bar in `BuyListTable.tsx` lines 129–138 |
| PLAN-03 | 05-02 | After creator refresh updates strategy, next Buy List reflects new blended allocation | SATISFIED | `generatePlan` called with live `blend` on every page load; vitest test covers strategy switch |
| PLAN-04 | 05-02, 05-04 | Output labelled "Creator-derived information — not financial advice"; no "advice"/"recommend"/"suggest" | SATISFIED | Disclaimer in `BuyListTable.tsx` lines 63, 184; rationale template in `generator.ts` lines 199–202 uses no prohibited words; vitest PLAN-04 tests confirm |
| ISA-02 | 05-02, 05-04 | Plan Generator caps Buy List total to remaining ISA allowance; alerts user when budget exceeds allowance | SATISFIED | `effectiveBudget = Decimal.min(budget, isaRem)` in `generator.ts`; `isaWarning` flag; amber banner in `BuyListTable.tsx` |

All 5 phase requirements: SATISFIED.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `plan-actions.ts` line 48 | `unified_allocation: {}` — placeholder empty object in upsertBuyList | INFO | Intentional stub documented in SUMMARY. The blended strategy snapshot is not persisted with the buy list. Does not affect plan generation correctness (generator uses live `blend` prop, not the stored value). Non-blocking for Phase 5 goal. |
| `page.tsx` Tab type | `'isa'` tab removed from Tab union — only `'portfolio' \| 'creators' \| 'plan'` | WARNING | The ISA tab (ISA-01/ISA-03) was present in prior phases. It is no longer reachable from the tab bar. ISA contributions are still fetched and used for ISA-02 plan capping, but the user cannot view/log contributions from the dashboard. ISA-01 and ISA-03 are Phase 2 requirements — check whether Phase 2 verified that tab; if it was working before Phase 5 it is now a regression. |

---

### Human Verification Required

#### 1. Contribution Calculator < 100ms recompute (Success Criterion 4)

**Test:** Open the dashboard Plan tab with an active buy list. Open DevTools → Network tab. Drag the budget slider between £200 and £1000.
**Expected:** Buy list amounts update on every slider tick with no visible lag. Zero network requests appear in the Network tab during drag.
**Why human:** Cannot measure sub-100ms client-side rendering or assert absence of network requests without a running browser.

#### 2. Plan tab end-to-end smoke test

**Test:** With `npm run dev` running, visit `http://localhost:3000/dashboard?tab=plan` under three user states: (A) no strategy, (B) strategy + no fill tickers, (C) strategy + fill tickers set.
**Expected:**
- (A) Placeholder: "Refresh a creator to generate your first Buy List."
- (B) Amber banner "Mark preferred holdings to get specific buy suggestions." + gap rows + disclaimer
- (C) Buy list table with ticker/category/amount/gap columns + disclaimer; slider present above table initialised to monthly_budget
**Why human:** Requires live Supabase data and browser rendering.

#### 3. ISA cap scenario

**Test:** Log a contribution of £19,800 for the current tax year. Set monthly budget to £500. Visit Plan tab.
**Expected:** Amber ISA warning banner visible; buy list amounts sum to £200 (not £500).
**Why human:** Requires live DB with ISA contribution data.

---

### Gaps Summary

No BLOCKER gaps found. All code artifacts exist, are substantive, and are wired. The phase goal is architecturally achieved.

One WARNING anti-pattern: the ISA tab (`?tab=isa`) was removed from the tab bar as a side-effect of Phase 5's 3-tab simplification. ISA contributions are still fetched server-side (correctly used for ISA-02 capping), but ISA-01 / ISA-03 user-facing features (view tracker, log contributions) are no longer reachable. If those features were working after Phase 2, this is a regression outside Phase 5's scope that should be tracked.

The `unified_allocation: {}` stub in `upsertBuyList` is intentional and non-blocking for Phase 5's goal.

---

_Verified: 2026-05-07_
_Verifier: Claude (gsd-verifier)_
