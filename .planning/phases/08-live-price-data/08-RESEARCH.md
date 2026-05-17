# Phase 8: Live Price Data — Research

**Researched:** 2026-05-17
**Domain:** Yahoo Finance price fetching, TradingView widget embedding, Supabase schema migration
**Confidence:** HIGH (core stack verified via npm registry + official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `current_price NUMERIC` and `price_fetched_at TIMESTAMPTZ` columns added to `holdings` table via SQL migration snippet (user runs in Supabase SQL Editor).
- **D-02:** Buy List prices are React component state only — no DB persistence.
- **D-03:** TradingView widget placement: click-to-expand inline per holding row (not modal).
- **D-04:** TradingView symbol prefix hardcoded `LSE:` (e.g. `LSE:VWRL`); tickers remain bare in DB.
- **D-05:** Portfolio tab Refresh Prices → fetches all holdings prices → updates `current_price` + `price_fetched_at` in DB.
- **D-06:** Buy List tab separate Refresh Prices → fetches buy list ticker prices → React state only, no DB writes.
- **D-07:** Staleness: `price_fetched_at` older than 24h → amber color on timestamp; no blocking UI.
- **D-08:** Null `current_price` → shows `—` dash; price column always visible (no layout shift).

### Claude's Discretion

None specified — all key decisions are locked.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRICE-01 | Portfolio page displays current price and total value per holding (server-side via yahoo-finance2, LSE .L suffix) | D-01 migration + `refreshHoldingPrices` server action + page.tsx SELECT extension |
| PRICE-02 | Buy List displays current price per ticker alongside £ target amount | D-02 React state + `fetchBuyListPrices` server action + BuyListTable extension |
| PRICE-03 | User can manually trigger a price refresh via a Refresh button | `useTransition` + server action pattern already established in PortfolioTab |
| PRICE-04 | TradingView chart widgets are embedded on portfolio holdings (display-only) | Inline expand panel per row; `<iframe>` embed; `LSE:{TICKER}` symbol format |
</phase_requirements>

---

## Summary

Phase 8 adds live price data to two surfaces — Portfolio tab (persisted to DB) and Buy List tab (ephemeral React state) — plus decorative TradingView chart widgets per holding. The core dependency is `yahoo-finance2` v3.14.1 (npm latest confirmed), a well-maintained unofficial Yahoo Finance JS client that runs server-side only. LSE-listed stocks use the `.L` suffix at the call boundary (e.g. `VWRL.L`) while tickers remain bare in the DB. All price arithmetic must go through `decimal.js` per CLAUDE.md mandate.

The integration touch-points are narrow and well-scoped: (1) a new SQL migration adding two columns, (2) two new server actions in `actions.ts`, (3) extensions to `ClientHolding` interface and `PortfolioTab.tsx`, (4) a new `TradingViewChart` component, and (5) price column threading into `BuyListTable` via `ContributionCalculator` → `BuyListTable` prop chain. No changes to `generatePlan`, the blender, or any strategy logic.

TradingView widgets embed via a standard `<script>` tag that injects an `<iframe>`. For Next.js 15 with no current CSP configured in `next.config.ts`, the only requirement is adding `frame-src https://s3.tradingview.com https://www.tradingview.com` to the security headers. The widget is display-only and does not interact with plan logic.

**Primary recommendation:** Install `yahoo-finance2`, add migration, add `refreshHoldingPrices` + `fetchTickerPrices` server actions, extend `PortfolioTab` with price columns and inline chart panel, extend `BuyListTable` with price column via new prop.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetch live prices for holdings | API / Backend (server action) | — | CORS blocks yahoo-finance2 in browser; must be server-side |
| Persist prices to DB | API / Backend (server action) | Database / Supabase | `current_price` + `price_fetched_at` written in `refreshHoldingPrices` |
| Fetch prices for Buy List | API / Backend (server action) | — | Same as above; no DB write |
| Display price + total value per holding row | Frontend (PortfolioTab client) | — | Extends existing ClientHolding row render |
| Staleness amber coloring | Frontend (PortfolioTab client) | — | Pure derived UI from `priceFetchedAt` timestamp |
| TradingView chart widget | Browser / Client | CDN (TradingView CDN) | Decorative iframe; no server involvement |
| Buy List price column | Frontend (BuyListTable client) | — | Threaded via props from ContributionCalculator |
| DB schema migration | Database / Supabase | — | SQL migration snippet; user-run in SQL Editor |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| yahoo-finance2 | 3.14.1 | Server-side LSE price fetch | Only maintained JS Yahoo Finance client; supports `.L` suffix; TypeScript types included [VERIFIED: npm registry] |
| decimal.js | 10.6.0 (already installed) | All £ arithmetic | CLAUDE.md mandate; already project standard |
| TradingView Widget CDN | — (script tag, no npm) | Decorative price chart per holding | Official TradingView embed; no npm package needed [CITED: tradingview.com/widget-docs] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| framer-motion | 12.38.0 (already installed) | Inline chart panel expand/collapse animation | AnimatePresence already used for ImportCSVModal; same pattern for TradingView panel |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| yahoo-finance2 | Alpha Vantage free tier | AV has stricter rate limits (5 req/min free); yahoo-finance2 is free and has no auth requirement |
| TradingView iframe widget | Lightweight chart library (recharts / chart.js) | Recharts already installed but would require fetching OHLC history data; TradingView is plug-and-play decorative |

**Installation:**
```bash
# Run from pulse/ directory
npm install yahoo-finance2
```

**Version verification:** `npm view yahoo-finance2 version` → `3.14.1` (confirmed 2026-05-17) [VERIFIED: npm registry]

---

## Architecture Patterns

### System Architecture Diagram

```
User clicks "Refresh Prices" (Portfolio tab)
        │
        ▼
PortfolioTab (client) — useTransition
        │  calls server action
        ▼
refreshHoldingPrices() — actions.ts ('use server')
        │  1. supabase.auth.getUser() → verify session
        │  2. SELECT id, ticker FROM holdings WHERE user_id = ?
        │  3. tickers.map(t => t + '.L') → ['VWRL.L', 'SMT.L', ...]
        │
        ├─ Promise.all(tickers.map(t => yahooFinance.quote(t)))
        │          │
        │          ▼
        │   Yahoo Finance API (external, server-to-external)
        │          │  returns QuoteResult | throws
        │          ▼
        │   per-ticker: extract regularMarketPrice
        │   on error: price = null (partial failure allowed)
        │
        │  4. For each ticker: supabase UPDATE holdings SET
        │     current_price = ?, price_fetched_at = now()
        │
        ▼
returns { results: PriceResult[], error?: string }
        │
        ▼
PortfolioTab — revalidatePath('/dashboard') OR optimistic state update
        │
        ▼
Holding row renders: price column + total value + as-of timestamp (amber if >24h)
        │
        ├─ chart icon clicked → AnimatePresence expand
        │                            │
        │                            ▼
        │                  <TradingViewWidget symbol="LSE:VWRL" />
        │                  (renders <script> tag → TradingView injects iframe)
        │
        ▼
[No effect on generatePlan / strategy blender]

─────────────────────────────────────────────────

User clicks "Refresh Prices" (Buy List tab)
        │
        ▼
BuyListTable / ContributionCalculator (client)
        │  calls server action
        ▼
fetchTickerPrices(tickers: string[]) — actions.ts ('use server')
        │  same yahoo-finance2 pattern, no DB write
        │  returns { prices: Record<string, number | null> }
        │
        ▼
React state: setPrices(result.prices)
        │
        ▼
BuyListTable renders: new "Price" column alongside existing "Amount" column
```

### Recommended Project Structure

```
pulse/src/
├── app/dashboard/
│   ├── actions.ts                 # ADD: refreshHoldingPrices, fetchTickerPrices
│   └── components/
│       ├── BuyListTable.tsx       # EXTEND: accept prices prop, render price column
│       └── ContributionCalculator.tsx  # EXTEND: fetch prices, pass to BuyListTable
├── components/
│   ├── PortfolioTab.tsx           # EXTEND: ClientHolding, Refresh button, price columns, chart toggle
│   └── TradingViewWidget.tsx      # NEW: inline chart widget component
└── types/
    └── index.ts                   # EXTEND: Holding interface (currentPrice, priceFetchedAt)
```

### Pattern 1: yahoo-finance2 Server Action — Batch Price Fetch

**What:** Batch-fetch prices for multiple tickers using `Promise.all`, applying `.L` suffix at call boundary only.
**When to use:** `refreshHoldingPrices` (DB write) and `fetchTickerPrices` (state only).

```typescript
// Source: yahoo-finance2 npm docs + JSR @gadicc/yahoo-finance2 [CITED: jsr.io/@gadicc/yahoo-finance2]
import yahooFinance from 'yahoo-finance2'

// Single quote
const result = await yahooFinance.quote('VWRL.L')
const price = result.regularMarketPrice  // number | undefined

// Batch via Promise.all (no native batch endpoint; Promise.all is idiomatic)
const tickers = ['VWRL', 'SMT', 'LLOY']  // bare tickers from DB
const results = await Promise.all(
  tickers.map(async (ticker) => {
    try {
      const q = await yahooFinance.quote(`${ticker}.L`)
      return { ticker, price: q.regularMarketPrice ?? null }
    } catch {
      // Invalid ticker, delisted, or validation error → null price (not a fatal error)
      return { ticker, price: null }
    }
  })
)
// results: [{ ticker: 'VWRL', price: 114.22 }, { ticker: 'SMT', price: null }, ...]
```

**Key field:** `regularMarketPrice: number | undefined` — the current/last trade price [CITED: jsr.io/@gadicc/yahoo-finance2/doc/modules/quote]

**TypeScript import:** `import yahooFinance from 'yahoo-finance2'` (default export) [VERIFIED: npm registry]

### Pattern 2: Supabase Batch UPDATE via Loop

**What:** Update `current_price` and `price_fetched_at` per holding row. Supabase JS v2 has no single-call multi-row conditional update, so iterate.
**When to use:** Inside `refreshHoldingPrices` after price batch resolves.

```typescript
// Source: Supabase JS v2 docs + existing actions.ts pattern [ASSUMED: loop pattern based on importHoldings precedent]
for (const { ticker, price } of results) {
  if (price === null) continue  // skip failed fetches — preserve existing price
  await supabase
    .from('holdings')
    .update({
      current_price: price.toString(),   // store as string per DbNumeric convention
      price_fetched_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('ticker', ticker)
}
```

> Note: Supabase does support `upsert` with `onConflict`, but this table uses UUID PKs. The loop mirrors the `importHoldings` merge pattern already established in `actions.ts`.

### Pattern 3: TradingView Symbol Overview Widget

**What:** Embed TradingView chart as an inline expandable panel per holding row.
**When to use:** `TradingViewWidget.tsx` component, rendered inside `AnimatePresence` panel.

```tsx
// Source: TradingView widget-docs [CITED: tradingview.com/widget-docs/widgets/charts/symbol-overview/]
// IMPORTANT: This uses a <script> tag approach — requires 'use client' and useEffect for Next.js

'use client'
import { useEffect, useRef } from 'react'

interface Props {
  symbol: string  // e.g. "LSE:VWRL"
  height?: number
}

export function TradingViewWidget({ symbol, height = 220 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    // Clear prior render (re-renders with new symbol)
    containerRef.current.innerHTML = ''
    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      symbols: [[symbol, `${symbol}|1D`]],
      chartOnly: false,
      width: '100%',
      height,
      locale: 'en',
      colorTheme: 'dark',
      autosize: false,
      showVolume: false,
      showMA: false,
      hideDateRanges: false,
      hideMarketStatus: false,
      hideSymbolLogo: false,
      scalePosition: 'right',
      scaleMode: 'Normal',
      fontFamily: '-apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu',
      fontSize: '10',
      noTimeScale: false,
      valuesTracking: '1',
      changeMode: 'price-and-percent',
      chartType: 'area',
      lineWidth: 2,
      lineType: 0,
    })
    containerRef.current.appendChild(script)
  }, [symbol, height])

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ height }}
    />
  )
}
```

**Critical:** The `symbols` parameter takes `[[displayName, "EXCHANGE:TICKER|interval"]]`. For LSE: `[['VWRL', 'LSE:VWRL|1D']]`. [CITED: tradingview.com/widget-docs]

### Pattern 4: Inline Chart Expand/Collapse (AnimatePresence)

**What:** Per-row toggle using the same `AnimatePresence` pattern as rationale accordion in `BuyListTable.tsx`.
**When to use:** Chart icon button in holding row toggles `expandedChartId` state.

```tsx
// Source: BuyListTable.tsx existing pattern — same AnimatePresence structure [VERIFIED: codebase]
const [expandedChartId, setExpandedChartId] = useState<string | null>(null)

// Inside holding row:
<AnimatePresence>
  {expandedChartId === holding.id && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{ overflow: 'hidden' }}
    >
      <TradingViewWidget symbol={`LSE:${holding.ticker}`} />
    </motion.div>
  )}
</AnimatePresence>
```

### Pattern 5: Buy List Price Threading

**What:** `ContributionCalculator` owns the Refresh Prices button for the Buy List tab. Prices are fetched into local state and passed down to `BuyListTable` as an optional prop.
**When to use:** Plan tab, after the existing `useMemo(generatePlan)` call.

```typescript
// In ContributionCalculator.tsx — extend props
interface Props {
  // ... existing props
  // NEW: no additional props needed — ContributionCalculator owns price state
}

// Inside component:
const [buyListPrices, setBuyListPrices] = useState<Record<string, number | null>>({})
const [pricesPending, startPricesTransition] = useTransition()

function handleRefreshBuyListPrices() {
  if (plan.type !== 'buy-list') return
  const tickers = plan.items.map(i => i.ticker)
  startPricesTransition(async () => {
    const result = await fetchTickerPrices(tickers)
    if (!result.error) setBuyListPrices(result.prices)
  })
}

// Pass prices to BuyListTable:
<BuyListTable result={plan} prices={buyListPrices} />
```

### Pattern 6: Staleness Color Logic

**What:** Amber color when `priceFetchedAt` is > 24 hours ago; neutral otherwise.
**When to use:** Inline in the timestamp render inside `PortfolioTab`.

```typescript
// Pure derivation — no extra library needed [VERIFIED: codebase pattern, Date arithmetic]
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000  // 24h in ms

function isStale(priceFetchedAt: Date | null): boolean {
  if (!priceFetchedAt) return false  // never fetched → don't show amber
  return Date.now() - priceFetchedAt.getTime() > STALE_THRESHOLD_MS
}

// In JSX:
<span className={isStale(holding.priceFetchedAt) ? 'text-amber-400' : 'text-zinc-400'}>
  {holding.priceFetchedAt
    ? holding.priceFetchedAt.toLocaleString('en-GB')
    : '—'}
</span>
```

### Anti-Patterns to Avoid

- **Storing `.L` suffix in DB:** `VWRL.L` stored as ticker breaks all existing code that reads ticker bare. Apply `.L` only inside server action at call boundary. [VERIFIED: STATE.md critical pitfalls]
- **`new Decimal(undefined)`:** `regularMarketPrice` can be `undefined` if Yahoo returns no price. Always null-check before wrapping in Decimal.
- **`document.createElement` in SSR:** `TradingViewWidget` must be `'use client'` with `useEffect` — the script injection is browser-only.
- **Re-mounting TradingView script on every render:** Without clearing `containerRef.current.innerHTML` first, multiple charts stack in the DOM.
- **Calling `yahooFinance.quote` in a browser context:** This will fail due to CORS. Always call from `'use server'` actions only.
- **Blocking the UI on failed price fetch:** Per D-08, null prices show `—`. Never throw from the action on partial failure — catch per-ticker and continue.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LSE price fetching | Custom fetch to Yahoo Finance API | `yahoo-finance2` | Yahoo Finance has no official API; unofficial endpoints require specific header/cookie handling that yahoo-finance2 manages internally |
| OHLC chart | Custom recharts historical data fetcher | TradingView widget | Would require fetching full OHLC history (another API call); TradingView widget is self-contained and free |
| Price validation / schema | Custom Zod shape | yahoo-finance2 built-in validation | Library validates against Yahoo's schema; `validateResult: false` option available if validation causes false negatives |

**Key insight:** Yahoo Finance's price endpoints are reverse-engineered; the library abstracts cookie/crumb management that would be brittle to maintain.

---

## Common Pitfalls

### Pitfall 1: yahoo-finance2 FailedYahooValidationError on valid-but-unusual tickers
**What goes wrong:** Some tickers (especially ETFs or investment trusts) occasionally return fields that fail schema validation, throwing `FailedYahooValidationError` even though `regularMarketPrice` is present in the error payload.
**Why it happens:** Library validates all Yahoo responses against an internal Zod schema; any unexpected extra or missing field triggers validation failure.
**How to avoid:** Wrap each per-ticker call in `try/catch`. Optionally use `{ validateResult: false }` module option: `yahooFinance.quote(ticker, {}, { validateResult: false })`. Never let a single ticker failure abort the entire batch.
**Warning signs:** First price refresh works but specific tickers always fail silently.

### Pitfall 2: TradingView widget double-mount in React StrictMode
**What goes wrong:** React StrictMode mounts components twice in development. `useEffect` fires twice, injecting two `<script>` tags → two stacked charts.
**Why it happens:** StrictMode intentionally double-invokes effects to surface side effects.
**How to avoid:** Clear `containerRef.current.innerHTML = ''` at the start of the effect (already shown in Pattern 3 above). The cleanup ensures idempotency.
**Warning signs:** Chart appears doubled or two iframes visible in dev tools.

### Pitfall 3: `current_price` column missing (schema not migrated yet)
**What goes wrong:** `refreshHoldingPrices` action writes `current_price` → Supabase returns `42703` column-not-found error.
**Why it happens:** User hasn't run the SQL migration snippet yet.
**How to avoid:** Mirror the `importHoldings` error pattern — catch `err.code === '42703'` and return a human-readable message directing user to run the migration. [VERIFIED: codebase — `importHoldings` already handles this pattern]
**Warning signs:** `42703: column "current_price" of relation "holdings" does not exist`

### Pitfall 4: RSC→client boundary — `Date` objects can cross but `Decimal` cannot
**What goes wrong:** `priceFetchedAt` is a `Date` object. Next.js 15 can serialize `Date` across RSC→client boundary (as ISO string, reconstructed in client) but `Decimal` instances cannot cross.
**Why it happens:** Next.js serializes props as JSON at the boundary; `Decimal` is a class instance.
**How to avoid:** In `page.tsx`, serialize the extended holdings as: `currentPrice: row.current_price ? new Decimal(row.current_price).toNumber() : null` and `priceFetchedAt: row.price_fetched_at ? new Date(row.price_fetched_at) : null`. Match the existing `holdingsPlain` serialization pattern.
**Warning signs:** "Only plain objects can be passed to Client Components" error in console.

### Pitfall 5: LSE market hours — stale intraday data
**What goes wrong:** LSE closes ~4:35pm UK time (16:35 Europe/London). After close, Yahoo Finance still returns the last traded price but the data is effectively end-of-day.
**Why it happens:** This is expected Yahoo Finance behavior — `regularMarketPrice` is the last trade price, not a live feed.
**How to avoid:** The 24-hour staleness indicator (D-07) already communicates this. No fix needed — the UX design accounts for it. Document for users that prices reflect last traded price.
**Warning signs:** None — this is by design.

### Pitfall 6: TradingView CSP — `frame-src` needed
**What goes wrong:** TradingView widget script injects an `<iframe>` sourced from `tradingview.com`. If a CSP header is added later, the iframe will be blocked without `frame-src https://www.tradingview.com`.
**Why it happens:** `next.config.ts` currently has no CSP headers. If they're added, TradingView must be allowed.
**How to avoid:** When adding CSP headers to `next.config.ts` (not in this phase scope), include `frame-src 'self' https://s3.tradingview.com https://www.tradingview.com`. For this phase, no action needed (no CSP currently configured).
**Warning signs:** iframe blocked in browser console: `Refused to frame 'https://www.tradingview.com'`.

---

## Code Examples

### SQL Migration (D-01)

```sql
-- Source: Phase 7 name column migration pattern [VERIFIED: .planning/phases/07-csv-portfolio-import context]
-- Run in Supabase SQL Editor
ALTER TABLE public.holdings
  ADD COLUMN IF NOT EXISTS current_price NUMERIC,
  ADD COLUMN IF NOT EXISTS price_fetched_at TIMESTAMPTZ;
```

One statement, two columns. `IF NOT EXISTS` makes it idempotent (safe to re-run).

### page.tsx Holdings SELECT Extension

```typescript
// Extend existing SELECT in page.tsx — add two new columns [VERIFIED: codebase]
const { data: rows } = await supabase
  .from('holdings')
  .select('id, user_id, ticker, name, category, quantity, current_value, is_fill_ticker, current_price, price_fetched_at, created_at, updated_at')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })

// Extend holdingsPlain serialization:
const holdingsPlain = holdings.map(h => ({
  ...h,
  currentValue: h.currentValue.toNumber(),
  quantity: h.quantity.toNumber(),
  currentPrice: h.currentPrice ? h.currentPrice.toNumber() : null,
  priceFetchedAt: h.priceFetchedAt ?? null,  // Date | null — crosses RSC boundary fine
}))
```

### refreshHoldingPrices Server Action Skeleton

```typescript
// Source: yahoo-finance2 API + actions.ts established patterns [VERIFIED: codebase]
'use server'
import yahooFinance from 'yahoo-finance2'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type PriceResult = { ticker: string; price: number | null; error?: string }
export type RefreshPricesResult = { results?: PriceResult[]; error?: string }

export async function refreshHoldingPrices(): Promise<RefreshPricesResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Something went wrong. Please try again.' }

  const { data: holdingRows, error: fetchErr } = await supabase
    .from('holdings')
    .select('id, ticker')
    .eq('user_id', user.id)

  if (fetchErr) return { error: 'Could not load holdings.' }
  if (!holdingRows || holdingRows.length === 0) return { results: [] }

  // Batch fetch with per-ticker error isolation
  const results: PriceResult[] = await Promise.all(
    holdingRows.map(async ({ ticker }) => {
      try {
        const q = await yahooFinance.quote(`${ticker}.L`)
        const price = q.regularMarketPrice ?? null
        return { ticker, price }
      } catch {
        return { ticker, price: null, error: 'fetch failed' }
      }
    })
  )

  // Write successful results to DB
  const now = new Date().toISOString()
  for (const { ticker, price } of results) {
    if (price === null) continue
    const { error: updateErr } = await supabase
      .from('holdings')
      .update({ current_price: price.toString(), price_fetched_at: now })
      .eq('user_id', user.id)
      .eq('ticker', ticker)
    if (updateErr?.code === '42703') {
      return { error: 'Database schema is out of date. Run the Phase 8 migration in Supabase SQL Editor.' }
    }
  }

  revalidatePath('/dashboard')
  return { results }
}
```

### fetchTickerPrices Server Action (Buy List)

```typescript
// Source: same yahoo-finance2 pattern, no DB write [VERIFIED: codebase architecture]
export type FetchPricesResult = { prices?: Record<string, number | null>; error?: string }

export async function fetchTickerPrices(tickers: string[]): Promise<FetchPricesResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Something went wrong. Please try again.' }

  const prices: Record<string, number | null> = {}
  await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const q = await yahooFinance.quote(`${ticker}.L`)
        prices[ticker] = q.regularMarketPrice ?? null
      } catch {
        prices[ticker] = null
      }
    })
  )

  return { prices }
}
```

### ClientHolding Extension

```typescript
// In PortfolioTab.tsx — extend existing interface [VERIFIED: codebase]
interface ClientHolding {
  id: string
  userId: string
  ticker: string
  name?: string
  category: AssetCategory
  quantity: number
  currentValue: number
  isFillTicker: boolean
  // NEW Phase 8:
  currentPrice: number | null      // null = never fetched or fetch failed
  priceFetchedAt: Date | null      // null = never fetched
  createdAt: Date
  updatedAt: Date
}
```

### Holding Type Extension (types/index.ts)

```typescript
// Source: types/index.ts existing pattern [VERIFIED: codebase]
export interface Holding {
  // ... existing fields ...
  currentPrice?: Decimal | null    // PRICE-01: null until first refresh
  priceFetchedAt?: Date | null     // PRICE-01: null until first refresh
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| yahoo-finance v1.x (unmaintained) | yahoo-finance2 v3.x | 2021 | New package name; default export; TypeScript types built-in |
| TradingView script-tag widgets | TradingView iframe widgets (same origin) | 2023 | Both formats still supported; script tag approach is the standard for site-embedded widgets |
| yahoo-finance2 custom validators required | Validation suppressible via `validateResult: false` | v2+ | Avoids FailedYahooValidationError on schema drift |

**Note on yahoo-finance2 v2 vs v3:** v3 (current latest) is the maintained branch. v2.x still receives patch releases (`release-2.x: 2.14.2`) but v3 is recommended. [VERIFIED: npm registry dist-tags]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Loop-per-row UPDATE is the correct bulk-update pattern (no `upsert` alternative for this case) | Pattern 2, Code Examples | Negligible — loop with individual updates is safe; a bulk upsert by ticker+user_id composite would also work but requires schema change |
| A2 | Yahoo Finance returns prices in GBp (pence) for some LSE tickers (e.g. LLOY) rather than GBP | Pitfall 5 / Edge Cases | MEDIUM: If prices display as 100× too high, caller needs to check `currency` field and divide by 100 for GBp tickers |
| A3 | `regularMarketPrice` is the correct field for "current price" (not `ask` or `bid`) | Pattern 1 | LOW: regularMarketPrice is last traded price — suitable for portfolio display |
| A4 | TradingView `symbol-overview` script src URL is stable: `https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js` | Pattern 3 | LOW: TradingView has used this CDN URL consistently; their widget docs confirm it |

---

## Open Questions

1. **GBp vs GBP on LSE tickers**
   - What we know: Yahoo Finance returns `currency: "GBp"` for some LSE stocks (pence-denominated tickers like LLOY.L, TSCO.L) and `currency: "GBP"` for others (e.g. VWRL.L which trades in £). [ASSUMED: from training knowledge of Yahoo Finance behavior]
   - What's unclear: Which tickers in the user's portfolio are GBp vs GBP.
   - Recommendation: In `refreshHoldingPrices`, check `q.currency` alongside `q.regularMarketPrice`. If `currency === 'GBp'`, divide price by 100 via `new Decimal(price).div(100)`. This should be a defined task in the plan.

2. **revalidatePath vs optimistic update after price refresh**
   - What we know: Current server action pattern uses `revalidatePath('/dashboard')` which triggers a full server-side re-render and navigation update.
   - What's unclear: Whether the UX should show spinner → page reload (current pattern) or optimistic update (more responsive but more complex).
   - Recommendation: Use `revalidatePath('/dashboard')` for Portfolio tab (consistent with existing pattern, simpler). For Buy List tab, prices stay in React state (D-02) so no revalidate needed — just `setPrices(result.prices)`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| yahoo-finance2 | PRICE-01, PRICE-02, PRICE-03 | Not installed | 3.14.1 (npm latest) | None — must install |
| Node.js (server actions) | yahoo-finance2 | ✓ | Via Next.js runtime | — |
| Supabase (existing) | D-01 migration, D-05 DB writes | ✓ | @supabase/supabase-js ^2.105.3 | — |
| TradingView CDN | PRICE-04 | ✓ (CDN, no install) | — (script tag) | — |
| framer-motion | D-03 inline expand | ✓ | ^12.38.0 (installed) | — |

**Missing dependencies with no fallback:**
- `yahoo-finance2` — must `npm install yahoo-finance2` from `pulse/` before any price action can work.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 + jsdom |
| Config file | `pulse/vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` (from `pulse/`) |
| Full suite command | `npx vitest run` (from `pulse/`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRICE-01 | Portfolio displays price + total value per holding | unit | `npx vitest run src/__tests__/PortfolioTab.test.tsx` | ❌ Wave 0 |
| PRICE-02 | Buy List displays price column alongside £ amount | unit | `npx vitest run src/__tests__/BuyListTable.test.tsx` | ✅ (extend existing) |
| PRICE-03 | refreshHoldingPrices action: batch fetch, partial failure isolation | unit | `npx vitest run src/app/dashboard/__tests__/price-actions.test.ts` | ❌ Wave 0 |
| PRICE-04 | TradingViewWidget renders script tag with correct symbol | unit | `npx vitest run src/__tests__/TradingViewWidget.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose` (full suite, ~5s)
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `pulse/src/__tests__/PortfolioTab.test.tsx` — covers PRICE-01 (price column display, staleness color, `—` for null)
- [ ] `pulse/src/app/dashboard/__tests__/price-actions.test.ts` — covers PRICE-03 (mock yahooFinance, partial failure, 42703 error)
- [ ] `pulse/src/__tests__/TradingViewWidget.test.tsx` — covers PRICE-04 (script tag injection, correct symbol format)
- [ ] `BuyListTable.test.tsx` requires extension — add price column assertions

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `supabase.auth.getUser()` in every server action (already established pattern) |
| V3 Session Management | no | Handled by Supabase auth layer |
| V4 Access Control | yes | `.eq('user_id', user.id)` on all holdings queries (RLS + app-level defence-in-depth) |
| V5 Input Validation | yes | `tickers: string[]` parameter in `fetchTickerPrices` — validate length and content before passing to yahoo-finance2 |
| V6 Cryptography | no | No new crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Ticker injection: malicious ticker string passed to yahoo-finance2 | Tampering | yahoo-finance2 encodes ticker in URL parameter; validate `ticker` matches `/^[A-Z0-9.]{1,20}$/` server-side before fetch |
| SSRF via crafted ticker | Tampering | yahoo-finance2 only connects to Yahoo Finance endpoints — no user-controlled URLs |
| Holdings data leakage | Information Disclosure | `.eq('user_id', user.id)` on all SELECT and UPDATE; Supabase RLS also enforces |
| Malicious `tickers` array in `fetchTickerPrices` | Tampering | Validate array length (cap at 50) and each ticker format before batch fetch |

---

## Sources

### Primary (HIGH confidence)
- `npm view yahoo-finance2 version` → 3.14.1 (2026-05-17) [VERIFIED: npm registry]
- [jsr.io/@gadicc/yahoo-finance2](https://jsr.io/@gadicc/yahoo-finance2/doc) — quote module, regularMarketPrice field [CITED]
- [tradingview.com/widget-docs](https://www.tradingview.com/widget-docs/) — widget formats, symbol-overview embed [CITED]
- Existing codebase: `actions.ts`, `PortfolioTab.tsx`, `BuyListTable.tsx`, `generator.ts`, `types/index.ts` [VERIFIED: direct read]

### Secondary (MEDIUM confidence)
- [npmjs.com/package/yahoo-finance2](https://www.npmjs.com/package/yahoo-finance2) — batch quote via `Promise.all`, error handling options [CITED]
- [tradingview.com/widget-docs/widget-formats/](https://www.tradingview.com/widget-docs/widget-formats/) — iframe vs script format [CITED]

### Tertiary (LOW confidence)
- GBp vs GBP currency behavior for LSE tickers — training knowledge; needs runtime verification [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- yahoo-finance2 API: HIGH — version confirmed, quote method and regularMarketPrice documented on JSR
- Architecture: HIGH — directly derived from existing codebase patterns
- TradingView embed: MEDIUM-HIGH — embed URL and JSON params documented; exact LSE behavior assumed similar to other exchanges
- Pitfalls: HIGH for known ones; MEDIUM for GBp/GBP currency handling

**Research date:** 2026-05-17
**Valid until:** 2026-06-17 (yahoo-finance2 is unofficial; Yahoo could change endpoints; verify if > 30 days)
