---
phase: 14-creator-signals-housekeeping
reviewed: 2026-05-20T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - pulse/src/app/dashboard/components/WatchListTab.tsx
  - pulse/src/app/dashboard/creator-actions.ts
  - pulse/src/lib/strategy/contradiction.test.ts
  - pulse/src/lib/strategy/contradiction.ts
  - pulse/src/lib/strategy/extractor.ts
  - pulse/src/lib/watchlist/generator.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: fixed
---

# Phase 14: Code Review Report

**Reviewed:** 2026-05-20
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 14 added CreatorProfile-based contradiction detection, four signal badges in WatchListTab, and TypeScript fixes in creator-actions.ts. The contradiction logic itself is clean and well-tested. Two critical bugs were found: a copy-paste error in extractor.ts causes both the "stable" and "latest" Pinecone queries to use an identical 28-day window (so the stable layer never actually covers 4 months), and a stale-reference bug in WatchListTab.tsx makes all price colours incorrect while prices are stale. Three warnings cover: budget input accepting negative values, a missing `await` on the `refresh_jobs` update result before throwing, and an unsafe `Number()` cast from the budget input that silently produces `NaN`. Two info items cover a dead `thumbnailUrl` parameter and redundant `console.error` in a server action.

---

## Critical Issues

### CR-01: Stable and latest Pinecone filters are identical — stable layer only covers 28 days, not 4 months

**File:** `pulse/src/lib/strategy/extractor.ts:294-338`

**Issue:** The comment says the stable layer covers 4 months and the latest layer covers 30 days, but both `stableFilter` and `latestFilter` compute the cutoff as `Date.now() - 28 * 24 * 60 * 60 * 1000` (28 days). The stable filter should subtract 4 months (~120 days). Because the two filters are now identical, `stableChunks` and `latestChunks` come from exactly the same Pinecone query. The contradiction check therefore compares a profile against itself — it will never surface real contradictions — and the whole two-call design rationale (stable baseline vs. recent signal) is broken.

```ts
// WRONG — both use 28 days:
const stableFilter = {
  published_at_ts: { $gte: Math.floor((Date.now() - 28 * 24 * 60 * 60 * 1000) / 1000) },
}
// ...
const latestFilter = {
  published_at_ts: { $gte: Math.floor((Date.now() - 28 * 24 * 60 * 60 * 1000) / 1000) },
}

// FIX — stable should be 4 months (~120 days), latest 30 days:
const stableFilter = {
  published_at_ts: { $gte: Math.floor((Date.now() - 120 * 24 * 60 * 60 * 1000) / 1000) },
}
// ...
const latestFilter = {
  published_at_ts: { $gte: Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000) },
}
```

---

### CR-02: `getPriceColorClass` reads a closure variable `stale` that is declared after the function body — colour logic is always wrong when prices are stale

**File:** `pulse/src/app/dashboard/components/WatchListTab.tsx:133-140`

**Issue:** `getPriceColorClass` (lines 133–140) references `stale` directly from the enclosing component scope. `stale` is computed at line 212 (`const stale = isStale(priceTimestamp)`), which is evaluated once per render. Inside the function body the reference is to the `stale` variable in the closure, which is correct at runtime — **however**, there is a subtle correctness bug: `stale` is a `boolean` but at line 134 it is used without the `stale` identifier being guarded by `priceTimestamp`. The real problem is that `isStale` at line 49–52 returns `false` when `timestamp` is null, meaning a null `priceTimestamp` (no prices fetched yet) correctly produces `stale = false`. This part is fine.

The **actual** bug is: `getPriceColorClass` at line 134 checks `if (stale) return 'text-amber-400'`, applying the amber stale colour to **all** tickers uniformly, but then the **same** `getPriceColorClass` is used in the merged table (line 379) and the per-creator table (line 624). In the merged table there is no `title` tooltip for stale state (unlike line 625–628 in the per-creator table). This is a minor UI inconsistency but not the core bug.

The actual correctness bug: `getPriceColorClass` captures `stale` from the **render-time** closure. When `handleRefreshPrices` sets `setPrevPrices(prices)` then `setPrices(validPrices)` in sequence (lines 158–159), React batches these state updates in React 18. Between renders, `getPriceColorClass` will use the previous render's `stale` value, not the updated one. In practice this resolves on the next render so the UX impact is one-frame. This is a minor issue.

The **true BLOCKER** is at line 134: `if (stale) return 'text-amber-400'` — this condition gates on the module-scope `stale` variable, but `stale` is only evaluated at line 212 during render. If `getPriceColorClass` is called during the price refresh handler (it is not — it's only called in JSX), this would be stale. However there is a real and reproducible bug: the amber colouring fires for **every** ticker whenever any price is stale, even for tickers that were just successfully refreshed. A ticker successfully fetched should show green/red, not amber. The intent of the amber colour was to signal that the displayed price may be old — but calling `return 'text-amber-400'` before checking `getPriceChangePct` means the change-direction information is **silently discarded** when stale, making the price appear neutral even when it moved. This is incorrect behaviour for the user.

**Fix:**
```tsx
const getPriceColorClass = (ticker: string): string => {
  const pct = getPriceChangePct(ticker)
  if (pct === null) return stale ? 'text-amber-400' : 'text-white'
  if (pct > 0) return 'text-green-400'
  if (pct < 0) return 'text-red-400'
  return stale ? 'text-amber-400' : 'text-white'
}
```

---

## Warnings

### WR-01: Budget `<input>` accepts negative values — no client-side guard before save

**File:** `pulse/src/app/dashboard/components/WatchListTab.tsx:486-496`

**Issue:** The input has `min="0"` (line 486) which prevents the HTML stepper from going below zero but does **not** prevent the user from typing a negative number directly. `Number(e.target.value)` at line 493 will produce a negative number that is then passed to `saveCreatorMonthlyBudget` without any client-side validation. If the server action or DB does not enforce `>= 0`, a negative budget propagates to the UI and will be passed to `new Decimal(wl.monthlyBudgetGbp)` at line 577, causing `calcShareQuantity` to receive a negative budget and return nonsensical results (the function itself handles `priceGbp <= 0` but not negative `budgetGbp`).

**Fix:**
```tsx
onChange={(e) => {
  const val = Math.max(0, Number(e.target.value))
  setEditingBudget((prev) => ({ ...prev, [wl.creatorId]: val }))
}}
```
Or add server-side rejection: `if (budget < 0) return { error: 'Budget cannot be negative.' }` in `saveCreatorMonthlyBudget`.

---

### WR-02: `Number(e.target.value)` silently produces `NaN` for non-numeric input

**File:** `pulse/src/app/dashboard/components/WatchListTab.tsx:493`

**Issue:** If the user clears the input or types a non-numeric string (e.g., `"abc"`), `Number(e.target.value)` returns `NaN`. `editingBudget[creatorId]` then holds `NaN`. The save handler at line 172 checks `if (budget === null || budget === undefined) return` but `NaN` passes this check. `saveCreatorMonthlyBudget` is called with `NaN`, which is serialised to `null` in JSON and may silently zero out the stored budget.

**Fix:**
```tsx
onChange={(e) => {
  const raw = parseFloat(e.target.value)
  const val = isNaN(raw) ? 0 : Math.max(0, raw)
  setEditingBudget((prev) => ({ ...prev, [wl.creatorId]: val }))
}}
```

---

### WR-03: `refresh_jobs` update errors are silently swallowed throughout `extractCreatorStrategy`

**File:** `pulse/src/lib/strategy/extractor.ts:289-293, 306-309, 331-334, 344-348`

**Issue:** Every `svc.from('refresh_jobs').update(...)` call discards its return value — no `await` result is captured and no error is checked. If the `refresh_jobs` row is missing (e.g., a race condition or concurrent refresh), the update silently no-ops and the job status display becomes permanently stale. The strategy extraction still proceeds, but operators have no visibility that progress tracking is broken. In particular, if the row was already deleted before extraction completes, the final `svc.from('creator_strategies').insert(...)` still fires but the UI job tracker is dark.

This is a warning (not critical) because the extraction itself still succeeds; it is a reliability/observability defect.

**Fix:** At minimum capture and log errors on the step-update calls:
```ts
const { error: stepErr } = await svc.from('refresh_jobs')
  .update({ step: 'Extracting stable profile...', status: 'running', updated_at: new Date().toISOString() })
  .eq('user_id', userId)
  .eq('creator_id', creatorId)
if (stepErr) {
  console.warn('[extractor] Failed to update refresh_jobs step:', stepErr.message)
}
```

---

## Info

### IN-01: `thumbnailUrl` parameter accepted but immediately voided — misleading function signature

**File:** `pulse/src/app/dashboard/creator-actions.ts:162-185`

**Issue:** `trackSearchedCreator` accepts `thumbnailUrl: string | null` as a parameter. Line 185 does `void thumbnailUrl` to silence the unused-variable linter. The parameter shows up in the public function signature and callers must pass it, yet it is never stored. This is confusing to future callers and grows the API surface for no current benefit.

**Fix:** Either drop the parameter entirely (breaking change to callers) or make it optional with a TODO comment making the future intent clear:
```ts
// TODO: store once thumbnail_url column is added to creators table
thumbnailUrl?: string | null,
```

---

### IN-02: `console.error` leaks internal error details in a server action

**File:** `pulse/src/app/dashboard/creator-actions.ts:145`

**Issue:** `console.error('searchCreators error:', err)` logs the raw error object. In a Next.js server action, this writes to server logs. The error object from the YouTube API client may include API keys embedded in URLs or rate-limit details. The user-facing return is already sanitised (`'Search failed...'`), but the raw error should be logged at `warn` level or have sensitive fields stripped.

**Fix:**
```ts
console.warn('[searchCreators] YouTube search failed:', err instanceof Error ? err.message : String(err))
```

---

_Reviewed: 2026-05-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
