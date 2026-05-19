# Phase 12: Watch List + Per-Creator Budget — Research

**Researched:** 2026-05-19
**Domain:** Watch list UI, per-creator budget model, share quantity calculation, ISA tab removal
**Confidence:** HIGH (all findings based on direct codebase inspection)

---

## Summary

Phase 12 replaces the existing category-blending buy list with a fundamentally different model: per-creator watch lists fed directly from Phase 11's `profile_stable` / `profile_latest` JSONB extraction, combined with a per-creator monthly £ budget that drives actual share quantity calculations at today's prices.

The existing `generator.ts` (category gap model) is superseded by a new `watchlist-generator.ts` (per-creator ticker model). The ISA tab (`isa-tab.tsx`) is removed entirely — its tab entry, panel rendering, and data fetching are all deleted from `dashboard/page.tsx`. The "Plan" / "Buy List" tab is renamed to "Watch List."

The architecture is well-understood because Phase 11 already delivered the data source (`profile_stable`, `profile_latest`) and Phase 8 delivered the price layer (`fetchTickerPrices`, `refreshHoldingPrices`). Phase 12 is primarily a **data model + UI replacement** with no new external services.

**Primary recommendation:** New `watchlist-generator.ts` pure function; new `WatchListTab` client component; per-creator budget stored in `user_creators` table via new `monthly_budget_gbp` column; `fetchTickerPrices` reused as-is for live prices.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WL-01 | Buy list replaced with watch list populated from creator picks (both extraction layers) | profile_stable + profile_latest JSONB already in creator_strategies; tickers in favoured_stocks[] and preferred_index_funds[] arrays |
| WL-02 | Watch list items display live prices via existing yahoo-finance2 integration | fetchTickerPrices() in actions.ts already handles this; reuse directly |
| WL-03 | User sets monthly £ amount per creator (not a category % split) | Requires new monthly_budget_gbp column on user_creators (or separate table); SQL migration needed |
| WL-04 | App calculates actual share quantities to buy per creator based on current picks and today's prices | New pure function: quantity = floor(budgetGbp / priceGbp); Decimal required; tickers with null price → quantity unknown |
| WL-05 | ISA tab removed from dashboard entirely | ISATab component, isa-actions.ts, isa_contributions data fetch, and 'isa' tab entry all removed from dashboard/page.tsx |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- **decimal.js for all £ and quantity arithmetic** — `new Decimal()` for every monetary value and share quantity calculation. No native JS `*` or `/` on floats.
- **No financial advice language** — All output framed as "creator-derived information." Never use "advice," "recommend," or "suggest" in user-facing strings.
- **ISA limit is UK tax year** — Phase 12 removes the ISA tab entirely (WL-05). ISA remaining allowance is no longer used as a cap in the new model.
- **RAG pattern for Claude** — Not directly relevant to Phase 12 (no new Claude calls). Creator picks come from already-extracted JSONB.
- **Manual-first (v1)** — All price refresh is user-triggered. No background jobs.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Extract creator picks from DB | API / Backend (RSC) | — | Supabase query in dashboard/page.tsx server component |
| Per-creator budget storage | Database | API / Backend | New column on user_creators; read/write via server action |
| Share quantity calculation | API / Backend (pure function) | — | Pure TS function, no I/O; can run server-side at page load |
| Live price fetch | API / Backend (server action) | — | yahoo-finance2 is server-only; fetchTickerPrices already exists |
| Watch list UI rendering | Browser / Client | — | Client component for price refresh UX and interactivity |
| ISA tab removal | API / Backend (RSC) | Browser / Client | Delete from page.tsx data fetching + tab bar + panel |

---

## Standard Stack

### Core (already installed — no new installs required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| decimal.js | ^10.6.0 | £ and quantity arithmetic | Project mandate; already in use |
| yahoo-finance2 | ^3.14.1 | Live price fetch | Already integrated in Phase 8; `fetchTickerPrices` reused |
| framer-motion | ^12.38.0 | UI animations | Already used in BuyListTable; reuse AnimatePresence |
| vitest | ^4.1.5 | Unit tests | Already configured |

**No new npm packages required for Phase 12.** [VERIFIED: pulse/package.json]

---

## Architecture Patterns

### System Architecture Diagram

```
dashboard/page.tsx (RSC)
  │
  ├─ Supabase: user_creators (monthly_budget_gbp) ──────────────────┐
  ├─ Supabase: creator_strategies (profile_stable, profile_latest) ──┤
  │                                                                   ▼
  │                                                   buildWatchList(creatorProfiles, budgets)
  │                                                   [watchlist-generator.ts — pure function]
  │                                                        │
  │                                                        ▼
  │                                              WatchListItem[] (ticker, name, conviction,
  │                                                               layer, creatorId, qty=null)
  │
  └─ Props → WatchListTab (client component)
                │
                ├─ "Refresh Prices" button
                │     │
                │     └─ fetchTickerPrices(tickers[]) → prices map
                │              [actions.ts — existing server action]
                │
                └─ quantities computed client-side from prices + budgets
                   (Decimal: floor(budgetGbp / priceGbp))
```

### Recommended Project Structure

```
pulse/src/
├── lib/
│   └── watchlist/
│       └── generator.ts          # New — pure function, WL-01, WL-04
├── app/
│   └── dashboard/
│       ├── watchlist-actions.ts  # New — saveCreatorMonthlyBudget server action (WL-03)
│       └── components/
│           └── WatchListTab.tsx  # New — replaces PlanTab + ContributionCalculator + BuyListTable (WL-01, WL-02, WL-04)
```

Files removed or gutted:
- `pulse/src/app/dashboard/isa-tab.tsx` — deleted (WL-05)
- `pulse/src/app/dashboard/isa-actions.ts` — deleted (WL-05)
- `pulse/src/app/dashboard/components/PlanTab.tsx` — deleted or gutted (replaced by WatchListTab)
- `pulse/src/app/dashboard/components/ContributionCalculator.tsx` — deleted or gutted
- `pulse/src/app/dashboard/components/BuyListTable.tsx` — deleted or gutted
- `pulse/src/lib/plan/generator.ts` — retained (not deleted) but no longer called from dashboard

### Pattern 1: Watch List Generator (Pure Function)

**What:** Given an array of `{ creatorId, displayName, profileStable, profileLatest, monthlyBudgetGbp }` records, produce a flat `WatchListItem[]` with deduplication across creators.

**Key design decisions:**
- Tickers come from `profile_stable.favoured_stocks` + `profile_stable.preferred_index_funds` (stable layer) and `profile_latest.favoured_stocks` + `profile_latest.preferred_index_funds` (latest layer, if non-null)
- Tickers with `ticker === null` are excluded (creator named company but no ticker cited)
- A ticker may appear from multiple creators → deduplicate by ticker, merging creator attributions
- `quantityToBuy` is calculated separately in the UI layer once prices are known (keeps generator pure / no I/O)
- Per-creator budget is stored as `Decimal` internally; serialized as string to DB

```typescript
// Source: inferred from extractor.ts CreatorProfile interface
export interface WatchListItem {
  ticker: string                     // non-null tickers only
  name: string
  conviction: 'high' | 'medium' | 'low'
  layer: 'stable' | 'latest'        // 'latest' if from profile_latest, else 'stable'
  creatorId: string
  creatorName: string
  rationale: string
}

export interface CreatorWatchList {
  creatorId: string
  creatorName: string
  monthlyBudgetGbp: Decimal
  items: WatchListItem[]             // deduplicated per this creator
}
```

**When to use:** Called server-side in `dashboard/page.tsx` RSC, same pattern as existing `generatePlan` call.

### Pattern 2: Share Quantity Calculation

**What:** Given `budgetGbp` (Decimal) and `priceGbp` (Decimal), compute whole shares to buy.

```typescript
// Source: CLAUDE.md decimal.js mandate + WL-04 requirement
function calcQuantity(budgetGbp: Decimal, priceGbp: Decimal): { quantity: Decimal; remainder: Decimal } {
  if (priceGbp.isZero() || priceGbp.isNegative()) return { quantity: new Decimal(0), remainder: budgetGbp }
  const quantity = budgetGbp.div(priceGbp).floor()          // whole shares only
  const remainder = budgetGbp.minus(quantity.mul(priceGbp)) // unspent
  return { quantity, remainder }
}
```

**Critical:** Use `Decimal.floor()` not `Math.floor()`. Fractional shares are not supported in UK ISAs.

### Pattern 3: Per-Creator Budget Storage

**What:** New `monthly_budget_gbp` NUMERIC column on `user_creators` table. Default: 0 (no budget set).

**SQL migration:**
```sql
ALTER TABLE public.user_creators
  ADD COLUMN IF NOT EXISTS monthly_budget_gbp NUMERIC(10, 2) NOT NULL DEFAULT 0;
```

**Server action pattern** (follows existing `saveCreatorWeight` in `actions.ts`):
```typescript
// watchlist-actions.ts
'use server'
export async function saveCreatorMonthlyBudget(
  userCreatorId: string,
  budgetGbp: number    // validated: >= 0
): Promise<ActionResult>
```

### Pattern 4: ISA Tab Removal (WL-05)

Files to delete/clean up in `dashboard/page.tsx`:
1. Remove `ISATab` import
2. Remove `isa_contributions` Supabase query (currently always-fetched regardless of tab)
3. Remove `contributions` variable and `ISAContribution` type import
4. Remove `currentTaxYear` / `getCurrentTaxYear()` if only used for ISA
5. Remove `isaRemainingNumber` calculation (no longer needed as budget cap)
6. Remove `isa` from the `Tab` type union and `tabs` array
7. Remove `activeTab === 'isa'` panel branch
8. Delete `isa-tab.tsx` and `isa-actions.ts` files

**Note:** `getCurrentTaxYear()` may be used elsewhere — check before deleting. `isaRemainingNumber` is currently passed to `generatePlan()` — if `generatePlan` is also removed from dashboard, this goes away naturally.

### Anti-Patterns to Avoid

- **Calling Claude in Phase 12** — picks come from stored JSONB, not fresh extraction. No new Claude calls.
- **Storing prices in DB** — per Phase 8 pattern, `fetchTickerPrices` is ephemeral (no DB write). Keep that pattern.
- **Fractional share quantities** — UK ISA only supports whole shares. Always `floor()` via Decimal.
- **Blending allocations** — the old `blendStrategies()` / `unified_allocation` model is abandoned in Phase 12. Do not carry it forward.
- **Native JS floats for quantity math** — `budgetGbp / priceGbp` must use Decimal, not native `/`.
- **Advice language in watch list UI** — rationale strings from `profile_stable.favoured_stocks[n].rationale` must be rendered as-is (creator's own words), not wrapped in directive language.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Price fetching | New Yahoo Finance wrapper | `fetchTickerPrices()` in `actions.ts` | Already handles GBp→GBP conversion, .L suffix, error fallback |
| £ rounding | Native Math.round | `Decimal.toDecimalPlaces(2, ROUND_HALF_UP)` | IEEE 754 float errors on money |
| Whole-share floor | Math.floor | `new Decimal(x).floor()` | Decimal precision guarantee |
| Ticker validation | Custom regex | `TICKER_RE = /^[A-Z0-9.]{1,20}$/` already in `actions.ts` | Proven, tested |
| Budget persistence | Custom form | Follow `saveCreatorWeight` pattern in `actions.ts` | Established auth + RLS pattern |

---

## Common Pitfalls

### Pitfall 1: Null tickers in creator profiles
**What goes wrong:** `profile_stable.favoured_stocks[n].ticker` can be `null` (D-02 in Phase 11 CONTEXT). If not filtered, null tickers cause yahoo-finance2 errors and pollute the watch list.
**Why it happens:** Creators name companies without citing tickers. Claude correctly returns null per the tool schema.
**How to avoid:** Filter `ticker !== null` before building the watch list. Only render items with a confirmed ticker symbol.
**Warning signs:** `fetchTickerPrices` receiving `null` or `"null"` as a ticker string.

### Pitfall 2: GBp vs GBP price division
**What goes wrong:** LSE tickers like LLOY return prices in GBp (pence). Dividing £500 budget by 4522 (pence) gives 0.11 shares instead of 11.
**Why it happens:** Yahoo Finance uses GBp for many LSE stocks.
**How to avoid:** `fetchTickerPrices` already handles GBp→£ conversion (divides by 100 when `q.currency === 'GBp'`). The returned price is always in £. The watch list generator must trust the returned price is in £.
**Warning signs:** Quantities near 0 for cheap UK stocks.

### Pitfall 3: Dashboard page.tsx over-fetches after ISA removal
**What goes wrong:** After removing the ISA tab, `isa_contributions` Supabase query may linger as dead code, wasting DB round-trips on every dashboard load.
**Why it happens:** The current `page.tsx` fetches contributions regardless of active tab (`// always fetched — plan needs isaRemaining`).
**How to avoid:** Remove the contributions query and `isaRemaining` calculation entirely in the same task as ISA tab removal.

### Pitfall 4: Creator with no profile_stable
**What goes wrong:** A tracked creator who has never been refreshed after the Phase 11 migration has `profile_stable = null`. Trying to read `profile_stable.favoured_stocks` throws.
**Why it happens:** Phase 11 requires a manual refresh to populate profiles. Creators tracked before Phase 11 have the old `allocation` model only.
**How to avoid:** Null-guard `profile_stable` in the watch list generator. If null, emit no items for that creator (show "Refresh creator to generate picks" in the UI).

### Pitfall 5: WatchListTab receiving stale Decimal objects across RSC boundary
**What goes wrong:** Next.js 15 cannot serialize `Decimal` class instances across the server/client boundary. Passing `monthlyBudgetGbp: new Decimal(...)` as a prop to a client component throws.
**Why it happens:** Class instances are not plain JSON. The existing `page.tsx` already handles this for holdings via `.toNumber()`.
**How to avoid:** Serialize all Decimal values to `number` at the RSC→client boundary (same as existing `holdingsPlain` pattern). Re-wrap in `new Decimal()` inside the client component where arithmetic is needed.

### Pitfall 6: Multiple creators backing the same ticker — double-counting budget
**What goes wrong:** If Creator A and Creator B both back AAPL, and each has a £500/month budget, the watch list might show "buy £1000 of AAPL" which could be confusing or misleading.
**Why it happens:** The per-creator budget model naturally allows overlap.
**How to avoid:** The watch list is displayed **per creator** (not deduplicated across creators for quantity purposes). Each creator's section shows their tickers and quantities independently. Cross-creator consensus is Phase 14 scope (SIG-01).

### Pitfall 7: Budget input allows values > £20,000 or negative
**What goes wrong:** Per-creator budget validation is absent; user can set nonsensical values.
**Why it happens:** No DB constraint or server-side validation defined yet.
**How to avoid:** Server action validates: `budgetGbp >= 0 && budgetGbp <= 20000`. DB column: `NUMERIC(10, 2) NOT NULL DEFAULT 0`. UI input: `min=0, max=20000, step=1`.

---

## Code Examples

### Reading creator profiles from Supabase (RSC pattern)

```typescript
// Source: extractor.ts interface + dashboard/page.tsx Supabase query pattern
const { data: stratRows } = await supabase
  .from('creator_strategies')
  .select('creator_id, profile_stable, profile_latest, confidence, extracted_at')
  .in('creator_id', trackedIds)
  .order('created_at', { ascending: false })

// Group by creator_id, keep latest row per creator (same dedup pattern as existing page.tsx)
```

### Reading per-creator budget from user_creators

```typescript
// After WL-03 migration adds monthly_budget_gbp column
const { data: ucRows } = await supabase
  .from('user_creators')
  .select('id, creator_id, trust_weight, monthly_budget_gbp')
  .eq('user_id', user.id)
  .in('creator_id', trackedIds)
```

### Watch list generator skeleton

```typescript
// Source: extractor.ts CreatorProfile interface
import { Decimal } from 'decimal.js'
import type { CreatorProfile } from '@/lib/strategy/extractor'

export interface WatchListItem {
  ticker: string
  name: string
  conviction: 'high' | 'medium' | 'low'
  layer: 'stable' | 'latest'
  rationale: string
}

export interface CreatorWatchList {
  creatorId: string
  creatorName: string
  monthlyBudgetGbp: number         // plain number at RSC→client boundary
  items: WatchListItem[]
  hasProfile: boolean              // false = never refreshed after Phase 11
}

export function buildWatchLists(
  creators: Array<{
    creatorId: string
    creatorName: string
    monthlyBudgetGbp: number
    profileStable: CreatorProfile | null
    profileLatest: CreatorProfile | null
  }>
): CreatorWatchList[]
```

### Quantity calculation (Decimal-safe)

```typescript
// Source: CLAUDE.md decimal.js mandate
import { Decimal } from 'decimal.js'

export function calcShareQuantity(
  budgetGbp: Decimal,
  priceGbp: Decimal
): { quantity: Decimal; spent: Decimal; remainder: Decimal } {
  if (priceGbp.isZero() || priceGbp.isNegative()) {
    return { quantity: new Decimal(0), spent: new Decimal(0), remainder: budgetGbp }
  }
  const quantity = budgetGbp.div(priceGbp).floor()
  const spent = quantity.mul(priceGbp).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  const remainder = budgetGbp.minus(spent).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  return { quantity, spent, remainder }
}
```

---

## DB Schema Changes Required

### Migration 1: per-creator monthly budget (WL-03)

```sql
ALTER TABLE public.user_creators
  ADD COLUMN IF NOT EXISTS monthly_budget_gbp NUMERIC(10, 2) NOT NULL DEFAULT 0;
```

Delivery: same pattern as Phase 7/8 — user runs in Supabase SQL Editor.

### No migration needed for watch list display
Phase 11 already added `profile_stable` and `profile_latest` JSONB columns to `creator_strategies`. No further schema changes required for WL-01, WL-02, WL-04.

### ISA tab removal — data stays
`isa_contributions` table and `public.users.monthly_budget` are **not dropped**. WL-05 removes only the UI and the data fetching from the dashboard page. The data remains in Supabase for potential future use.

---

## State of the Art

| Old Approach | New Approach | Phase Changed | Impact |
|--------------|------------------|--------------|--------|
| Category % allocation blending | Per-creator ticker picks | Phase 12 | `blendStrategies()` no longer called from dashboard |
| Buy list = category gap → fill ticker | Watch list = creator picks → share quantities | Phase 12 | `generatePlan()` no longer called from dashboard |
| Monthly budget = single global slider £200–£1000 | Per-creator monthly budget | Phase 12 | `users.monthly_budget` no longer drives plan |
| ISA tab shows contribution log + remaining allowance | ISA tab removed entirely | Phase 12 (WL-05) | `isa-tab.tsx`, `isa-actions.ts` deleted |
| Plan result type: `buy-list` / `no-strategy` / `no-fill-tickers` | Watch list with per-creator sections + price + quantity | Phase 12 | New result shape; old `PlanResult` type retired from dashboard |

**Files that become dead code after Phase 12:**
- `pulse/src/lib/plan/generator.ts` — still referenced by tests; do not delete, but no longer called from dashboard
- `pulse/src/lib/strategy/blender.ts` — same as above
- `pulse/src/app/dashboard/isa-tab.tsx` — delete
- `pulse/src/app/dashboard/isa-actions.ts` — delete
- `pulse/src/app/dashboard/plan-actions.ts` — `upsertBuyList` no longer called; `setFillTicker`/`clearFillTicker` may still be used in Portfolio tab (check before deleting)
- `pulse/src/app/dashboard/components/ContributionCalculator.tsx` — delete
- `pulse/src/app/dashboard/components/BuyListTable.tsx` — delete
- `pulse/src/app/dashboard/components/PlanTab.tsx` — delete

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `setFillTicker`/`clearFillTicker` in plan-actions.ts are only used from Portfolio tab, not from the plan/watch list tab | Code Examples / dead code list | If wrong: Portfolio tab breaks when plan-actions.ts is deleted. Mitigation: verify imports before deleting. |
| A2 | `getCurrentTaxYear()` is only used for ISA contribution filtering and can be removed | ISA Tab Removal section | If wrong: another file imports it and breaks. Mitigation: grep for usages before deleting. |
| A3 | Per-creator watch list display (one section per creator) is the right UX, rather than a deduplicated flat list | Pattern 1 / Pitfall 6 | If wrong: planner may need to reconsider the WatchListTab layout. Low risk — Phase 14 adds consensus view. |
| A4 | Whole shares only (floor) for quantity calculation — no fractional shares | Pattern 2 | UK ISA rule — if broker supports fractional, this is still the safe conservative default. |

---

## Open Questions

1. **What happens to the old `users.monthly_budget` field?**
   - What we know: currently drives the ContributionCalculator slider range (£200–£1000)
   - What's unclear: does Phase 12 repurpose it, or does it become unused?
   - Recommendation: Leave `users.monthly_budget` in the DB (no migration needed). Remove from dashboard data fetching when removing the ISA/Plan tab's reliance on it. Per-creator budgets replace it.

2. **Budget distribution UI — single input or slider per creator?**
   - What we know: WL-03 says "user sets £X/month per creator" — implies per-creator input
   - What's unclear: exact UI control (number input vs slider)
   - Recommendation: Number input per creator (£0–£5000, step £10), inline on each creator's watch list section. Slider is awkward at large £ values.

3. **How many tickers per creator are shown on the watch list?**
   - What we know: `favoured_stocks` and `preferred_index_funds` arrays can be any length; typically 5–20 items
   - What's unclear: whether to show all picks or rank/cap by conviction
   - Recommendation: Show all non-null tickers, sorted high→medium→low conviction. No hard cap. Planner to decide.

4. **What does the watch list show when a creator has `profile_latest` but no favoured stocks with tickers?**
   - What we know: conviction-based picks may all have `ticker: null`
   - What's unclear: empty-state copy
   - Recommendation: Show "Creator has not cited specific tickers in recent posts" per creator section.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 12 uses only already-installed packages (yahoo-finance2, decimal.js, framer-motion, vitest). No new external dependencies. All confirmed available via `pulse/package.json`. [VERIFIED: pulse/package.json]

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.5 |
| Config file | `pulse/vitest.config.ts` |
| Quick run command | `cd pulse && npx vitest run tests/watchlist-generator.test.ts` |
| Full suite command | `cd pulse && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WL-01 | buildWatchLists: populates items from profile_stable favoured_stocks | unit | `npx vitest run tests/watchlist-generator.test.ts` | Wave 0 |
| WL-01 | buildWatchLists: populates items from profile_latest when non-null | unit | `npx vitest run tests/watchlist-generator.test.ts` | Wave 0 |
| WL-01 | buildWatchLists: filters out null tickers | unit | `npx vitest run tests/watchlist-generator.test.ts` | Wave 0 |
| WL-03 | saveCreatorMonthlyBudget: rejects negative amounts | unit | `npx vitest run tests/watchlist-actions.test.ts` | Wave 0 |
| WL-04 | calcShareQuantity: floor division, GBp already converted | unit | `npx vitest run tests/watchlist-generator.test.ts` | Wave 0 |
| WL-04 | calcShareQuantity: returns 0 when price is 0 | unit | `npx vitest run tests/watchlist-generator.test.ts` | Wave 0 |
| WL-05 | ISA tab no longer renders in dashboard (manual) | manual | — | manual-only |

### Wave 0 Gaps

- [ ] `pulse/tests/watchlist-generator.test.ts` — covers WL-01, WL-04
- [ ] `pulse/tests/watchlist-actions.test.ts` — covers WL-03

*(Existing test infrastructure in `pulse/tests/` and `pulse/vitest.config.ts` already established in Phase 11 — no framework install needed.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing `createClient().auth.getUser()` pattern |
| V3 Session Management | yes | Existing Supabase session cookie pattern |
| V4 Access Control | yes | `.eq('user_id', user.id)` on all queries + RLS |
| V5 Input Validation | yes | `budgetGbp >= 0 && budgetGbp <= 20000` in server action |
| V6 Cryptography | no | No new cryptographic operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on saveCreatorMonthlyBudget | Tampering | Verify `user_creator_id` belongs to requesting user before update; follow `saveCreatorWeight` pattern |
| User-supplied ticker injection | Tampering | `TICKER_RE = /^[A-Z0-9.]{1,20}$/` already in actions.ts; apply before any yahoo-finance2 call |
| XSS via creator rationale strings | Tampering | Render rationale as JSX text node (same as existing BuyListTable `{item.rationale}` — never dangerouslySetInnerHTML) |

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)

- `pulse/src/lib/strategy/extractor.ts` — `CreatorProfile` interface, `FavouredStock`/`SectorFocus`/`PreferredIndexFund` shapes, null ticker design decision
- `pulse/src/app/dashboard/actions.ts` — `fetchTickerPrices`, `refreshHoldingPrices`, GBp conversion, `TICKER_RE`, `saveCreatorWeight` pattern
- `pulse/src/app/dashboard/page.tsx` — full dashboard RSC: tab structure, data fetching, ISA tab integration, Decimal serialization pattern
- `pulse/src/app/dashboard/isa-tab.tsx` — ISA tab contents (to be removed)
- `pulse/src/lib/plan/generator.ts` — existing buy list model (being superseded)
- `pulse/src/types/index.ts` — domain types
- `.planning/phases/11-creator-intelligence-extraction/11-CONTEXT.md` — D-01 through D-21, profile schema, null ticker decision
- `pulse/package.json` — installed deps and versions [VERIFIED]

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` — WL-01 through WL-05 definitions
- `.planning/ROADMAP.md` — Phase 12 description and Phase 14 dependency note (consensus is Phase 14 scope)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed, verified via package.json
- Architecture: HIGH — data source (Phase 11 JSONB), price layer (Phase 8), and existing patterns fully inspected
- DB schema change: HIGH — single column addition follows established migration pattern
- Pitfalls: HIGH — derived from direct code inspection (null ticker, GBp conversion already in tests)
- UI layout: MEDIUM — watch list UX not yet designed; open questions 2–4 remain

**Research date:** 2026-05-19
**Valid until:** 2026-06-19 (stable — no external services changing)
