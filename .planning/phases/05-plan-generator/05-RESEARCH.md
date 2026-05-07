# Phase 5: Plan Generator — Research

**Researched:** 2026-05-07
**Domain:** Pure TypeScript computation, Next.js 15 App Router, Supabase upsert, React client components
**Confidence:** HIGH

---

## Summary

Phase 5 is pure arithmetic and wiring — no AI calls, no new external services. `PlanGenerator.ts` is a pure TS function (like `blender.ts`) that computes how to allocate a monthly budget across preferred-fill tickers to close allocation gaps toward the blended strategy target. The function runs server-side at page load (D-05) and also client-side inside `ContributionCalculator` on slider changes (D-12).

The schema needs one new migration: add `is_fill_ticker BOOLEAN DEFAULT FALSE` to `public.holdings` (D-02). The `buy_lists` table already exists and supports upsert via `UNIQUE (user_id, month)`. The `BuyListItem` type in `types/index.ts` currently lacks `allocationGapPct` — the type must be extended. The `BuyList.items` JSONB column stores `amount_gbp` as a number (Decimal is a runtime object, not serializable); the API route must serialize `Decimal → string/number` before insert and deserialize on read.

The existing `blender.ts` / server action / `page.tsx` patterns cover everything needed — PlanGenerator follows the same pure-function pattern, the API route follows the `/api/refresh` route pattern, and the `ContributionCalculator` follows the `CreatorsTab` client-component-receiving-server-props pattern.

**Primary recommendation:** Build in wave order — schema migration → PlanGenerator pure function + tests → API route → ContributionCalculator client component → page.tsx integration.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: User designates one preferred fill ticker per category on the Holdings tab.
- D-02: Schema change — add mechanism to mark fill ticker. Planner decides: boolean column `is_fill_ticker` on `holdings` OR separate `user_category_fill_tickers (user_id, category, ticker)` table.
- D-03: No preferred ticker for a category that has holdings → skip category, show inline prompt "Mark a preferred holding for [Category] to include it in your plan."
- D-04: Category in blended strategy but user has zero holdings → show gap row only ("You're X% underweight in Bonds — add a holding to get started"). No purchase row emitted.
- D-05: Buy List auto-generates on page load — no explicit button. Dashboard server component calls PlanGenerator at render time.
- D-06: No blended strategy exists → placeholder card "Refresh a creator to generate your first Buy List."
- D-07: Plan storage is upsert / always overwrite — one current Buy List per user. No history in v1.
- D-08: Holdings + strategy exist but no preferred tickers marked anywhere → show category gap rows only, plus banner "Mark preferred holdings to get specific buy suggestions."
- D-09: Contribution Calculator lives inline on the dashboard — slider above Buy List table.
- D-10: Free drag + numeric input (not snapping to £50 steps). Integer value, £200–£1,000 range.
- D-11: Slider initialises to `users.monthly_budget` from DB. Falls back to £500 if null.
- D-12: Recompute is client-side only. PlanGenerator importable in Client Component. Strategy + portfolio passed as props from server component; calculator uses cached values for every recalculation.

### Claude's Discretion
- Layout and styling of Buy List table and category-gap rows (within existing Tailwind conventions).
- Exact column layout of Buy List table (ticker | category | amount | gap closed %).
- Whether ISA warning renders as a banner above the table or a footer note below it.

### Deferred Ideas (OUT OF SCOPE)
- Plan history / compare this month vs last month (v2)
- Automatic plan regeneration on trust-weight slider change (v2)
- Exporting the Buy List as CSV/PDF
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAN-01 | `PlanGenerator.ts` takes (portfolio + budget + blended strategy) → Buy List `{ ticker, category, amount_gbp, rationale }[]` | Pure function pattern from `blender.ts`; `Holding[]`, `BlendedStrategy`, `BuyListItem` types already defined |
| PLAN-02 | Buy List displays current allocation gap per asset class and how this month's contribution closes it | `BuyListItem` needs `allocationGapPct: number` field added; gap computation is arithmetic on portfolio total vs strategy target |
| PLAN-03 | After creator refresh updates strategy, next generated Buy List reflects new blended allocation | Auto-generate on page load (D-05) ensures freshness; no caching of old plan in client state |
| PLAN-04 | All plan output labelled "Creator-derived information — not financial advice"; no "advice"/"recommend" in output | Disclaimer rendered as static text below table; `rationale` field in `BuyListItem` must avoid prohibited words |
| ISA-02 | Plan Generator caps Buy List total to remaining ISA allowance; alerts user if budget exceeds remaining allowance | `isa_remaining` param to PlanGenerator; truncation logic + ISA warning surface in UI |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Gap computation (portfolio vs strategy) | API/Backend (server component) | Browser (client recompute) | Server computes on load; client recomputes on slider drag using cached data |
| ISA cap enforcement | PlanGenerator pure function | — | Must be enforced in the function itself, not only in the UI |
| Buy List persistence (upsert) | API/Backend (`/api/plan/generate`) | — | Supabase write requires service role; cannot run in browser |
| Contribution Calculator slider | Browser (Client Component) | — | Real-time recompute; no network call per D-12 |
| Fill-ticker marking UI | Browser (Client Component) | API/Backend (server action) | UI toggle in Holdings tab; server action persists to DB |
| Preferred ticker schema migration | Database | — | SQL editor migration; no CLI |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `decimal.js` | already installed | All £ arithmetic | CLAUDE.md mandatory constraint; avoids IEEE 754 errors |
| Next.js 15 App Router | already installed | Server component + API routes | Project stack; page.tsx pattern established |
| Supabase JS client | already installed | DB reads + upsert | Established `createClient()` / `createServiceClient()` pattern |
| TypeScript | already installed | PlanGenerator type safety | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | already installed | Unit tests for PlanGenerator | Pure function → full test coverage feasible |
| React `useState` / `useTransition` | built-in | ContributionCalculator state | Established pattern from `CreatorsTab`, `PortfolioTab` |

**Installation:** No new packages needed. [VERIFIED: codebase scan]

---

## Architecture Patterns

### System Architecture Diagram

```
page.tsx (Server Component)
  │
  ├── fetch: holdings (with is_fill_ticker), ISA contributions, blended strategy
  │
  ├── compute: isa_remaining = ISA_ANNUAL_LIMIT - sum(contributions for current tax year)
  │
  ├── compute: PlanGenerator(holdings, monthlyBudget, blendedStrategy, isa_remaining)
  │     │
  │     ├── [no strategy] → { type: 'no-strategy' }
  │     ├── [no fill tickers] → { type: 'no-fill-tickers', gapRows[] }
  │     └── [normal] → { type: 'buy-list', items: BuyListItem[], isaWarning? }
  │
  ├── server action: upsert buy_lists table (via /api/plan/generate or server action)
  │
  └── render: <PlanTab buyList={result} portfolio={holdings} strategy={blend}
                       isaRemaining={isa_remaining} initialBudget={monthlyBudget} />
                │
                ├── <ContributionCalculator>   ← 'use client'
                │     slider/input → PlanGenerator(cached portfolio, strategy, newBudget, isaRemaining)
                │     → re-renders BuyListTable in-browser, no network call
                │
                └── <BuyListTable>   ← pure display, receives items as props
                      ├── ISA warning banner/footer (if truncated)
                      ├── BuyListItem rows (ticker | category | £amount | gap%)
                      ├── CategoryGapRows (informational, no ticker)
                      └── Disclaimer: "Creator-derived information — not financial advice"
```

### Recommended Project Structure
```
pulse/src/
├── lib/plan/
│   └── generator.ts          # PlanGenerator pure function + types
│   └── generator.test.ts     # vitest unit tests
├── app/dashboard/
│   ├── plan-actions.ts        # upsertBuyList server action (or inline in page.tsx)
│   └── components/
│       ├── PlanTab.tsx           # 'use client' wrapper receiving props from page.tsx
│       ├── ContributionCalculator.tsx  # slider + numeric input, triggers recompute
│       └── BuyListTable.tsx      # pure display component
├── app/api/plan/
│   └── generate/route.ts      # POST: upsert buy_lists (optional; server action may suffice)
```

### Pattern 1: PlanGenerator Pure Function

**What:** Takes portfolio + budget + strategy + ISA remaining → returns typed result object (not throws). Follows `blender.ts` pattern exactly.

**When to use:** Called server-side in `page.tsx` at render time AND client-side in `ContributionCalculator` on slider change.

**Key constraint:** Must have zero server-only imports (no `@/lib/supabase/*`, no `next/headers`). This is what enables client-side recompute (D-12).

```typescript
// Source: blender.ts pattern [VERIFIED: codebase]
// lib/plan/generator.ts

import { Decimal } from 'decimal.js'
import type { Holding, AssetCategory } from '@/types'
import type { BlendedStrategy } from '@/lib/strategy/blender'

export type PlanResult =
  | { type: 'no-strategy' }
  | { type: 'no-fill-tickers'; gapRows: GapRow[] }
  | { type: 'buy-list'; items: BuyListItem[]; gapRows: GapRow[]; isaWarning: boolean; effectiveBudget: Decimal }

export interface BuyListItem {
  ticker: string
  category: AssetCategory
  amountGbp: Decimal          // decimal.js — never number
  allocationGapPct: number    // current gap this purchase partially closes
  rationale: string           // no "advice"/"recommend" wording (PLAN-04)
}

export interface GapRow {
  category: AssetCategory
  targetPct: number
  currentPct: number
  gapPct: number
  reason: 'no-holdings' | 'no-fill-ticker'
}

export function generatePlan(
  holdings: HoldingWithFillTicker[],
  budgetGbp: number,           // plain number input — wrap immediately
  strategy: BlendedStrategy,
  isaRemaining: number,        // plain number — wrap immediately
): PlanResult { ... }
```

**Note:** `BuyListItem` in `types/index.ts` currently lacks `allocationGapPct`. Either extend the existing type or keep a separate local type in `generator.ts`. Planner decision. [VERIFIED: types/index.ts read]

### Pattern 2: Gap Computation Algorithm

**What:** Core arithmetic. All Decimal arithmetic.

```
totalPortfolioValue = Σ holding.currentValue   [Decimal sum]

for each category in strategy.unified:
  targetPct = new Decimal(strategy.unified[category])
  targetValue = totalPortfolioValue.plus(budget).mul(targetPct).div(100)
  currentValue = Σ holdings where category matches (currentValue)
  gap = targetValue.minus(currentValue)           // positive = underweight
  if gap <= 0: skip (already at or above target)
  if no preferred fill ticker for category: emit GapRow, skip
  if no holdings in category: emit GapRow(reason='no-holdings'), skip

// Proportional allocation of budget to positive gaps
totalGap = Σ positive gaps
for each gap:
  rawAmount = budget.mul(gap).div(totalGap)       // proportional share

// ISA cap: if sum(rawAmounts) > isaRemaining, scale all down proportionally
effectiveBudget = Decimal.min(budget, isaRemaining)
// rescale: amount_i = rawAmount_i * effectiveBudget / sum(rawAmounts)
// Then round to 2 decimal places; adjust last item to absorb rounding remainder
```

**Critical:** Final sum of all `amountGbp` values must equal `effectiveBudget` exactly (per Phase 5 success criterion 1). Use "last item absorbs remainder" pattern.

### Pattern 3: Decimal Serialization for JSONB

**Problem:** `Decimal` is a runtime class — not JSON-serializable as-is. `buy_lists.items` is JSONB.

**Solution:** Serialize `amountGbp` as `string` (not `number`) in the JSONB payload to preserve precision. Deserialize with `new Decimal(row)` on read.

```typescript
// Serialize before upsert:
const serializedItems = items.map(item => ({
  ticker: item.ticker,
  category: item.category,
  amount_gbp: item.amountGbp.toFixed(2),  // string — preserves precision
  allocation_gap_pct: item.allocationGapPct,
  rationale: item.rationale,
}))

// Deserialize on read:
const items = raw.map(r => ({
  ...r,
  amountGbp: new Decimal(r.amount_gbp),
}))
```

[ASSUMED: storing as string is correct — JSON number precision is sufficient for 2dp £ values, but string is safer and matches `DbNumeric` pattern in the codebase]

### Pattern 4: Holdings with Fill Ticker

After schema migration, `holdings` table gains `is_fill_ticker BOOLEAN NOT NULL DEFAULT FALSE`. The `Holding` type in `types/index.ts` must be extended with `isFillTicker: boolean`.

```typescript
// Extended Holding type (add to types/index.ts):
export interface Holding {
  // ... existing fields ...
  isFillTicker: boolean   // TRUE = preferred buy target for this category
}
```

Schema constraint to add in migration: at most one `is_fill_ticker = TRUE` per `(user_id, category)`. This is enforced either via a partial unique index or application-level logic (toggle off old, toggle on new).

```sql
-- Migration (run via Supabase SQL editor — D-03):
ALTER TABLE public.holdings ADD COLUMN is_fill_ticker BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial unique index: only one fill ticker per user+category
CREATE UNIQUE INDEX holdings_one_fill_ticker_per_category
  ON public.holdings (user_id, category)
  WHERE is_fill_ticker = TRUE;
```

### Pattern 5: Upsert to buy_lists

`buy_lists` has `UNIQUE (user_id, month)`. Upsert on this constraint.

```typescript
// In server action or API route (uses service client — RLS bypass for write):
const svc = createServiceClient()
await svc.from('buy_lists').upsert(
  {
    user_id: userId,
    month: currentMonth,           // 'YYYY-MM' format
    budget_gbp: effectiveBudget.toFixed(2),
    items: serializedItems,        // JSONB
    unified_allocation: strategy.unified,
  },
  { onConflict: 'user_id,month' }
)
```

[VERIFIED: buy_lists UNIQUE constraint in schema.sql; upsert pattern from saveCreatorWeight in actions.ts]

### Pattern 6: ContributionCalculator Client Component

Follows `CreatorsTab` pattern — receives data as props, runs pure function locally.

```typescript
'use client'
// ContributionCalculator.tsx
interface Props {
  portfolio: HoldingWithFillTicker[]
  strategy: BlendedStrategy
  isaRemaining: number
  initialBudget: number    // from users.monthly_budget or 500 fallback
}

export function ContributionCalculator({ portfolio, strategy, isaRemaining, initialBudget }: Props) {
  const [budget, setBudget] = useState(initialBudget)
  const plan = useMemo(
    () => generatePlan(portfolio, budget, strategy, isaRemaining),
    [portfolio, budget, strategy, isaRemaining]
  )
  // Render slider + numeric input + BuyListTable
}
```

**Key:** `useMemo` ensures recompute only when `budget` changes (< 1ms for typical portfolio sizes).

### Anti-Patterns to Avoid

- **Float arithmetic for £:** `budgetGbp * allocationPct / 100` with native numbers → rounding errors. Use Decimal throughout the entire computation chain.
- **Calling PlanGenerator from a `'use server'` context that has server-only imports:** Prevents client-side recompute. Keep generator.ts free of all server deps.
- **Storing Decimal instances in JSONB:** `JSON.stringify(new Decimal(100))` produces `{}`. Always call `.toFixed(2)` before insert.
- **Page-load fetch on wrong tab:** Current `page.tsx` fetches holdings only when `activeTab === 'portfolio'`. Phase 5 needs holdings fetched for any tab that shows the Buy List. Need to either always fetch or add a 'plan' tab that fetches on load.
- **ISA remaining computed from all-time contributions:** Must filter by `tax_year = getCurrentTaxYear()` (already done in ISA tab — reuse this pattern).
- **Partial unique index not enforced:** Without the index, two holdings in the same category could both have `is_fill_ticker = TRUE`. Add the partial unique index in the migration.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Decimal rounding to 2dp | Custom rounding | `new Decimal(x).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)` | Off-by-one pence errors; last-item adjustment needed |
| ISA tax year boundary | Custom date logic | `getCurrentTaxYear()` from `lib/tax-year.ts` | Already handles 6 April UTC boundary correctly |
| Supabase upsert | Custom INSERT + UPDATE | `.upsert(..., { onConflict: 'user_id,month' })` | Established pattern; handles race conditions |
| Partial unique constraint | App-level "deselect old" logic | PostgreSQL partial unique index | DB-level guarantee; app logic can still fail |

---

## Common Pitfalls

### Pitfall 1: Decimal Not Serializable to JSON
**What goes wrong:** `JSON.stringify({ amountGbp: new Decimal(500) })` produces `{ "amountGbp": {} }` — Decimal instances are not JSON primitives.
**Why it happens:** Decimal is a class with prototype methods, not a plain value.
**How to avoid:** Always call `.toFixed(2)` (returns string) or `.toNumber()` before any JSONB insert. Use `.toFixed(2)` — preserves precision, survives DB round-trip.
**Warning signs:** Buy List items upserted but `amount_gbp` reads back as `{}` or `null`.

### Pitfall 2: generatePlan Imports Server-Only Modules
**What goes wrong:** If `generator.ts` imports anything from `@/lib/supabase/*` or uses `next/headers`, Next.js will refuse to bundle it for the browser → ContributionCalculator breaks at build time.
**Why it happens:** Next.js marks files importing `next/headers` as server-only.
**How to avoid:** `generator.ts` must be a pure module — no imports except `decimal.js` and local types. Pass all data as function arguments.
**Warning signs:** Build error "You're importing a component that needs `next/headers`" inside a Client Component.

### Pitfall 3: Holdings Fetch Gated Behind Wrong Tab
**What goes wrong:** `page.tsx` currently fetches holdings only when `activeTab === 'portfolio'`. If the Buy List is on a 'plan' tab (or always visible), holdings won't be fetched.
**Why it happens:** Phase 2's tab-conditional fetch was an optimisation for that phase.
**How to avoid:** Phase 5 must always fetch holdings (and ISA contributions for current tax year) regardless of active tab, since PlanGenerator needs both at render time.
**Warning signs:** Buy List always shows "no holdings" even though Portfolio tab shows holdings.

### Pitfall 4: Sum of Buy List != effectiveBudget
**What goes wrong:** Proportional allocation with `.toDecimalPlaces(2)` rounding on each item leaves a pence gap or excess — success criterion 1 fails.
**Why it happens:** Decimal rounding per-item does not guarantee sum equals whole.
**How to avoid:** Compute all items, sum them, then add/subtract the difference to/from the last item.
**Warning signs:** Integration test shows sum off by £0.01.

### Pitfall 5: Two Fill Tickers per Category
**What goes wrong:** Without DB-level enforcement, a race condition (or a bug) could mark two holdings in the same category as `is_fill_ticker = TRUE`. PlanGenerator would then allocate to the first one it finds (non-deterministic).
**Why it happens:** Application-level toggle logic alone is not atomic.
**How to avoid:** Add the partial unique index in the migration SQL. When toggling on a new fill ticker, the DB rejects the insert if another already exists (or use `UPDATE ... WHERE category = X AND user_id = Y SET is_fill_ticker = FALSE` before setting the new one).
**Warning signs:** Test: insert two holdings with `is_fill_ticker = TRUE` for same user+category — second insert should fail with unique violation.

### Pitfall 6: rationale Field Contains Prohibited Words
**What goes wrong:** PLAN-04 and CLAUDE.md explicitly prohibit "advice", "recommend", "suggest" in user-facing plan output.
**Why it happens:** Natural language for investment guidance uses these words.
**How to avoid:** Hardcode rationale templates that describe allocation mechanics, not recommendations. Example: "Tech is currently 15% of portfolio vs 40% target — adding to VUSA closes 12% of the gap."
**Warning signs:** Manual review of any rationale string containing "recommend", "advise", "suggest".

---

## Code Examples

### Computing ISA Remaining
```typescript
// Source: lib/tax-year.ts + isa-tab.tsx pattern [VERIFIED: codebase]
import { getCurrentTaxYear } from '@/lib/tax-year'
import { Decimal } from 'decimal.js'

const ISA_ANNUAL_LIMIT = new Decimal(20000)
const currentTaxYear = getCurrentTaxYear()

// contributions already filtered by .eq('tax_year', currentTaxYear) in Supabase query
const totalContributed = contributions.reduce(
  (sum, c) => sum.plus(new Decimal(c.amount)),
  new Decimal(0)
)
const isaRemaining = Decimal.max(ISA_ANNUAL_LIMIT.minus(totalContributed), new Decimal(0))
```

### Last-Item Rounding Adjustment
```typescript
// Ensure sum(items.amountGbp) === effectiveBudget exactly
const rawSum = items.reduce((s, i) => s.plus(i.amountGbp), new Decimal(0))
const diff = effectiveBudget.minus(rawSum)  // may be ±£0.01 due to rounding
if (items.length > 0) {
  items[items.length - 1].amountGbp = items[items.length - 1].amountGbp.plus(diff)
}
```

### Fill-Ticker Toggle Server Action
```typescript
// Source: saveCreatorWeight pattern [VERIFIED: actions.ts]
// plan-actions.ts
'use server'
export async function setFillTicker(holdingId: string, category: AssetCategory): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Something went wrong. Please try again.' }

  const svc = createServiceClient()
  // Clear existing fill ticker for this user+category, then set new one
  await svc.from('holdings')
    .update({ is_fill_ticker: false, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('category', category)
    .eq('is_fill_ticker', true)

  const { error } = await svc.from('holdings')
    .update({ is_fill_ticker: true, updated_at: new Date().toISOString() })
    .eq('id', holdingId)
    .eq('user_id', user.id)

  if (error) return { error: 'Something went wrong. Please try again.' }
  revalidatePath('/dashboard')
  return {}
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Separate API route for plan generation | Server action or server component data fetch + upsert | Simpler — one less route file; server actions handle upsert cleanly |
| Client fetches plan on load | Server component computes plan at render time (D-05) | No loading spinner; plan available on first paint |

---

## Open Questions

1. **`BuyListItem` type location: extend `types/index.ts` or define locally in `generator.ts`?**
   - What we know: `types/index.ts` already has `BuyListItem` with `amountGbp` but no `allocationGapPct`
   - What's unclear: extend the shared type (breaks existing code if the shape changes) vs keep a separate `PlanBuyListItem` in `generator.ts`
   - Recommendation: Extend `types/index.ts` BuyListItem to add `allocationGapPct: number` — it's part of PLAN-02 and the type was clearly intended to include it (CONTEXT.md references it). Update the `buy_lists.items` JSONB to store this field too.

2. **Plan tab placement: new tab or always-visible section?**
   - What we know: page.tsx currently has 3 tabs (portfolio, creators, isa). D-05 says auto-generate on page load.
   - What's unclear: does Phase 5 add a 4th "Plan" tab, or render the Buy List on an existing tab/section?
   - Recommendation: Add a 4th tab `plan` to the tab bar. This avoids gating holdings fetch behind a specific active tab and keeps concerns separated. Phase 6 can restructure layout.

3. **Upsert mechanism: server action vs API route?**
   - What we know: ROADMAP plans mention `/api/plan/generate` route, but CONTEXT.md says server component calls PlanGenerator at render time.
   - What's unclear: if server component calls PlanGenerator, it can upsert directly via server action without an API route.
   - Recommendation: Use a server action `upsertBuyList` (matches `saveCreatorWeight` pattern). The `/api/plan/generate` route is unnecessary for v1 — the ROADMAP predates the D-07 "always upsert" decision.

---

## Environment Availability

Step 2.6: SKIPPED — no new external dependencies. All required tools (Next.js, Supabase client, decimal.js, vitest) already installed and verified in prior phases.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (already installed, `globals: true`) |
| Config file | `pulse/vitest.config.ts` |
| Quick run command | `npx vitest run src/lib/plan/generator.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAN-01 | generatePlan returns BuyListItem[] with correct tickers + amounts | unit | `npx vitest run src/lib/plan/generator.test.ts` | Wave 0 |
| PLAN-02 | allocationGapPct correct per item | unit | `npx vitest run src/lib/plan/generator.test.ts` | Wave 0 |
| PLAN-03 | New strategy input produces updated Buy List | unit | `npx vitest run src/lib/plan/generator.test.ts` | Wave 0 |
| PLAN-04 | No prohibited words in rationale strings | unit | `npx vitest run src/lib/plan/generator.test.ts` | Wave 0 |
| ISA-02 | Budget > isaRemaining → items sum to isaRemaining, not budget | unit | `npx vitest run src/lib/plan/generator.test.ts` | Wave 0 |
| ISA-02 | Sum of items equals effectiveBudget to the penny | unit | `npx vitest run src/lib/plan/generator.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/plan/generator.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `pulse/src/lib/plan/generator.test.ts` — covers all PLAN-* and ISA-02 requirements
- [ ] `pulse/src/lib/plan/generator.ts` — the function under test

*(No new framework config needed — vitest already configured)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `getUser()` in every server action before DB write (established pattern) |
| V3 Session Management | no | Handled by Supabase Auth middleware (Phase 1) |
| V4 Access Control | yes | `.eq('user_id', user.id)` on all queries — defence-in-depth beyond RLS |
| V5 Input Validation | yes | Validate `budget` is integer 200–1000 before passing to PlanGenerator |
| V6 Cryptography | no | No new crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Budget parameter manipulation (client sends arbitrary budget) | Tampering | Server action re-reads `monthly_budget` from DB; ContributionCalculator budget is display-only (not written to buy_lists unless within validated range) |
| Upsert another user's buy list | Elevation of Privilege | `.eq('user_id', user.id)` + RLS `USING (auth.uid() = user_id)` |
| Fill-ticker toggle for holding not owned by user | Tampering | `.eq('user_id', user.id)` on UPDATE scopes to own holdings |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Storing `amount_gbp` as string in JSONB preserves precision correctly | Pattern 3 (Decimal Serialization) | Low — 2dp max, string "500.00" round-trips perfectly; only cosmetic impact |
| A2 | `useMemo` recompute of PlanGenerator completes in < 100ms for typical portfolio (< 50 holdings) | ContributionCalculator pattern | Low — pure arithmetic, no I/O; benchmarking not done but order-of-magnitude safe |
| A3 | Adding a 4th "Plan" tab is the right placement for the Buy List (vs always-visible section) | Open Questions #2 | Medium — Phase 6 will redesign layout; wrong choice here means more restructuring in Phase 6 |

---

## Sources

### Primary (HIGH confidence)
- `pulse/src/types/index.ts` — BuyListItem, BuyList, Holding, ISAContribution, BlendedStrategy types verified
- `pulse/src/lib/strategy/blender.ts` — pure function pattern, BlendedStrategy output shape verified
- `.planning/phases/01-foundation/schema.sql` — buy_lists, holdings table definitions verified
- `pulse/src/app/dashboard/actions.ts` — saveCreatorWeight upsert pattern, getUser() auth guard verified
- `pulse/src/app/dashboard/page.tsx` — tab-conditional fetch pattern, server component structure verified
- `pulse/src/lib/tax-year.ts` — getCurrentTaxYear(), ISA boundary logic verified
- `pulse/vitest.config.ts` — test framework config verified

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions D-01 through D-12 — user decisions from discuss-phase session

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in codebase, no new dependencies
- Architecture: HIGH — pure function pattern directly mirrors blender.ts; all integration points verified in existing code
- Pitfalls: HIGH — Decimal serialization and server-only import issues verified from codebase patterns; tab fetch gating confirmed by reading page.tsx

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 (stable stack)
