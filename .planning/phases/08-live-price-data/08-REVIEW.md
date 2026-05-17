---
phase: 08-live-price-data
reviewed: 2026-05-17T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - pulse/src/app/dashboard/actions.ts
  - pulse/src/app/dashboard/page.tsx
  - pulse/src/components/PortfolioTab.tsx
  - pulse/src/components/TradingViewWidget.tsx
  - pulse/src/app/dashboard/components/BuyListTable.tsx
  - pulse/src/app/dashboard/components/ContributionCalculator.tsx
  - pulse/src/types/index.ts
  - pulse/src/app/dashboard/__tests__/price-actions.test.ts
  - pulse/src/__tests__/TradingViewWidget.test.tsx
  - pulse/src/__tests__/PortfolioTab.test.tsx
  - pulse/src/__tests__/BuyListTable.test.tsx
  - supabase/migrations/20260517_phase8_price_columns.sql
findings:
  critical: 5
  warning: 5
  info: 3
  total: 13
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-05-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 8 adds live price data via yahoo-finance2, a TradingView chart widget, and a per-ticker price column in the portfolio table. The overall structure is sound: auth gates are consistent, GBp÷100 conversion is implemented in both server actions, and the `.L` suffix boundary is respected. However, five blockers were found: a `saveCreatorWeight` authorization gap that allows any authenticated user to update another user's creator weight row, `priceFetchedAt` Date objects crossing the RSC→client boundary without serialization, a symbol-split bug in `TradingViewWidget` that fails on tickers containing colons, the budget slider hard-capping user input to £1,000 regardless of the saved budget, and the `Holding` type marking `currentPrice`/`priceFetchedAt` as optional (`?`) when the Phase 8 design requires them to be required-but-nullable.

---

## Critical Issues

### CR-01: `saveCreatorWeight` modifies rows by `user_creator_id` without verifying ownership

**File:** `pulse/src/app/dashboard/actions.ts:327-351`

**Issue:** The global-weight branch updates `user_creators` filtered only by `.eq('id', userCreatorId)`. The service client bypasses RLS, so any authenticated user who supplies an arbitrary `userCreatorId` UUID can overwrite another user's trust weight. The per-category branch has the same problem — the upsert keys on `user_creator_id` without confirming that row belongs to the authenticated user.

**Fix:**
```typescript
// Global weight branch — add user_id scope
const { error } = await svc
  .from('user_creators')
  .update({ trust_weight: weight })
  .eq('id', userCreatorId)
  .eq('user_id', user.id)   // ownership check

// Per-category branch — fetch user_creator first to verify ownership
const { data: uc, error: ucErr } = await svc
  .from('user_creators')
  .select('id')
  .eq('id', userCreatorId)
  .eq('user_id', user.id)
  .single()
if (ucErr || !uc) return { error: 'Something went wrong. Please try again.' }
// then proceed with upsert
```

---

### CR-02: `priceFetchedAt` Date objects are not serialized at the RSC→client boundary

**File:** `pulse/src/app/dashboard/page.tsx:276-283`

**Issue:** `holdingsPlain` serializes `currentValue`, `quantity`, and `currentPrice`, but `priceFetchedAt` is passed through as a raw `Date` object (`h.priceFetchedAt ?? null`). Next.js 15 App Router cannot serialize class instances across the server/client boundary — `Date` is a class instance. This will throw a runtime serialization error as soon as any holding has a non-null `price_fetched_at`, silently breaking the entire dashboard page render.

**Fix:**
```typescript
const holdingsPlain = holdings.map(h => ({
  ...h,
  currentValue: h.currentValue.toNumber(),
  quantity: h.quantity.toNumber(),
  currentPrice: h.currentPrice ? h.currentPrice.toNumber() : null,
  // Serialize Date → ISO string; deserialize in client component
  priceFetchedAt: h.priceFetchedAt ? h.priceFetchedAt.toISOString() : null,
  createdAt: h.createdAt.toISOString(),
  updatedAt: h.updatedAt.toISOString(),
}))
```
Then update `ClientHolding` in `PortfolioTab.tsx` to use `priceFetchedAt: string | null` and reconstruct with `new Date(priceFetchedAt)` before the staleness comparison.

---

### CR-03: `TradingViewWidget` symbol split breaks if ticker contains a colon

**File:** `pulse/src/components/TradingViewWidget.tsx:17`

**Issue:** `symbol.split(':')` with array destructuring `[exchange, ticker]` assumes exactly one colon. If a symbol has no colon (e.g., a bare ticker passed accidentally) or multiple colons, `ticker` will be `undefined` or wrong. More practically: if `holding.ticker` ever contains a colon (e.g., a class-B share code), the split produces three parts and `ticker` is the middle segment, corrupting the widget config silently.

The call site in `PortfolioTab.tsx:366` constructs `LSE:${holding.ticker}` — so `holding.ticker` must not contain a colon. But the validator regex `TICKER_RE = /^[A-Z0-9.]{1,20}$/` in `actions.ts` correctly rejects colons on the server, yet there is no client-side guard in the widget itself.

**Fix:**
```typescript
const colonIdx = symbol.indexOf(':')
if (colonIdx === -1) {
  // No exchange prefix — treat entire string as ticker, omit exchange prefix
  return
}
const exchange = symbol.slice(0, colonIdx)
const ticker = symbol.slice(colonIdx + 1)
if (!ticker) return  // guard: empty ticker after colon
```

---

### CR-04: Budget slider hard-caps user input at £1,000 — saved budgets above £1,000 are silently clamped

**File:** `pulse/src/app/dashboard/components/ContributionCalculator.tsx:67-90`

**Issue:** `BUDGET_MAX = 1000` is used both as the slider `max` and as the clamp ceiling on `onBlur`. If a user has saved a budget of, say, £1,500 via the Portfolio tab banner, `ContributionCalculator` receives `budget=1500` but the `onBlur` handler clamps it to `1000` on the first user interaction. The plan will silently compute with a lower budget than the user set, producing incorrect buy amounts. There is no warning to the user that their saved budget exceeds the slider range.

**Fix:** Either raise `BUDGET_MAX` to a reasonable upper bound (e.g., £5,000), or display an explicit warning when `budget > BUDGET_MAX` and avoid clamping a value that was set externally:
```typescript
onBlur={(e) => {
  const raw = parseInt(e.target.value, 10)
  if (!isNaN(raw)) {
    const clamped = Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, raw))
    onBudgetChange(clamped)
  }
}}
```
The slider value is not the issue — the problem is the `onBlur` clamp silently overwriting a legitimately higher saved budget when the user touches the number input.

---

### CR-05: `Holding.currentPrice` and `Holding.priceFetchedAt` typed as optional (`?`) instead of required-but-nullable

**File:** `pulse/src/types/index.ts:100-101`

**Issue:** The Phase 8 design adds `current_price` and `price_fetched_at` columns with `ADD COLUMN IF NOT EXISTS` (nullable, no default). The domain type mirrors this correctly in intent — but uses TypeScript optional properties (`currentPrice?: Decimal | null`, `priceFetchedAt?: Date | null`). Optional (`?`) means the property may be entirely absent from the object, while nullable (`| null`) means it is present but null. These are different: code doing `if (h.currentPrice === null)` will pass TypeScript's type checker even when `h.currentPrice` is `undefined` (field absent), leading to silent display bugs. The correct type is `currentPrice: Decimal | null` (required, nullable).

In `page.tsx:76-77` the mapping correctly sets these to `null` when absent, but the loose type permits future callers to omit the fields entirely.

**Fix:**
```typescript
// types/index.ts
currentPrice: Decimal | null    // required; null until first refresh (Phase 8)
priceFetchedAt: Date | null     // required; null until first refresh (Phase 8)
```
Remove the `?` sigil. Update any construction sites that omit the field to explicitly set `null`.

---

## Warnings

### WR-01: `refreshHoldingPrices` persists prices in a per-ticker sequential loop — one schema error aborts mid-batch silently

**File:** `pulse/src/app/dashboard/actions.ts:387-403`

**Issue:** The update loop iterates holdings one at a time. On a `42703` schema error it returns early, but any prices already written to the DB are committed while the rest are not. If the migration has been partially applied (e.g., one replica is ahead), this leaves the holdings table in a partially-updated state with no indication to the caller which tickers succeeded.

**Fix:** Collect all price updates and either run them as a batch upsert (single round-trip, atomic from the client perspective) or, at minimum, accumulate all errors and report them together rather than short-circuiting on first failure:
```typescript
// Replace sequential loop with batch update using .in()
// or collect errors and return them in results[]
```

---

### WR-02: `addHolding` / `updateHolding` validate ticker via length check but not the `TICKER_RE` regex

**File:** `pulse/src/app/dashboard/actions.ts:39, 69`

**Issue:** `refreshHoldingPrices` and `fetchTickerPrices` guard against invalid tickers with `isValidTicker()`, but `addHolding` and `updateHolding` only check `ticker.length > 20`. A ticker like `INVALID TICKER!` (with spaces or special chars) passes the add/update validation, gets stored in the DB, and then gets silently skipped (returned as `price: null`) by the price refresh — confusing the user. The regex `TICKER_RE` is defined but not applied at the write boundary.

**Fix:**
```typescript
if (!ticker || !isValidTicker(ticker)) return { error: 'Ticker must be 1–20 uppercase alphanumeric characters.' }
```

---

### WR-03: `TradingViewWidget` sets `script.innerHTML` — XSS risk if `symbol` contains attacker-controlled content

**File:** `pulse/src/components/TradingViewWidget.tsx:23`

**Issue:** `script.innerHTML = JSON.stringify({...})` assigns JSON-encoded content directly to a script tag's `innerHTML`. While `JSON.stringify` escapes most dangerous characters, it does NOT escape the sequence `</script>` — a value containing `</script>` in a JSON string will break out of the script context. If `symbol` is ever constructed from user-supplied ticker data that has not been server-validated (e.g., after a future refactor), this becomes exploitable XSS.

The current call site constructs `LSE:${holding.ticker}` where `holding.ticker` comes from the DB, which was validated on write. However, the widget itself has no guard and the risk is one refactor away from being live.

**Fix:** Use `script.textContent` instead of `script.innerHTML` — `textContent` does not parse HTML and is safe for injecting arbitrary text into script tags:
```typescript
script.textContent = JSON.stringify({ ... })
```

---

### WR-04: `makeSupabaseMock` in tests models only one `from()` table — second `.from()` call in `refreshHoldingPrices` returns the select mock

**File:** `pulse/src/app/dashboard/__tests__/price-actions.test.ts:82-86`

**Issue:** `from` is a single `vi.fn()` that returns both `{ select, update }` for every call. `refreshHoldingPrices` calls `supabase.from('holdings')` twice — once for SELECT and once for UPDATE. Both calls hit the same mock, so the select chain and update chain share state. A test that exercises the update path (e.g., the `42703` test) will correctly hit `updateFn`, but the mock does not assert which table name was passed to `from()`. If the implementation ever adds a second table, the mock will silently return the wrong behavior, and tests will continue to pass while the code is broken.

**Fix:** Assert on the `from()` argument or split the mock to return different objects per table name:
```typescript
fromFn.mockImplementation((table: string) => {
  if (table === 'holdings') return { select: selectFn, update: updateFn }
  throw new Error(`Unexpected table: ${table}`)
})
```

---

### WR-05: `ContributionCalculator` "Refresh Prices" button has no `type="button"` attribute

**File:** `pulse/src/app/dashboard/components/ContributionCalculator.tsx:99`

**Issue:** The `<button>` element for refreshing buy-list prices is missing `type="button"`. In HTML, a `<button>` without an explicit `type` defaults to `type="submit"`. If this button is ever placed inside a `<form>` element (e.g., during a future layout refactor), it will submit the form instead of calling `handleRefreshBuyListPrices`. The `PortfolioTab` equivalent at line 196 correctly specifies `type="button"`.

**Fix:**
```tsx
<button
  type="button"
  onClick={handleRefreshBuyListPrices}
  ...
>
```

---

## Info

### IN-01: `saveCreatorWeight` uses `as any` cast on the service client

**File:** `pulse/src/app/dashboard/actions.ts:322`

**Issue:** `const svc = createServiceClient() as any` discards all type safety on every subsequent `svc.from(...)` call. If the service client API changes (e.g., a method is renamed), TypeScript will not catch the break.

**Fix:** Type `createServiceClient()` properly, or at minimum cast to the Supabase client type: `const svc = createServiceClient() as SupabaseClient`.

---

### IN-02: `TradingViewWidget` test imports from wrong path

**File:** `pulse/src/__tests__/TradingViewWidget.test.tsx:8`

**Issue:** The test imports from `'../components/TradingViewWidget'` (relative from `src/__tests__/`), resolving to `src/components/TradingViewWidget`. The component lives at `pulse/src/components/TradingViewWidget.tsx` — this is correct. However, the other two test files (`PortfolioTab.test.tsx`, `BuyListTable.test.tsx`) import with `@/` aliases. Inconsistent import styles in tests make it harder to refactor paths.

**Fix:** Use the `@/components/TradingViewWidget` alias for consistency with the rest of the test suite.

---

### IN-03: `TICKER_RE` regex allows ticker `...` (three dots) — valid by regex, rejected by Yahoo Finance

**File:** `pulse/src/app/dashboard/actions.ts:22`

**Issue:** `TICKER_RE = /^[A-Z0-9.]{1,20}$/` permits strings composed entirely of dots (e.g., `...`). These pass `isValidTicker()` and will be submitted to Yahoo Finance with a `.L` suffix (`....L`), which will fail and return `null`. This is a minor UX annoyance rather than a security issue, but it could be tightened.

**Fix:** Require at least one alphanumeric character: `/^[A-Z0-9][A-Z0-9.]{0,19}$/`

---

_Reviewed: 2026-05-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
