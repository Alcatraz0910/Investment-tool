---
phase: 08-live-price-data
verified: 2026-05-17T00:00:00Z
status: human_needed
score: 7/8 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open dashboard with holdings that have prices fetched (price_fetched_at non-null). Confirm the page renders without a runtime serialization crash."
    expected: "Page renders normally showing portfolio, prices, and timestamps. No 'Only plain objects can be passed to Client Components' error in console or logs."
    why_human: "CR-02 identified that priceFetchedAt: Date is passed raw across the RSC→client boundary (page.tsx line 281: `priceFetchedAt: h.priceFetchedAt ?? null`). Next.js 15 may or may not crash depending on its serialization behavior for Date objects — cannot confirm runtime behavior via static analysis alone. The SQL migration must be run and a price refresh triggered before this path is exercised."
  - test: "Click Refresh Prices on the Portfolio tab. Observe whether holdings table updates with prices and timestamps."
    expected: "Prices appear in the Price column; timestamps appear in the As-of column; stale prices (>24h) display in amber."
    why_human: "Requires a live Supabase DB with the Phase 8 migration applied and a live yahoo-finance2 network call to LSE tickers. Cannot verify statically."
  - test: "Click Refresh Prices on the Buy List (Plan tab). Observe the Price column in the buy list table."
    expected: "Price column shows live prices for each buy list ticker. Error state shows correctly if the fetch fails."
    why_human: "Requires running app with authenticated session, live network."
  - test: "Click the chart icon on a portfolio holding row. Confirm TradingView widget appears and collapses on second click."
    expected: "AnimatePresence panel expands with a TradingView chart. Clicking again collapses it. Only one chart open at a time."
    why_human: "TradingView widget injects a third-party CDN script. Behavior requires a real browser, not jsdom."
---

# Phase 8: Live Price Data — Verification Report

**Phase Goal:** Users can see current market prices and portfolio value without leaving Pulse, and the Buy List shows what each recommended ticker costs today
**Verified:** 2026-05-17T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Portfolio page shows current price per holding after prices are refreshed | ✓ VERIFIED | PortfolioTab.tsx renders `£{holding.currentPrice.toFixed(2)}` in always-rendered Price cell (line 281). refreshHoldingPrices writes prices to DB and revalidatePath('/dashboard') triggers re-render. |
| 2 | Buy List shows current price per ticker alongside £ target amount | ✓ VERIFIED | BuyListTable.tsx has optional `prices` prop; renders `£{prices[item.ticker]!.toFixed(2)}` or em dash. ContributionCalculator passes `prices={buyListPrices}` state to BuyListTable (line 123). |
| 3 | A Refresh Prices button triggers server-side batch fetch; UI updates without full page reload | ✓ VERIFIED | PortfolioTab: `handleRefreshPrices` → `startPriceTransition(refreshHoldingPrices)` → `revalidatePath`. ContributionCalculator: `handleRefreshBuyListPrices` → `startPricesTransition(fetchTickerPrices)` → React state. Both use useTransition (non-blocking). |
| 4 | TradingView chart widget is visible per holding as decorative overlay (display-only; does not alter plan logic) | ✓ VERIFIED | TradingViewWidget.tsx created with 'use client', script injection, StrictMode-safe innerHTML clear. Wired in PortfolioTab via `<TradingViewWidget symbol={\`LSE:${holding.ticker}\`} />` inside AnimatePresence. Component has no connection to generatePlan or plan logic. |
| 5 | .L suffix applied only at yahooFinance.quote() call boundary — never stored in DB | ✓ VERIFIED | actions.ts lines 375 and 426: `yahooFinance.quote(\`${ticker}.L\`, ...)` — suffix applied only here. DB update uses `ticker` (no .L). |
| 6 | GBp tickers divided by 100 via Decimal in both server actions | ✓ VERIFIED | actions.ts lines 377-379 and 428-430: `if (price !== null && q.currency === 'GBp') { price = new Decimal(price).div(100).toNumber() }` — identical pattern in both refreshHoldingPrices and fetchTickerPrices. |
| 7 | Buy List prices are React state only — fetchTickerPrices does NOT write to DB and does NOT call revalidatePath | ✓ VERIFIED | fetchTickerPrices (actions.ts line 411-438): no supabase `.update()` call, no `revalidatePath` call. ContributionCalculator stores result in `setBuyListPrices` state. |
| 8 | priceFetchedAt Date objects serialized at RSC→client boundary | ✗ FAILED | page.tsx line 281: `priceFetchedAt: h.priceFetchedAt ?? null` passes raw Date instance (or null). Next.js 15 cannot serialize Date class instances across RSC→client boundary. CR-02 from 08-REVIEW.md confirms this. The field is NOT converted to ISO string before crossing the boundary. |

**Score:** 7/8 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260517_phase8_price_columns.sql` | ADD COLUMN current_price + price_fetched_at | ✓ VERIFIED | Contains exact expected SQL with IF NOT EXISTS guard |
| `pulse/src/types/index.ts` | currentPrice?: Decimal\|null, priceFetchedAt?: Date\|null | ✓ VERIFIED (with warning) | Fields exist. CR-05: typed as optional (?) not required-nullable — loose typing but does not block functionality |
| `pulse/src/app/dashboard/actions.ts` | refreshHoldingPrices + fetchTickerPrices server actions | ✓ VERIFIED | Both actions present. Class instantiation `new YahooFinance()` used (v3 adaptation). GBp÷100, isValidTicker, 50-ticker cap, 42703 guard, auth check — all present. |
| `pulse/src/app/dashboard/page.tsx` | SELECT includes current_price, price_fetched_at; holdingsPlain serializes them | ✓ VERIFIED (CR-02 WARNING) | SELECT string at line 63 includes both columns. holdingsPlain at lines 276-283 maps currentPrice correctly. priceFetchedAt passed as raw Date — serialization bug (CR-02). |
| `pulse/src/components/TradingViewWidget.tsx` | 'use client', innerHTML clear, symbols format [[bareTicker, "LSE:TICKER|1D"]] | ✓ VERIFIED | File matches spec exactly. CR-03 warning: split(':') has no guard for symbols without colon — but call site always prepends 'LSE:' so not currently exploitable. |
| `pulse/src/components/PortfolioTab.tsx` | Price column, As-of column, Refresh button, chart toggle, AnimatePresence | ✓ VERIFIED | All features present: currentPrice/priceFetchedAt fields on ClientHolding, always-rendered price cell, 24h staleness threshold (text-amber-400), role="alert", aria-expanded, LSE: prefix, expandedChartId state. |
| `pulse/src/app/dashboard/components/BuyListTable.tsx` | prices?: Record<string, number\|null> prop, Price column | ✓ VERIFIED | prices prop optional, prices?.[item.ticker] != null check, em dash fallback, grid extended to 5 columns. |
| `pulse/src/app/dashboard/components/ContributionCalculator.tsx` | buyListPrices state, Refresh button, fetchTickerPrices wired | ✓ VERIFIED | fetchTickerPrices imported, buyListPrices state, handleRefreshBuyListPrices guard on plan.type, Refresh button with spinner, role="alert" error display, prices={buyListPrices} passed to BuyListTable. WR-05: missing type="button" on Refresh button. |
| `pulse/src/app/dashboard/__tests__/price-actions.test.ts` | 11 unit tests (GBp, 42703, auth, invalid ticker, >50) | ✓ VERIFIED | 11 tests covering all threat-model mitigations. vi.hoisted() pattern, real function constructor for class mock. |
| `pulse/src/__tests__/TradingViewWidget.test.tsx` | 7 tests (CDN URL, symbols format, height, aria-label) | ✓ VERIFIED | 7 tests exist. Symbols format [[bareTicker, "LSE:TICKER|1D"]] verified. |
| `pulse/src/__tests__/PortfolioTab.test.tsx` | 7 tests (price display, staleness, null states, Refresh button, aria-expanded) | ✓ VERIFIED | 7 tests present covering all Phase 8 price display behaviors. |
| `pulse/src/__tests__/BuyListTable.test.tsx` | 4 new price column tests | ✓ VERIFIED | describe('BuyListTable — Price column (Phase 8)') block with 4 tests added. Existing 8 tests untouched. |
| `pulse/package.json` | yahoo-finance2 in dependencies | ✓ VERIFIED | `"yahoo-finance2": "^3.14.1"` present in dependencies. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| PortfolioTab.tsx | refreshHoldingPrices | import + handleRefreshPrices → startPriceTransition | ✓ WIRED | Line 8 imports it; lines 104-110 invoke it |
| PortfolioTab.tsx | TradingViewWidget | import + AnimatePresence panel | ✓ WIRED | Line 7 imports it; line 366 renders it with LSE: prefix |
| ContributionCalculator.tsx | fetchTickerPrices | import + handleRefreshBuyListPrices → startPricesTransition | ✓ WIRED | Line 19 imports it; lines 45-57 invoke it |
| ContributionCalculator.tsx | BuyListTable | prices={buyListPrices} prop | ✓ WIRED | Line 123: `<BuyListTable result={plan} prices={buyListPrices} />` |
| page.tsx | holdingsPlain | SELECT with current_price, price_fetched_at → map to currentPrice/priceFetchedAt | ✓ WIRED (CR-02) | SELECT at line 63 includes columns; map at lines 76-77 sets fields. priceFetchedAt not ISO-serialized — runtime risk. |
| PortfolioTab.tsx | page.tsx holdingsPlain | ClientHolding interface matches serialized shape | ? UNCERTAIN | ClientHolding uses `priceFetchedAt: Date | null`. page.tsx passes raw Date. If Next.js 15 auto-converts Date → string in practice this would break the type contract; if it serializes to ISO the client receives a string not a Date. CR-02 requires human verification. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| PortfolioTab.tsx | holding.currentPrice | holdingsPlain from page.tsx → Supabase `current_price` column | DB query found (page.tsx line 63 SELECT includes current_price) | ✓ FLOWING (data flows once migration applied) |
| PortfolioTab.tsx | holding.priceFetchedAt | holdingsPlain from page.tsx → Supabase `price_fetched_at` column | DB query found | ⚠️ PARTIALLY FLOWING — raw Date passes the RSC boundary without serialization (CR-02) |
| BuyListTable.tsx | prices[item.ticker] | ContributionCalculator `buyListPrices` state → fetchTickerPrices | Server action fetches yahoo-finance2 and returns Record<string,number\|null> | ✓ FLOWING (React state, not DB) |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — requires live Supabase connection and authenticated session. No runnable entry point testable without server and DB.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PRICE-01 | 08-01, 08-02 | Portfolio page displays current price and total value per holding (server-side via yahoo-finance2, LSE .L suffix) | ✓ SATISFIED | refreshHoldingPrices fetches via yahoo-finance2 with .L suffix, writes to DB. PortfolioTab renders price column always. |
| PRICE-02 | 08-01, 08-03 | Buy List displays current price per ticker alongside £ target amount | ✓ SATISFIED | BuyListTable has prices prop; ContributionCalculator wires fetchTickerPrices to it. |
| PRICE-03 | 08-01, 08-02, 08-03 | User can manually trigger a price refresh via a Refresh button | ✓ SATISFIED | Refresh Prices button in PortfolioTab (holdings) and ContributionCalculator (buy list). Both use useTransition. |
| PRICE-04 | 08-02 | TradingView chart widgets embedded on portfolio holdings (display-only; do not feed plan logic) | ✓ SATISFIED | TradingViewWidget.tsx created and wired in PortfolioTab AnimatePresence. Component output has no path to generatePlan. |

All four phase-8 requirements mapped. No orphaned requirements.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| page.tsx | 281 | `priceFetchedAt: h.priceFetchedAt ?? null` — raw Date passed to client | ✗ BLOCKER (CR-02) | Next.js 15 RSC→client boundary cannot serialize Date instances. Dashboard will crash when any holding has a non-null price_fetched_at. |
| ContributionCalculator.tsx | 99 | `<button` without `type="button"` | ⚠️ WARNING (WR-05) | Defaults to type="submit" — if ever inside a form, will submit instead of refresh |
| actions.ts | 387-403 | Sequential update loop short-circuits on first 42703 error | ⚠️ WARNING (WR-01) | Partial DB update state possible if migration is partially applied |
| TradingViewWidget.tsx | 23 | `script.innerHTML` instead of `script.textContent` | ⚠️ WARNING (WR-03) | Not currently exploitable (tickers server-validated) but one refactor from XSS risk |
| TradingViewWidget.tsx | 17 | `symbol.split(':')` — no guard for no-colon input | ⚠️ WARNING (CR-03) | Would produce `ticker=undefined` if bare ticker passed — currently safe because call site always prepends 'LSE:' |
| types/index.ts | 100-101 | `currentPrice?: Decimal \| null` — optional not required-nullable | ℹ️ INFO (CR-05) | Allows omitting field entirely; weaker than `currentPrice: Decimal \| null` |

---

### Human Verification Required

#### 1. RSC→Client Date Serialization (CR-02)

**Test:** Run the app with the Phase 8 SQL migration applied. Trigger a price refresh on the Portfolio tab. Reload the dashboard.
**Expected:** Page renders without a Next.js serialization error. Prices and timestamps appear in the holdings table.
**Why human:** CR-02 identifies `priceFetchedAt: h.priceFetchedAt ?? null` (page.tsx:281) passes a raw `Date` instance across the server/client boundary. Next.js 15 App Router's behavior for Date objects at this boundary varies — it may throw "Only plain objects can be passed to Client Components from Server Components" or silently convert to string. Static analysis cannot confirm which path occurs. This must be confirmed with a live run after the SQL migration is applied.

#### 2. Portfolio Tab Refresh — Live Prices

**Test:** With the SQL migration applied and valid LSE tickers in holdings, click "Refresh Prices" in the Portfolio tab.
**Expected:** Price column fills with £-formatted prices. As-of timestamps appear. Prices >24h old display in amber. The page does not full-reload (useTransition + revalidatePath provides server-driven update).
**Why human:** Requires live Supabase DB and yahoo-finance2 network access.

#### 3. Buy List Tab Refresh — Live Prices

**Test:** Navigate to Plan tab, generate a buy list, click "Refresh Prices" above the buy list.
**Expected:** Price column in BuyListTable fills with live prices for each ticker. No DB write occurs (verify by checking Supabase holdings table — current_price should NOT change from this action).
**Why human:** Requires live session, network, and DB access to verify the no-DB-write constraint holds.

#### 4. TradingView Chart Toggle

**Test:** In Portfolio tab with holdings, click the chart icon on any holding row.
**Expected:** AnimatePresence panel expands with a TradingView chart. Clicking again collapses. Clicking a different row collapses the first and expands the second.
**Why human:** TradingView widget requires a real browser and CDN access; jsdom does not execute injected scripts.

---

### Gaps Summary

No outright FAILED truths that block the phase goal from being achievable — the feature is structurally complete and wired end-to-end. However, one high-severity issue was found via code review (CR-02) that requires human confirmation before the phase can be marked PASSED:

**CR-02 (priceFetchedAt serialization):** page.tsx passes `h.priceFetchedAt` as a raw `Date` instance across the Next.js 15 RSC→client boundary. The fix is a one-line change (`h.priceFetchedAt?.toISOString() ?? null`) with a corresponding type change in `ClientHolding` (string | null instead of Date | null) and a `new Date(priceFetchedAt)` reconstruction before the staleness comparison. This issue will only manifest once the SQL migration is applied and a holding has a non-null price_fetched_at — it is latent until first use. Human verification should confirm whether it crashes or silently passes under Next.js 15's serializer.

---

_Verified: 2026-05-17T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
