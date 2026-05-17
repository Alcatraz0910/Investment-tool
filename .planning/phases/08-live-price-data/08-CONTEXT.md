# Phase 8: Live Price Data — Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Fetch current market prices for portfolio holdings (via yahoo-finance2, server-side) and surface them in:
1. The Portfolio tab — price, derived total value, and an as-of timestamp per holding row; a Refresh Prices button triggers the batch fetch
2. The Buy List tab — current price per ticker alongside the £ target amount; separate Refresh button on that tab

TradingView chart widgets are embedded per holding as a decorative overlay (display-only; no impact on plan logic).

</domain>

<decisions>
## Implementation Decisions

### Price Storage
- **D-01:** Prices are persisted to the `holdings` table via two new columns: `current_price NUMERIC` and `price_fetched_at TIMESTAMPTZ`. Migration delivered as a SQL snippet (same pattern as Phase 7 name column migration) — user runs it in Supabase SQL Editor.
- **D-02:** Buy List prices are held in React component state only — no DB persistence. The buy list itself is the durable artifact; fetched prices for its tickers are ephemeral during the session.

### TradingView Placement
- **D-03:** Click-to-expand inline. Each holding row has a chart icon; clicking it expands a panel below the row containing the TradingView widget. Clicking again collapses it. No modal.
- **D-04:** TradingView symbol prefix: hardcode `LSE:` for all tickers (e.g. `LSE:VWRL`). All holdings in this UK ISA tool are assumed to be LSE-listed. Applied only at widget render time — tickers remain bare in the DB.

### Refresh Scope
- **D-05:** Portfolio tab has its own Refresh Prices button — fetches prices for all holdings in the DB and updates `current_price` + `price_fetched_at` on each row.
- **D-06:** Buy List tab has its own separate Refresh Prices button — fetches prices for all tickers in the current buy list and stores them in React state. No DB writes.

### Staleness UX
- **D-07:** The as-of timestamp turns amber when prices are older than 24 hours. No banner, no blocking UI — subtle visual cue only. 24-hour threshold avoids false alarms during market closures and weekends.
- **D-08:** Holdings with no `current_price` yet (null) show a `—` dash in the price column. The price column is always visible; layout does not shift on first refresh.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Domain Constraints
- `CLAUDE.md` — decimal.js mandate (all £ arithmetic via `new Decimal()`), no financial advice language, ISA tax year rules
- `.planning/PROJECT.md` — requirements list (PRICE-01 through PRICE-04), constraints section

### Existing Code
- `pulse/src/types/index.ts` — `Holding` interface (needs `currentPrice` and `priceFetchedAt` fields added); `BuyListItem` interface
- `pulse/src/app/dashboard/actions.ts` — server action patterns (Supabase auth, RLS, error handling); `importHoldings` as the bulk-update pattern to follow
- `pulse/src/components/PortfolioTab.tsx` — `ClientHolding` interface (must be extended); existing holdings row render pattern; `deleteHolding`, `setFillTicker` action call patterns
- `pulse/src/app/dashboard/page.tsx` — data-fetch entry point; how holdings are loaded and passed to `PortfolioTab`

### Phase 7 Decisions (carry-forward)
- `.planning/phases/07-csv-portfolio-import/07-CONTEXT.md` — CSV import decisions; `importHoldings` action pattern that Phase 8 batch-fetch should mirror structurally

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `HoldingModal.tsx` — existing modal pattern; NOT reused for TradingView (inline expand chosen), but its open/close state management pattern is a reference
- `ImportCSVModal.tsx` — `useTransition` + server action pattern for async mutations with pending UI
- `refresh-button.tsx` (creator refresh) — existing "trigger server action → show spinner → update UI" pattern; adapt for price fetch
- Framer Motion `AnimatePresence` — already used in `ImportCSVModal` for panel expand/collapse; use same pattern for TradingView inline expand

### Established Patterns
- Server actions in `pulse/src/app/dashboard/actions.ts` — async, return `{ error?: string }`, use Supabase with user auth check
- `useTransition` for non-blocking server action calls in client components
- `ClientHolding` pattern in `PortfolioTab.tsx` — DB row shape mapped to a client-friendly interface before passing to the component
- All `NUMERIC` DB values read via `new Decimal()` — `current_price` must follow this

### Integration Points
- `holdings` table — two new columns (`current_price`, `price_fetched_at`) added via SQL migration; `page.tsx` must SELECT them and pass through
- `yahoo-finance2` — not yet installed; server-side only; `.L` suffix applied at call boundary (e.g. `VWRL` → `VWRL.L`) — never stored in DB
- Buy List tab (`ActionPlanTab` or equivalent) — needs a `refreshPrices` server action callable from a button; prices stored in React state alongside existing buy list items
- TradingView widget — embedded as an `<iframe>` or `<script>` tag using the Mini Symbol Overview widget; symbol format `LSE:{TICKER}`

</code_context>

<specifics>
## Specific Ideas

- TradingView widget: use the TradingView Mini Symbol Overview widget (lightweight, self-contained iframe). Symbol: `LSE:VWRL` format.
- yahoo-finance2 call pattern: `yahooFinance.quote('VWRL.L')` → extract `regularMarketPrice`. Batch all holdings in a single server action call (Promise.all or sequential with rate consideration).
- The `price_fetched_at` timestamp drives the staleness colour: if `Date.now() - priceFetchedAt > 24 * 60 * 60 * 1000` → amber class, otherwise zinc/white.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 8-Live Price Data*
*Context gathered: 2026-05-17*
