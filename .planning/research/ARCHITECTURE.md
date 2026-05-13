# Architecture: v1.1 Feature Integration

**Project:** Pulse  
**Milestone:** v1.1 Portfolio Intelligence  
**Researched:** 2026-05-13  
**Codebase baseline:** ~6,900 LOC, Next.js 15 App Router, 83 vitest tests

---

## Existing Architecture Snapshot

```
/dashboard (RSC page.tsx)
  ├── Tab: Portfolio → PortfolioTab (client) → HoldingModal (client)
  ├── Tab: ISA       → ISATab (client)
  └── Tab: Plan      → PlanTab (client) → BuyListTable (client)
                                        → ContributionCalculator (client)

/dashboard/creators (RSC creators/page.tsx)
  └── CreatorsTab (client)
        ├── trackCreator / untrackCreator / addCustomCreator (server actions)
        ├── RefreshButton → POST /api/refresh/[creatorId] (API route)
        ├── StrategyCard, TrustWeightSlider, TranscriptList
        └── BlendSummary

Server actions: /app/dashboard/actions.ts, creator-actions.ts, plan-actions.ts, isa-actions.ts
Pure lib: /lib/plan/generator.ts (zero server imports — can run client-side)
DB client pattern: createClient() (server/RLS), createServiceClient() (service role bypasses RLS)
RSC→client boundary: Decimal fields serialised to number; Maps/class instances stripped before prop pass
```

---

## Feature 1: CSV Portfolio Import

### Integration Decision

**Location:** Modal on `/dashboard` (Portfolio tab), not a new route.

Rationale: Import replaces manual holding entry; it belongs where manual entry already lives — the Portfolio tab. A new route would require a separate auth check, layout duplication, and navigation plumbing. A modal keeps it in-context and shares the existing `PortfolioTab` → `HoldingModal` pattern.

### Data Flow

```
User selects CSV file
  → CSVImportModal (client component — File API, no server involved)
  → Parse in-browser with a pure parser function (no library needed for simple CSV)
  → Column mapping UI (user maps "Ticker", "Value", "Quantity", "Category")
  → Preview table (holdings to be imported)
  → Submit → importHoldings() server action (new, in /app/dashboard/actions.ts)
    → Supabase: upsert holdings on (user_id, ticker) — ON CONFLICT update current_value/quantity
    → revalidatePath('/dashboard')
```

### New vs Modified Components

| Component | Status | Notes |
|-----------|--------|-------|
| `CSVImportModal.tsx` | **NEW** `/src/components/` | Client component. File input + parse + column map + preview + submit. |
| `importHoldings()` | **NEW** action in `actions.ts` | Server action. Accepts array of `{ticker, category, quantity, currentValue}`. Upserts into `holdings`. |
| `PortfolioTab.tsx` | **MODIFIED** | Add "Import CSV" button beside "Add Holding". Opens `CSVImportModal`. |

### Server vs Client Boundary

CSV parsing is entirely client-side (File API, no server round-trip until commit). The server action receives a plain JSON array — no `FormData` multipart upload needed. This avoids Vercel's 4.5 MB body limit for API routes and keeps the server action simple.

### Supabase Schema Change

Add upsert conflict target on `(user_id, ticker)` — either via a unique index or by handling duplicates in the server action logic. Current `holdings` table inserts duplicates freely; v1.1 must decide: upsert (update existing ticker) or insert-always (allow duplicates). Recommendation: upsert on `(user_id, ticker)` so re-importing the same CSV doesn't duplicate rows.

---

## Feature 2: Creator Discovery/Search

### Integration Decision

**Location:** Extend existing `/dashboard/creators` page — new `CreatorSearchBar` component above the current curated list, not a new route.

Rationale: The creators page already has the full data-fetch scaffolding (creators, tracked IDs, user_creator_map). Adding search here avoids duplicating that scaffolding. The existing "Browse Creators" section becomes "Search + Curated" in one place.

### Data Flow

```
User types into CreatorSearchBar (debounced, 300ms)
  → GET /api/creators/search?q=<term> (new API route, not server action)
    → youtube.search.list({ q, type: 'channel', maxResults: 10 })  — uses existing getYouTubeClient()
    → Return: [{ channelId, displayName, channelUrl, thumbnailUrl }]
  → SearchResultList renders results
  → User clicks "Track" on a result
    → addCustomCreator() (EXISTING server action) — reuse unchanged
```

An API route (not server action) is required here because the response is JSON and is called on user input (debounce/fetch from client). Server actions can't be called this way without extra wiring.

### New vs Modified Components

| Component | Status | Notes |
|-----------|--------|-------|
| `CreatorSearchBar.tsx` | **NEW** `/src/app/dashboard/` | Client component. Input + debounce + fetch + result list. |
| `/api/creators/search/route.ts` | **NEW** | GET handler. Calls `youtube.search.list`. Requires auth check (getUser). Returns JSON array. |
| `creators-tab.tsx` (`CreatorsTab`) | **MODIFIED** | Add `<CreatorSearchBar>` above `<h2>Browse Creators</h2>`. No other changes. |
| `addCustomCreator()` | **UNMODIFIED** | Search results pass `channelUrl` + `displayName` — same shape as the custom form. |

### YouTube API Quota

`search.list` costs 100 units per call vs 1 unit for `playlistItems.list`. With 10,000 daily quota units, a user can make ~100 searches per day. Debounce at 300ms + min 3 chars mitigates accidental burn. Flag this in phase plan as a known constraint; do not add server-side caching for v1.1 (personal tool, single user).

### Server vs Client Boundary

Search results never touch Supabase — they come from YouTube directly. Only the "Track" action hits the DB via the existing `addCustomCreator` server action. Keep the API route thin: auth check, call YouTube client, return JSON. No state persisted for search results.

---

## Feature 3: Live Price Data (TradingView)

### Integration Decision

**Price fetch location:** Server action called on-demand, result cached in Supabase `holdings.current_value` column (already exists).

**UI render locations:**
1. Portfolio tab — holdings list, replacing manually-entered `currentValue` with live price × quantity
2. Buy List (Plan tab) — `BuyListTable` rows annotated with current price

TradingView does not provide a public REST API for price data. The standard approach for free/personal use is the `tradingview-data-api` npm package or scraping the TradingView widget endpoint. Neither is officially supported.

**Realistic integration:** Use a free financial data API instead. Options:
- **Yahoo Finance (unofficial):** `yahoo-finance2` npm package — no API key, generous limits for personal use (HIGH confidence this works; MEDIUM confidence on stability).
- **Alpha Vantage free tier:** 25 requests/day free — too limited for portfolio refresh.
- **Twelve Data free tier:** 800 requests/day — sufficient for personal use.

Recommendation: `yahoo-finance2` for v1.1. No API key, no quota concerns for a single user. If TradingView widget embed is explicitly required (for UI reasons), render a `<iframe>` TradingView chart widget per holding — this is display-only, not data extraction.

### Data Flow

```
User clicks "Refresh Prices" (Portfolio tab)
  → refreshHoldingPrices() server action (new, in actions.ts)
    → For each unique ticker in user's holdings:
        → yahoo-finance2.quote(ticker) — gets current price
        → UPDATE holdings SET current_value = price × quantity, updated_at = now()
           WHERE user_id = user.id AND ticker = ticker
    → revalidatePath('/dashboard')
  → PortfolioTab re-renders with updated currentValue from server
```

Prices are stored back to `holdings.current_value` — no new table, no new columns. This preserves the existing data model and means `generatePlan` sees live prices on next page load automatically.

### New vs Modified Components

| Component | Status | Notes |
|-----------|--------|-------|
| `refreshHoldingPrices()` | **NEW** action in `actions.ts` | Server action. Fetches prices for all user tickers. Updates `holdings.current_value`. |
| `PortfolioTab.tsx` | **MODIFIED** | Add "Refresh Prices" button. Show last-updated timestamp per holding (from `holdings.updated_at`, already in type). |
| `BuyListTable.tsx` | **UNMODIFIED** | Receives `currentValue` from parent via existing props — no change needed if prices are stored to DB. |
| `yahoo-finance2` | **NEW dependency** | `npm install yahoo-finance2`. Server-only import (add to server action only). |

### Caching Strategy

No in-memory or Redis cache needed for v1.1 (personal tool). The DB row itself is the cache — `holdings.updated_at` tells the user how stale prices are. Show "Last updated: X mins ago" in the UI from that field.

### Rate Limit

`yahoo-finance2` has no documented rate limit for personal use. For a portfolio of 10–20 tickers, a single "Refresh Prices" call makes 10–20 sequential requests — well within any reasonable threshold.

---

## Feature 4: Mobile-Responsive Layout

### Integration Decision

This is a CSS/layout change across existing components. No new routes, no new server actions, no data flow changes. It is purely a Tailwind responsive-prefix pass across the existing component tree.

### Components Requiring the Most Restructuring

Ranked by effort:

| Component | Problem on Mobile | Fix |
|-----------|------------------|-----|
| `BuyListTable.tsx` | `grid-cols-[1fr_1fr_auto_auto]` — 4 columns collapse illegibly below ~400px | Stack to 2-col grid on `sm:` or use card layout already used (it's a card list — minor tweak) |
| `PortfolioTab.tsx` | Holdings list row: 5 inline spans + 3 buttons — overflows at 375px | Wrap buttons below holding info; reduce span widths |
| `TrustWeightSlider.tsx` | Sliders + labels in row — likely fine but needs testing | Verify; probably `flex-col` at `sm:` |
| `/dashboard/page.tsx` (header) | Flex row with "Creators" button + "Sign out" may wrap awkwardly | `flex-wrap` or smaller button text |
| `HoldingModal.tsx` | `max-w-sm mx-4` — already mobile-friendly | No change needed |
| `GettingStartedGuide.tsx` | Unknown — depends on implementation | Audit during execution |
| `CreatorsTab.tsx` | Creator rows are flex with channel URL truncated — needs `min-w-0` audit | Minor |
| Tab bar (`page.tsx` nav) | `flex px-8 pt-6` — no `overflow-x-auto` for narrow screens | Add `overflow-x-auto` or shrink padding |

### Global Changes

- `px-6` → `px-4 sm:px-6` on all `<main>` wrappers
- `max-w-4xl mx-auto` is already safe — no change
- Min touch targets (44px) already enforced throughout — no regression expected

### No New Infrastructure

No responsive navigation framework needed. The glassmorphism card layout already works well on mobile with minor Tailwind edits. Recharts (used in BlendSummary/RoadmapView) needs `width="100%"` + `ResponsiveContainer` — verify both are already using it.

---

## Suggested Build Order

### Rationale for Ordering

1. **CSV Import first** — eliminates manual entry friction immediately; unblocks realistic portfolio data for testing live prices.
2. **Live Prices second** — depends on populated holdings (from CSV import). New server action + one new dependency. Self-contained.
3. **Creator Search third** — self-contained; doesn't depend on features 1 or 2. Goes here rather than second because it touches a different page (creators) and the API quota risk needs manual testing time.
4. **Mobile Layout last** — purely CSS; touches all components. Doing it last means no responsive work gets thrown away by earlier structural changes (CSV modal, price refresh button). One focused pass at the end.

### Dependency Graph

```
CSV Import (no deps)
  ↓ populates holdings with real data
Live Prices (depends on populated holdings for meaningful testing)
  ↓ independent of creator search
Creator Search (independent — different page)
  ↓ all data/logic complete
Mobile Layout (CSS pass — after all structural additions are frozen)
```

### Phases Recommendation for Roadmapper

| Phase | Feature | Key New Files | Modified Files |
|-------|---------|--------------|----------------|
| 1 | CSV Portfolio Import | `CSVImportModal.tsx`, `importHoldings()` in actions.ts | `PortfolioTab.tsx` |
| 2 | Live Prices | `refreshHoldingPrices()` in actions.ts | `PortfolioTab.tsx` |
| 3 | Creator Search | `CreatorSearchBar.tsx`, `/api/creators/search/route.ts` | `creators-tab.tsx` |
| 4 | Mobile Layout | none | `page.tsx`, `PortfolioTab.tsx`, `BuyListTable.tsx`, `TrustWeightSlider.tsx`, `creators-tab.tsx` |

---

## Cross-Cutting Concerns

### Server/Client Boundary Rules (existing — must not be broken)

- `generator.ts` has zero server imports — must stay that way. Live prices flow through DB → RSC props, not through generator directly.
- Decimal fields must be serialised to `number` before crossing RSC→client boundary (already done in `dashboard/page.tsx`).
- All money arithmetic in server actions uses `parseFloat()` → DB numeric string; generator uses `new Decimal()`. New price-update action follows the same pattern.

### RLS / Auth Pattern

All new server actions follow the existing pattern:
1. `createClient()` + `getUser()` — auth check
2. `createServiceClient()` — for writes that bypass RLS (holdings writes already use service client in `setFillTicker`)
3. `.eq('user_id', user.id)` — defence-in-depth scope on all reads/writes

The new `importHoldings` and `refreshHoldingPrices` actions must follow this exact pattern.

### API Route Auth Pattern

The new `/api/creators/search` route follows the existing `/api/refresh/[creatorId]` pattern: `createClient()` + `getUser()`, return 401 if no session.

### Tech Debt to Not Worsen

- Pre-existing TS errors in `creator-actions.ts` — do not spread the `eslint-disable-next-line @typescript-eslint/no-explicit-any` pattern further. New service client calls should type the client correctly or accept the existing `as any` cast pattern is contained to plan-actions.ts.
- `unified_allocation: {}` stub in `upsertBuyList` — unrelated to v1.1; leave as-is.
