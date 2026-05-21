# Phase 14: Creator Signals + Housekeeping — Research

**Researched:** 2026-05-20
**Domain:** TypeScript signal computation, React badge UI, contradiction.ts redesign
**Confidence:** HIGH

---

## Summary

Phase 14 is a pure computation + UI phase. All required data (`profile_stable`, `profile_latest`)
is already loaded by `page.tsx` RSC and forwarded to `WatchListTab`. No new API calls, DB tables,
or server actions are needed. The four signals are derived from existing JSONB fields entirely
client-side.

The most structurally significant change is the redesign of `contradiction.ts`. The current
implementation compares two `AllocationMap` (category → percentage) objects. The redesigned
function must compare two `CreatorProfile` objects — checking for high-conviction tickers that
disappeared and sector stance flips. The old `ContradictionResult` interface (with `shifts[]`)
becomes unused; the new one is simpler (`hasContradiction`, `reason`).

`creator-actions.ts` has two confirmed TS errors (TS2353/TS2339) at lines 95 and 102 inside
`addCustomCreator`. Both are caused by the TypeScript inference returning `never[]` for the
`.insert().select()` chain — a known pattern when the Supabase client type cannot resolve the
table schema dynamically. The fix is a targeted type cast, matching the pattern already used
at line 202–203 in the same file for `trackSearchedCreator`.

**Primary recommendation:** Derive all four signals in the UI layer (client-side, inside
`WatchListTab`). No persistence to DB — contradiction result is recomputed on each page load
from the JSONB already in memory.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Signals render as badges/chips on existing Watch List creator cards — no new tab
- D-02: SIG-01 — "Consensus" chip on tickers in "All Picks" with `creators.length >= 2`; derive in UI layer; no generator changes
- D-03: SIG-02 — one badge per creator card; compare `profile_stable.sector_focus` vs `profile_latest.sector_focus`; case-insensitive sector name match; majority drift direction wins; no badge if `profile_latest` is null
- D-04: SIG-03 — "⚠ Contradiction" badge on creator card; tooltip shows reason; triggered by (a) high-conviction ticker absent from `profile_latest.favoured_stocks` OR (b) sector stance flip `bullish ↔ cautious`; no badge if `profile_latest` is null
- D-05: SIG-04 — "No recent posts" badge + 80% opacity when `profile_latest === null`; visual only; does NOT affect `calcShareQuantity`
- D-06: `contradiction.ts` new signature: `(stable: CreatorProfile, latest: CreatorProfile | null) → ContradictionResult` where `ContradictionResult = { hasContradiction: boolean; reason: string | null }`
- D-07: If `latest` is null, return `{ hasContradiction: false, reason: null }`
- D-08: Update `extractor.ts` call-site to pass both layers
- D-09: Claude decides persist vs recompute — chosen: recompute client-side (simpler)
- D-10: Compare 2 snapshots only — no historical row reads
- D-11: Sector matching by name, case-insensitive; unmatched sectors ignored
- D-12: Inactive = `profile_latest === null`
- D-13: Cadence does NOT affect `calcShareQuantity` or budget allocation
- D-14: Fix TS errors in `creator-actions.ts` (TS2353/TS2339); scope = `npx tsc --noEmit` passes
- D-15: `unified_allocation: {}` stub in `upsertBuyList` — do NOT remove
- D-16: VALIDATION.md nyquist remediation, Phase 3/6 VERIFICATION.md — out of scope

### Claude's Discretion
- Whether contradiction detection is persisted to DB or recomputed client-side — **chosen: client-side** (D-09)
- Exact badge colour/size/placement within card — follow glassmorphism aesthetic from Phase 12
- Whether SIG-02 badge appears in creator card header or footer chip row — match Phase 12/13 conventions

### Deferred Ideas (OUT OF SCOPE)
- Headline detail view (popover/drawer)
- Auto-scheduled news refresh
- Per-ticker news feed page
- VALIDATION.md nyquist remediation
- Phase 3/Phase 6 formal VERIFICATION.md
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SIG-01 | Consensus signal surfaces when 2+ tracked creators back the same ticker | `MergedWatchListItem.creators[]` already populated by `buildMergedWatchList`; check `creators.length >= 2` in render |
| SIG-02 | Sentiment trend tracks whether creator is becoming more bullish or cautious | Compare `profile_stable.sector_focus[].stance` vs `profile_latest.sector_focus[].stance` by sector name |
| SIG-03 | Contradiction detection flags when recent videos contradict established stance | Redesign `contradiction.ts` to accept `(CreatorProfile, CreatorProfile | null)`; check ticker disappearance + stance flips |
| SIG-04 | Creator cadence tracked; creators with no recent posts carry visual indicator | `profile_latest === null` is the cadence flag; already meaningful state from Phase 11 extractor |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SIG-01 Consensus chip | Browser/Client (WatchListTab render) | — | Data already in `MergedWatchListItem.creators[]`; pure UI derive |
| SIG-02 Sentiment trend badge | Browser/Client (WatchListTab render) | — | `profile_stable`/`profile_latest` already in `CreatorWatchList` props |
| SIG-03 Contradiction badge + reason | Browser/Client + `contradiction.ts` lib | — | `contradiction.ts` is a pure function; called in render from props |
| SIG-04 Cadence opacity + badge | Browser/Client (WatchListTab render) | — | `wl.hasProfile` false = `profile_stable` null; `profile_latest` null = no recent posts |
| contradiction.ts redesign | Library (`src/lib/strategy/`) | `extractor.ts` call-site | Pure function — no I/O; extractor call-site updated to pass new signature |
| TS error fix | Server Action (`creator-actions.ts`) | — | Type cast fix, no logic change |

---

## Standard Stack

### Core (already installed — no new packages)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| React 19 | installed | Client component rendering, hooks | `[VERIFIED: codebase]` |
| Framer Motion | installed | Animation (opacity for SIG-04) | Phase 12 pattern — `motion.div` with `animate` prop |
| Tailwind CSS | installed | Badge styling | Existing CONVICTION_CLASS pattern to follow |
| TypeScript | installed | Type safety for new `ContradictionResult` | TS errors to fix in `creator-actions.ts` |

**No new packages required.** [VERIFIED: codebase scan]

---

## Architecture Patterns

### System Architecture Diagram

```
page.tsx (RSC)
  └─ supabase: SELECT creator_strategies (profile_stable, profile_latest)
       └─ buildWatchLists() → CreatorWatchList[]
            └─ WatchListTab (client component)
                 ├─ buildMergedWatchList() → MergedWatchListItem[]
                 │    └─ [render] item.creators.length >= 2 → "Consensus" chip (SIG-01)
                 │
                 └─ per creator card render:
                      ├─ profile_latest === null → SIG-04 (opacity + "No recent posts" badge)
                      ├─ computeSentimentTrend(stable, latest) → SIG-02 badge
                      └─ detectContradiction(stable, latest) → SIG-03 badge + tooltip
```

`contradiction.ts` (pure lib function) is called directly in the client render — no round-trip.

### Recommended Project Structure
No structural changes. New helpers slot into existing files:

```
pulse/src/
├── lib/strategy/
│   └── contradiction.ts         ← redesigned (D-06); old AllocationMap logic replaced
├── app/dashboard/
│   ├── creator-actions.ts       ← TS2353/TS2339 fixed (D-14)
│   └── components/
│       └── WatchListTab.tsx     ← badges added inline; no new component files needed
```

### Pattern 1: SIG-01 Consensus — inline chip in "All Picks" table

The "All Picks" table already renders `item.creators`. Add a chip to the `Holding` cell when
`item.creators.length >= 2`. No changes to `generator.ts`.

```tsx
// Source: WatchListTab.tsx — existing "All Picks" table row [VERIFIED: codebase]
{item.creators.length >= 2 && (
  <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded px-1.5 py-0.5">
    Consensus
  </span>
)}
```

### Pattern 2: SIG-02 Sentiment Trend — pure comparison function

```typescript
// [ASSUMED] — derived from CONTEXT.md D-03 / D-11 specification
type SentimentTrend = 'bullish' | 'cautious' | null

function computeSentimentTrend(
  stable: CreatorProfile,
  latest: CreatorProfile | null,
): SentimentTrend {
  if (!latest) return null
  let towardBullish = 0, towardCautious = 0
  const latestMap = new Map(
    latest.sector_focus.map((s) => [s.sector.toLowerCase(), s.stance])
  )
  for (const sf of stable.sector_focus) {
    const latestStance = latestMap.get(sf.sector.toLowerCase())
    if (!latestStance) continue  // D-11: unmatched sectors ignored
    if (sf.stance !== 'bullish' && latestStance === 'bullish') towardBullish++
    if (sf.stance !== 'cautious' && latestStance === 'cautious') towardCautious++
  }
  if (towardBullish > towardCautious) return 'bullish'
  if (towardCautious > towardBullish) return 'cautious'
  return null  // mixed or unchanged
}
```

### Pattern 3: SIG-03 Contradiction — redesigned contradiction.ts

Current file exports `runContradictionCheck(prev: AllocationMap | null, next: AllocationMap)`.
The redesign **replaces** this export entirely. The `extractor.ts` call-site currently passes
`runContradictionCheck(null, {})` — a hardcoded no-op. After redesign, extractor can remain
calling it with `(null, {})` if we keep a compatibility shim, OR the extractor call-site is
updated to pass `(stableProfile, latestProfile)` as per D-08.

**Decision (D-09):** recompute client-side. Extractor call-site at line 381 of `extractor.ts`
can either be removed or replaced with a no-op that matches the new signature. The easiest
path: keep the extractor call as `runContradictionCheck(stableProfile, latestProfile)` and
let the result feed `has_contradiction` / `contradiction_note` DB columns as before — this
also gives persisted values as a free bonus without extra complexity.

```typescript
// Source: CONTEXT.md D-04 / D-06 specification [VERIFIED: CONTEXT.md]
export interface ContradictionResult {
  hasContradiction: boolean
  reason: string | null
}

export function runContradictionCheck(
  stable: CreatorProfile,
  latest: CreatorProfile | null,
): ContradictionResult {
  if (!latest) return { hasContradiction: false, reason: null }  // D-07

  const reasons: string[] = []

  // Check (a): high-conviction stable ticker absent from latest favoured_stocks
  const latestTickers = new Set(
    latest.favoured_stocks.map((s) => s.ticker?.toUpperCase()).filter(Boolean)
  )
  for (const stock of stable.favoured_stocks) {
    if (
      stock.conviction === 'high' &&
      stock.ticker &&
      !latestTickers.has(stock.ticker.toUpperCase())
    ) {
      reasons.push(`${stock.ticker} was high conviction but absent from recent picks`)
    }
  }

  // Check (b): sector stance flipped bullish ↔ cautious
  const latestSectorMap = new Map(
    latest.sector_focus.map((s) => [s.sector.toLowerCase(), s.stance])
  )
  for (const sf of stable.sector_focus) {
    const latestStance = latestSectorMap.get(sf.sector.toLowerCase())
    if (!latestStance) continue
    if (
      (sf.stance === 'bullish' && latestStance === 'cautious') ||
      (sf.stance === 'cautious' && latestStance === 'bullish')
    ) {
      reasons.push(`${sf.sector}: ${sf.stance} → ${latestStance}`)
    }
  }

  if (reasons.length === 0) return { hasContradiction: false, reason: null }
  return { hasContradiction: true, reason: reasons.join('; ') }
}
```

**Import update in extractor.ts:** The `runContradictionCheck` call at line 381 passes
`(null, {})`. After redesign, pass `(stableProfile, latestProfile)` so the DB columns
`has_contradiction` / `contradiction_note` contain real data. The `contradiction_note`
column corresponds to `reason` in the new interface (rename in insert at line 396).

### Pattern 4: SIG-04 Cadence — opacity wrapper

```tsx
// Source: CONTEXT.md D-05 [VERIFIED: CONTEXT.md]
// Wrap existing creator card motion.div:
<motion.div
  ...
  style={{ opacity: wl.profileLatest === null ? 0.8 : 1 }}
>
```

`wl.profileLatest` is not currently on `CreatorWatchList`. Two options:
1. Add `profileLatest: CreatorProfile | null` to `CreatorWatchList` (requires `generator.ts` change)
2. Add `isInactive: boolean` flag to `CreatorWatchList`

`CreatorWatchList` currently has `hasProfile: boolean` (false = `profile_stable` null).
SIG-04 needs `profile_latest === null` (has stable profile, but no recent posts). These are
distinct states. **Recommended:** add `profileLatestNull: boolean` to `CreatorWatchList` and
set it in `buildWatchLists`. Minimal change, no type leakage.

```typescript
// generator.ts addition [ASSUMED — simplest approach]
export interface CreatorWatchList {
  creatorId: string
  creatorName: string
  monthlyBudgetGbp: number
  items: WatchListItem[]
  hasProfile: boolean
  profileLatestNull: boolean   // NEW: true when profile_latest === null AND hasProfile === true
  profileStable: CreatorProfile | null    // NEW: needed for SIG-02/SIG-03 client-side compute
  profileLatest: CreatorProfile | null    // NEW: needed for SIG-02/SIG-03 client-side compute
}
```

Wait — `WatchListTab` receives `CreatorWatchList[]` but currently has no access to the raw
profiles for SIG-02/SIG-03. The signals need `profile_stable` and `profile_latest` in the
client component.

**Resolution:** Extend `CreatorWatchList` to carry both profiles as additional fields. They
are already loaded in `page.tsx` RSC and passed to `buildWatchLists`. This is the minimal
change that avoids a new prop on `WatchListTab`.

### Pattern 5: TS Error Fix — creator-actions.ts

**Confirmed errors (lines 95, 102):** Inside `addCustomCreator`, the `serviceClient` is typed
as the return type of `createServiceClient()` which the type system narrows incorrectly when
the import is dynamic (`await import(...)`). The fix already applied at line 202–203 for
`trackSearchedCreator` is: cast `serviceClient as any` and cast the result.

```typescript
// creator-actions.ts lines 93-103 — current (broken):
const { data: newCreator, error: insertError } = await serviceClient
  .from('creators')
  .insert({ channel_url: rawUrl, display_name: displayName, is_active: true })
  .select('id')
  .single()
...
creatorId = newCreator.id   // TS2339: Property 'id' does not exist on type 'never'

// Fix — match trackSearchedCreator pattern (lines 201-218):
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { data: newCreator, error: insertError } = await (serviceClient as any)
  .from('creators')
  .insert({ channel_url: rawUrl, display_name: displayName, is_active: true })
  .select('id')
  .single()
...
creatorId = (newCreator as { id: string }).id
```

### Anti-Patterns to Avoid

- **Do NOT add a new tab or page for signals** — D-01 is locked; badges only on existing cards
- **Do NOT call supabase from WatchListTab for profiles** — data is already in props; extra fetch = unnecessary DB query
- **Do NOT remove `unified_allocation: {}` from `upsertBuyList`** — D-15 is explicit
- **Do NOT use `Math.round` for any monetary value** — decimal.js rule; signals are visual only so plain numbers are fine here, but ensure no signal code touches `calcShareQuantity`
- **Do NOT export `ContradictionResult` with `shifts[]`** — old interface; the new one has only `hasContradiction` + `reason`; any consumer of `shifts` must be updated (extractor.ts only stores `hasContradiction` + `contradiction_note`)

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tooltip/hover for SIG-03 reason | Custom tooltip component | Native HTML `title` attribute or Tailwind `group/peer` pattern | Already used nowhere in codebase; `title` is sufficient for v1; no dep needed |
| Contradiction logic | Homebrew diff engine | Redesigned `contradiction.ts` | Already has the right structure; isolated pure function |

**Key insight:** All four signals are single-pass comparisons over arrays of length < 20.
No performance concern. No memoisation needed for v1.

---

## Runtime State Inventory

Step 2.5 SKIPPED — Phase 14 is not a rename/refactor/migration phase. No runtime state affected.

---

## Common Pitfalls

### Pitfall 1: `CreatorWatchList` type mismatch after adding fields

**What goes wrong:** `buildWatchLists` return type is used in `page.tsx` and `WatchListTab`.
Adding fields to the interface without updating `buildWatchLists` causes TS errors at the
return site.
**Why it happens:** The interface is the contract; the builder must set every field.
**How to avoid:** Update interface, builder, and all destructuring sites in one wave.
**Warning signs:** TS error "Property X does not exist on type CreatorWatchList" at compile.

### Pitfall 2: `contradiction.ts` export name collides with `extractor.ts` import

**What goes wrong:** `extractor.ts` imports `runContradictionCheck` by name. After redesign
the signature changes from `(AllocationMap | null, AllocationMap) → ContradictionResult` to
`(CreatorProfile, CreatorProfile | null) → ContradictionResult`. The call-site at line 381
passes `(null, {})` — this will be a TS error after the redesign because `null` is no longer
a valid first argument (must be `CreatorProfile`).
**How to avoid:** Update the call-site in `extractor.ts` simultaneously with the redesign.
Pass `(stableProfile, latestProfile)` — both already in scope at that point.
**Warning signs:** TS2345 argument type error on line 381 of extractor.ts post-redesign.

### Pitfall 3: `ContradictionResult.note` vs `reason` rename

**What goes wrong:** Old interface has `note: string | null`. New interface (D-06) uses
`reason: string | null`. The `extractor.ts` INSERT at line 396 references `contradiction.note`
for the `contradiction_note` DB column. After redesign, this becomes `contradiction.reason`.
**How to avoid:** Update the INSERT object key at line 396 simultaneously.

### Pitfall 4: SIG-04 opacity on wrong element

**What goes wrong:** Applying 80% opacity to a child element instead of the outer
`motion.div` card causes only part of the card to dim.
**How to avoid:** Apply `style={{ opacity: ... }}` to the outermost card wrapper —
the `motion.div` with `className="backdrop-blur-xl ..."`.

### Pitfall 5: `getPriceColorClass` references `stale` before signal badge code

**What goes wrong:** Line 109 of WatchListTab references the variable `stale` declared
at line 187. If badge code is inserted above line 187 and also references `stale`, it will
fail at runtime (temporal dead zone for `const`).
**How to avoid:** All badge-rendering code goes inside JSX (below the `const stale = ...`
declaration), not in the top-level function scope.

---

## Code Examples

### SIG-01 Consensus in "All Picks" row

```tsx
// Source: WatchListTab.tsx existing "All Picks" table, Holding cell [VERIFIED: codebase]
<td className="py-2 pr-2">
  <a href={tradingViewUrl(item.ticker, currency ?? '')} ... >
    {item.ticker}<ExternalLinkIcon />
  </a>
  <p className="text-xs text-zinc-400">{item.name}</p>
  {item.creators.length >= 2 && (
    <span className="mt-0.5 inline-block text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded px-1.5 py-0.5">
      Consensus
    </span>
  )}
</td>
```

### SIG-02 Sentiment badge on creator card header

```tsx
// [ASSUMED styling — follow Phase 12/13 chip conventions]
{(() => {
  const trend = computeSentimentTrend(wl.profileStable!, wl.profileLatest)
  if (!trend) return null
  return trend === 'bullish' ? (
    <span className="text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/30 rounded-full px-2 py-0.5">
      Trending bullish
    </span>
  ) : (
    <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5">
      Trending cautious
    </span>
  )
})()}
```

### SIG-03 Contradiction badge with tooltip

```tsx
// [ASSUMED — native title is sufficient for v1]
{(() => {
  const { hasContradiction, reason } = runContradictionCheck(wl.profileStable!, wl.profileLatest)
  if (!hasContradiction) return null
  return (
    <span
      title={reason ?? undefined}
      className="text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/30 rounded-full px-2 py-0.5 cursor-help"
    >
      Contradiction
    </span>
  )
})()}
```

### SIG-04 Cadence — opacity + badge

```tsx
// Apply to the outer motion.div [ASSUMED]
<motion.div
  key={wl.creatorId}
  variants={itemVariants}
  className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4 space-y-3"
  style={{ opacity: wl.profileLatestNull ? 0.8 : 1 }}
>
  {/* Creator header row */}
  <div className="flex items-start justify-between gap-4 flex-wrap">
    <div className="flex items-center gap-2 flex-wrap">
      <p className="text-xl font-semibold text-white">{wl.creatorName}</p>
      {wl.profileLatestNull && (
        <span className="text-xs font-semibold text-zinc-500 bg-zinc-700/40 border border-zinc-600/30 rounded-full px-2 py-0.5">
          No recent posts
        </span>
      )}
      {/* SIG-02 and SIG-03 badges here */}
    </div>
    ...
  </div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `runContradictionCheck(AllocationMap, AllocationMap)` | `runContradictionCheck(CreatorProfile, CreatorProfile | null)` | Phase 14 | Old `shifts[]` result unused; extractor call-site updated |
| Contradiction always returns false (extractor passes `null, {}`) | Real comparison using `profile_stable` / `profile_latest` | Phase 14 | `has_contradiction` column in DB will now contain real data |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `profileLatestNull` flag added to `CreatorWatchList` (instead of passing raw profile) | Architecture Patterns §Pattern 4 | Planner may prefer passing full profiles; either approach works |
| A2 | Native HTML `title` attribute is sufficient for SIG-03 contradiction tooltip in v1 | Don't Hand-Roll | If user expects richer tooltip, needs Radix UI or similar; no new dep needed if `title` accepted |
| A3 | SIG-02/SIG-03 helper functions defined inline in WatchListTab (not extracted to separate lib file) | Architecture Patterns §Pattern 2/3 | Could go in `src/lib/watchlist/signals.ts`; either is valid |
| A4 | Badge placement: SIG-02/SIG-03 badges beside creator name in card header; SIG-04 "No recent posts" also in header | Code Examples | Could be a chip row below header; planner may choose differently |

---

## Open Questions

1. **`computeSentimentTrend` tie-breaking**
   - What we know: D-03 says "majority drift direction wins"; equal counts → no badge
   - What's unclear: What if `towardBullish === towardCautious > 0`? (Sectors split evenly)
   - Recommendation: Return `null` (no badge) on a tie — safest, least misleading

2. **`contradiction.ts` — keep or remove old `ContradictionResult.shifts[]` and `note` field?**
   - What we know: Only consumer is `extractor.ts` which reads `.hasContradiction` and `.note`
   - What's unclear: `.note` → `.reason` rename; is `contradiction_note` DB column name fine?
   - Recommendation: Rename to `reason` in interface; update extractor INSERT to use `reason`; DB column name unchanged

3. **`extractor.ts` line 381 call-site — keep DB persistence or make it a no-op?**
   - What we know: D-09 says recompute client-side; but extractor already writes `has_contradiction`/`contradiction_note` to DB
   - What's unclear: Should we keep this real computation in extractor (free bonus) or remove it?
   - Recommendation: Keep it — pass `(stableProfile, latestProfile)` at line 381, get real values in DB for free. Aligns with D-08.

---

## Environment Availability

Step 2.6: SKIPPED — no external dependencies. All signals derived from existing in-memory data. TS fix requires only `npx tsc --noEmit` for verification (Node/npm already confirmed in environment).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | TypeScript compiler (`tsc --noEmit`) — primary gate |
| Config file | `pulse/tsconfig.json` |
| Quick run command | `cd pulse && npx tsc --noEmit` |
| Full suite command | `cd pulse && npx tsc --noEmit` (no test runner detected) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SIG-01 | Consensus chip appears on tickers with 2+ creators | smoke (visual) | `npx tsc --noEmit` (type safety) | ❌ visual-only |
| SIG-02 | Sentiment badge correct for bullish/cautious drift | unit (manual) | `npx tsc --noEmit` | ❌ no test file |
| SIG-03 | Contradiction badge fires on ticker drop + stance flip | unit (manual) | `npx tsc --noEmit` | ❌ no test file |
| SIG-04 | Cadence opacity + badge when profile_latest null | smoke (visual) | `npx tsc --noEmit` | ❌ visual-only |
| Housekeeping | `npx tsc --noEmit` passes for creator-actions.ts | automated | `cd pulse && npx tsc --noEmit` | ✅ (TS compiler) |

### Sampling Rate
- **Per task commit:** `cd pulse && npx tsc --noEmit`
- **Per wave merge:** `cd pulse && npx tsc --noEmit`
- **Phase gate:** `npx tsc --noEmit` exits 0 before `/gsd-verify-work`

### Wave 0 Gaps
- No new test files needed — signals are pure UI; contradiction logic testable by inspection
- TS compiler is the primary automated gate for this phase

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes — badge text from AI profile | Profile data is server-extracted and stored; client renders as text (no `dangerouslySetInnerHTML`); React escapes by default |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via contradiction reason string | Tampering | React JSX escapes string content; `title` attribute also escaped by browser; no risk |
| Contradiction reason leaking financial advice framing | Info disclosure | Reason strings are generated by `contradiction.ts` (deterministic template strings), not by Claude; no advice language possible |

---

## Project Constraints (from CLAUDE.md)

- No financial advice language — badge labels must be observational ("Consensus", "Contradiction", "No recent posts", "Trending bullish/cautious")
- decimal.js for all £ arithmetic — signals are visual only; no monetary arithmetic in signal code; `calcShareQuantity` untouched
- RAG pattern — not applicable (no new Claude calls)
- Manual-first — not applicable (no background jobs)
- ISA limit — not applicable

---

## Sources

### Primary (HIGH confidence)
- `[VERIFIED: codebase]` — `pulse/src/lib/watchlist/generator.ts` — `CreatorWatchList`, `MergedWatchListItem`, `buildWatchLists`, `buildMergedWatchList`
- `[VERIFIED: codebase]` — `pulse/src/lib/strategy/extractor.ts` — `CreatorProfile` type, `PROFILE_TOOL_DEF`, extractor call-site at line 381
- `[VERIFIED: codebase]` — `pulse/src/lib/strategy/contradiction.ts` — current `AllocationMap`-based impl; full interface to be replaced
- `[VERIFIED: codebase]` — `pulse/src/app/dashboard/creator-actions.ts` — TS2353 at line 95, TS2339 at line 102; fix pattern at lines 201–218
- `[VERIFIED: codebase]` — `pulse/src/app/dashboard/components/WatchListTab.tsx` — badge/chip patterns, card structure, Phase 13 news badge
- `[VERIFIED: codebase]` — `pulse/src/app/dashboard/page.tsx` — how profiles loaded and forwarded
- `[VERIFIED: tsc output]` — `npx tsc --noEmit` in pulse/ confirms exactly 2 errors, both in `creator-actions.ts`

### Secondary (MEDIUM confidence)
- `[CITED: CONTEXT.md decisions D-01 through D-16]` — locked implementation decisions

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; codebase verified
- Architecture: HIGH — all data flow traced through source files
- Pitfalls: HIGH — TS errors confirmed via compiler; type boundary issues identified by reading actual code
- Signal logic: HIGH — `CreatorProfile` schema verified; computation rules from locked decisions

**Research date:** 2026-05-20
**Valid until:** 2026-06-20 (stable codebase; no third-party dep changes expected)
