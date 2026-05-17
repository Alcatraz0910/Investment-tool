---
phase: 8
plan: "08-01"
subsystem: price-data
tags: [yahoo-finance2, server-actions, supabase, decimal.js, testing]
dependency_graph:
  requires: []
  provides:
    - refreshHoldingPrices server action
    - fetchTickerPrices server action
    - Holding.currentPrice and Holding.priceFetchedAt fields
    - Phase 8 SQL migration (current_price, price_fetched_at columns)
    - price-actions test coverage
  affects:
    - pulse/src/types/index.ts
    - pulse/src/app/dashboard/actions.ts
    - pulse/src/app/dashboard/page.tsx
tech_stack:
  added:
    - yahoo-finance2 v3.14.1 (server-side LSE price fetch)
  patterns:
    - new YahooFinance() instance (v3 class-based API; static methods are deprecated/never)
    - Promise.all per-ticker batch with individual try/catch (partial failure isolation)
    - GBp÷100 via new Decimal(price).div(100).toNumber()
    - 42703 error → human-readable schema migration message
    - vi.hoisted() + real function constructor mock for class-based npm modules
key_files:
  created:
    - supabase/migrations/20260517_phase8_price_columns.sql
    - pulse/src/app/dashboard/__tests__/price-actions.test.ts
  modified:
    - pulse/src/types/index.ts
    - pulse/src/app/dashboard/actions.ts
    - pulse/src/app/dashboard/page.tsx
    - pulse/package.json
    - pulse/package-lock.json
decisions:
  - "Use new YahooFinance() instance not default export static methods — v3 API marks static quote() as deprecated returning never type"
  - "isValidTicker /^[A-Z0-9.]{1,20}$/ validates before every yahooFinance.quote call — malicious strings never reach yahoo-finance2"
  - "price stored as string in DB update (price.toString()) matching DbNumeric convention"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-17"
  tasks_completed: 6
  tasks_total: 6
  files_created: 2
  files_modified: 5
  tests_added: 11
  tests_passing: 11
---

# Phase 8 Plan 01: Foundation Summary

**One-liner:** yahoo-finance2 v3 installed with two server actions (GBp/100, 42703 migration guard, 50-ticker cap) and 11 unit tests covering all threat-model mitigations.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 8-01-01 | Install yahoo-finance2 | f8306a5 | pulse/package.json, pulse/package-lock.json |
| 8-01-02 | Create SQL migration file | 3ed9354 | supabase/migrations/20260517_phase8_price_columns.sql |
| 8-01-03 | Extend Holding interface | 2e9f0d1 | pulse/src/types/index.ts |
| 8-01-04 | Add server actions | 3e2d51b | pulse/src/app/dashboard/actions.ts |
| 8-01-05 | Extend page.tsx SELECT and serialization | 1be2ae4 | pulse/src/app/dashboard/page.tsx |
| 8-01-06 | Write price-actions.test.ts | 4b48728 | pulse/src/app/dashboard/__tests__/price-actions.test.ts |

## What Was Built

### yahoo-finance2 v3 Integration

Installed `yahoo-finance2@^3.14.1`. Key discovery: the v3 package exports a class (`YahooFinance`) where the static `quote()` method is typed as `...never` (deprecated). All calls must use `new YahooFinance().quote(...)`. The plan specified `import yahooFinance from 'yahoo-finance2'` (static usage) — adapted to `new YahooFinance()` to satisfy TypeScript.

### SQL Migration

`supabase/migrations/20260517_phase8_price_columns.sql` adds `current_price NUMERIC` and `price_fetched_at TIMESTAMPTZ` to `public.holdings`. Both columns use `IF NOT EXISTS` (idempotent). User must run this manually in Supabase SQL Editor before price refresh will work.

### Type Extension

`Holding` interface gains two optional fields: `currentPrice?: Decimal | null` and `priceFetchedAt?: Date | null`. All existing code constructing `Holding` objects continues to compile unchanged.

### Server Actions

`refreshHoldingPrices()`:
- Fetches all user holdings tickers from DB
- Promise.all batch with per-ticker try/catch (partial failure cannot abort batch)
- isValidTicker() gate before every yahoo-finance2 call
- GBp detection: `q.currency === 'GBp'` → `new Decimal(price).div(100).toNumber()`
- Writes to DB with `.eq('user_id', user.id)` on both SELECT and UPDATE (RLS + app-level)
- 42703 code → returns human-readable message directing to SQL migration
- Calls `revalidatePath('/dashboard')` on success

`fetchTickerPrices(tickers)`:
- Same pattern as above but no DB write (D-02: Buy List prices are React state only)
- Hard cap: `tickers.length > 50` returns error immediately
- Does NOT call `revalidatePath`

### page.tsx Extension

SELECT extended with `current_price, price_fetched_at`. Holdings map adds `currentPrice` (as `Decimal | null`) and `priceFetchedAt` (as `Date | null`). `holdingsPlain` serialization converts `currentPrice` to `number | null` (Decimal cannot cross RSC→client boundary) and passes `priceFetchedAt` as `Date | null` (Date serializes fine in Next.js 15).

### Tests

11 tests covering all plan acceptance criteria and threat-model mitigations:
- Unauthenticated call returns error (both actions)
- Empty holdings → `{ results: [] }`
- Thrown fetch → `{ price: null, error: 'fetch failed' }` (partial failure isolation)
- GBp currency → price divided by 100 via Decimal
- 42703 update error → migration message containing 'Phase 8 migration'
- Invalid ticker format → skipped, price: null, yahoo-finance2 NOT called
- >50 tickers → immediate error without calling yahoo-finance2

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] yahoo-finance2 v3 API requires class instantiation**

- **Found during:** Task 4 (TypeScript type check after adding import)
- **Issue:** Plan specified `import yahooFinance from 'yahoo-finance2'` and called `yahooFinance.quote(...)` as a static method. In yahoo-finance2 v3, the default export is a class where static methods are typed as `(...args: unknown[]) => never` (explicitly deprecated). TypeScript reported errors: `Property 'regularMarketPrice' does not exist on type 'never'`.
- **Fix:** Changed import to `import YahooFinance from 'yahoo-finance2'` and added `const yahooFinance = new YahooFinance()` at module scope. All `yahooFinance.quote(...)` calls remain identical.
- **Files modified:** pulse/src/app/dashboard/actions.ts (import + instantiation lines)
- **Commit:** 3e2d51b

**2. [Rule 1 - Bug] Test mock for class constructor must use real function not arrow**

- **Found during:** Task 6 (first vitest run)
- **Issue:** `vi.fn().mockImplementation(() => ({ quote: mockQuote }))` is an arrow function — `new MockYahooFinance()` throws `TypeError: () => ({ quote: mockQuote }) is not a constructor`.
- **Fix:** Replaced with `function MockYahooFinance(this: ...) { this.quote = mockQuote }` (real function, constructable).
- **Files modified:** pulse/src/app/dashboard/__tests__/price-actions.test.ts
- **Commit:** 4b48728

## Known Stubs

None — this plan is infrastructure only (types, SQL, server actions, tests). No UI rendering stubs.

## Threat Surface Scan

No new network endpoints beyond the two server actions defined in the plan's threat model. Both actions are covered by the threat model's mitigations (ticker validation, auth guard, 50-ticker cap, user_id scoping).

## Pre-existing Test Failures (Out of Scope)

`parser.test.ts` has 2 pre-existing failures (HL preset `quantityCol` assertion mismatch — `'Units held'` vs `'Units'`). These exist on the main branch before Phase 8. Not introduced by this plan; not fixed (out of scope per deviation rules).

## Self-Check

### Created files exist:
- supabase/migrations/20260517_phase8_price_columns.sql: EXISTS
- pulse/src/app/dashboard/__tests__/price-actions.test.ts: EXISTS

### Commits exist:
- f8306a5: chore(08-01): install yahoo-finance2 — FOUND
- 3ed9354: chore(08-01): SQL migration — FOUND
- 2e9f0d1: feat(08-01): Holding interface — FOUND
- 3e2d51b: feat(08-01): server actions — FOUND
- 1be2ae4: feat(08-01): page.tsx SELECT — FOUND
- 4b48728: test(08-01): price-actions.test.ts — FOUND

### TypeScript: no new errors (pre-existing creator-actions.ts errors unchanged)
### Tests: 11/11 passing

## Self-Check: PASSED
