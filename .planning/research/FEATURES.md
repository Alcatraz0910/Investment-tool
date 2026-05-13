# Feature Landscape — Pulse v1.1

**Domain:** Personal investment portfolio tool (UK ISA, monthly planning)
**Researched:** 2026-05-13
**Milestone:** v1.1 — Portfolio Intelligence

---

## Feature 1: CSV Portfolio Import

### What Users Expect

Any serious portfolio tracker supports CSV import. Without it, users re-type holdings every time they switch brokers or want to refresh after a period away. Manual entry is the #1 abandonment point in personal finance tools. This is **table stakes**.

### Table Stakes

| Behaviour | Why Expected | Complexity |
|-----------|--------------|------------|
| File pick or drag-and-drop upload | Standard UX for file import | Low |
| Auto-detect delimiter (comma, semicolon, tab) | PapaParse handles this; users never think about it | Low |
| Column header auto-map to Pulse schema | Portfolio tools (Portfolio Performance, Portfolyo) all do this | Medium |
| Preview table before confirming save | Non-negotiable: wrong import destroys portfolio data | Medium |
| Row-level validation errors shown inline | Users need to fix bad rows without re-uploading | Medium |
| Replace vs merge option | User may want to overwrite or append | Low |

### Differentiators

| Behaviour | Value Proposition | Complexity |
|-----------|-------------------|------------|
| Named broker format detection (Freetrade, HL, AJ Bell) | Eliminates column mapping step for 90% of UK users | Medium |
| Saved mapping memory (re-use last mapping for same broker) | Saves power users time on repeat imports | Low |
| ISA vs GIA account tagging during import | Pulse is ISA-specific; mixed-account CSV is common | Low |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full transaction history import | Pulse tracks current holdings, not trade history | Import holdings snapshot only (quantity + avg cost) |
| XLS/XLSX support | Requires additional parsing library; xlsx is a 2MB dep | Require CSV; broker tools can export CSV |
| Server-side CSV processing | Unnecessary round-trip; privacy concern | Parse entirely in browser with PapaParse |

### Known UK Broker CSV Formats (as of research date, MEDIUM confidence)

**Freetrade** — exports from Activity tab. CSV contains transaction events (BUY/SELL rows), not a holdings snapshot. Columns include: `Date`, `Type`, `Ticker symbol`, `Security name`, `No. of shares`, `Price per share`, `Transaction value`, `Order ID`. Users must derive current holdings from transaction history — or Freetrade may provide a separate holdings export; exact column set requires live verification.

**Hargreaves Lansdown (HL)** — portfolio holdings CSV confirmed to exist. Community-verified columns include: `Company`, `Holding` (quantity), `Avg Cost`, `Book Cost`, `Latest Price`, `Valuation`, `+/- (£)`, `+/- (%)`. Export is 3-month blocked for transaction history. Holdings snapshot available separately.

**AJ Bell** — CSV export confirmed available site-wide. Exact column names for portfolio holdings not confirmed from official docs; require live sample file for reliable detection. Community tools (Portfolio Performance, Sharesight) support AJ Bell imports, implying a stable format exists.

**Implication for Pulse:** Build a generic column mapper as the fallback. Add named presets for Freetrade, HL, and AJ Bell once column names are confirmed from live test exports. Auto-detect by checking if CSV headers match a known preset — if yes, skip the manual mapping step.

### UX Pattern (industry standard, HIGH confidence)

```
Step 1 — Upload:     Drag-and-drop zone or file picker (react-dropzone)
Step 2 — Detect:     PapaParse reads headers; try known broker presets in order
Step 3 — Map:        Show 2-col table: CSV column → Pulse field (ticker, qty, avg_cost, account_type)
                     Auto-matched columns highlighted; unmatched flagged in amber
Step 4 — Preview:    First N rows rendered as holdings cards; validation errors shown inline
Step 5 — Confirm:    "Import X holdings" button → upsert to Supabase holdings table
```

### Recommended Stack

- **PapaParse** — browser-side CSV parsing, auto-delimiter, header row mode, worker thread for large files (HIGH confidence — de facto standard)
- **react-dropzone** — drag-and-drop + file picker (HIGH confidence — widely used)
- **Supabase upsert** — `on_conflict: ticker` to handle re-imports cleanly
- No new server routes needed; parse client-side, write via existing Supabase client

### Complexity

**Medium overall.** The parser and upload are low-effort. The column mapping UI and broker preset detection are the meaty parts. Preview + validation adds a sprint of work but is non-negotiable for data quality. Estimated: 2–3 focused sessions.

### Dependencies on Existing Pulse Features

- Replaces manual holding entry in Phase 2 portfolio management
- Holdings schema already exists in Supabase (Phase 2)
- ISA contribution tracking (Phase 2) is unaffected — CSV import is for holdings, not contributions

---

## Feature 2: Creator Discovery / Search

### What Users Expect

Current v1.0 flow requires pasting a channel URL. Most users do not know channel URLs — they know creator names. Search-by-name is standard in any tool that integrates with social content. This is **table stakes** for creator onboarding.

### Table Stakes

| Behaviour | Why Expected | Complexity |
|-----------|--------------|------------|
| Search by creator name or keyword | Users know names, not URLs | Low |
| Show channel thumbnail + subscriber count in results | Users need to distinguish between creators with similar names | Low |
| "Add to my creators" from search result | Single action from discovery to tracking | Low |
| Debounced search (300ms) | Prevents quota burn on every keystroke | Low |
| Graceful empty state when no results found | Standard search UX | Low |

### Differentiators

| Behaviour | Value Proposition | Complexity |
|-----------|-------------------|------------|
| Filter results to finance/investing category | Reduces noise from unrelated creators with same name | Low (YouTube API supports `videoCategoryId` filtering, though channel category is less precise) |
| Show existing strategy confidence score if creator already tracked | Helps user decide whether to add another source | Low |
| Search result shows video count / last upload date | Proxy for creator activity level | Low |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time search on every keystroke | Burns YouTube API quota (100 units/search, 10,000/day default) | Debounce 300–500ms + require minimum 3 chars before firing |
| Storing search results in Supabase | Unnecessary; search is ephemeral | Fetch live, display, discard |
| Full-text creator content search | Out of scope; Pinecone handles that | Keep search to channel discovery only |

### YouTube Data API v3 Search Mechanics (HIGH confidence)

- Endpoint: `GET https://youtube.googleapis.com/youtube/v3/search`
- Required params: `part=snippet`, `q={name}`, `type=channel`
- Returns: channel ID, title, description, thumbnail URL, publish date
- Quota cost: **100 units per call**
- Default daily quota: **10,000 units** = 100 searches/day
- Additional channel metadata (subscriber count): requires a second `channels.list` call with `part=statistics`, which costs only **1 unit**

**Quota strategy for Pulse:** The existing transcript pipeline already consumes YouTube quota. Search adds 100 units per user-initiated search. At personal use scale (a few searches per session), this is fine. Add a server-side Next.js route to keep the API key off the client. No caching needed at this scale.

**Implementation pattern:**
```
Next.js API route: GET /api/creators/search?q={query}
→ YouTube search.list (type=channel, part=snippet)
→ For top 5 results, batch channels.list (part=statistics)
→ Return merged results to client
```

### Complexity

**Low.** YouTube API is already integrated in v1.0 for transcript fetching. Adding a search route is a thin wrapper. The UI is a standard search input + results list. Estimated: 1 session.

### Dependencies on Existing Pulse Features

- YouTube Data API key already provisioned (Phase 3)
- `creators` table and track/untrack logic already exists (Phase 2)
- The "Add" action from search result calls the same `trackCreator` flow as manually adding a URL

---

## Feature 3: Live Prices for Portfolio Valuation

### The Core Question: Does "Live" Mean Real-Time?

**For a monthly ISA planning tool, the answer is no.**

Pulse generates a monthly Buy List. Users check it once a week at most, not intra-day. Real-time streaming prices add complexity, cost, and API fragility for zero planning benefit. What Pulse actually needs:

- **Daily close price** — sufficient for portfolio valuation display
- **Delayed quote (15–20 min)** — acceptable for Buy List enrichment
- **Refreshed on page load or manual trigger** — not streaming

This framing changes the entire technology decision.

### TradingView — NOT Viable (HIGH confidence)

TradingView does **not** offer a public data REST API. It is a data licensee (not owner) and does not sell programmatic access to price data. Third-party wrappers exist (`tradingviewapi.com`, `Mathieu2301/TradingView-API` on GitHub) but are unofficial, scrape-based, and violate TradingView's terms of service. The PROJECT.md reference to "TradingView live prices" should be interpreted as "live market prices" not "prices specifically from TradingView."

### Recommended Alternative: Alpha Vantage (MEDIUM confidence)

| Property | Alpha Vantage Free | Alpha Vantage Premium |
|----------|-------------------|-----------------------|
| LSE coverage | Yes (`.LON` suffix) | Yes |
| Daily close | Yes | Yes |
| Rate limit | 25 requests/day | From 75/min |
| ETF support | Yes | Yes |
| Cost | Free | From $50/mo |
| Reliability | Stable, well-documented | Same |

**Free tier (25 req/day) is sufficient for Pulse.** A portfolio of 20 holdings = 20 API calls. Refresh once per session = within limits. If the portfolio grows, batch endpoints reduce calls further.

**LSE ticker format:** Append `.LON` for Alpha Vantage (e.g., `VUSA.LON`, `HSBA.LON`). This differs from Yahoo Finance (`.L`) — Pulse must store tickers with exchange suffix or resolve at fetch time.

### Alternative: Twelve Data (MEDIUM confidence)

| Property | Twelve Data Free |
|----------|-----------------|
| LSE coverage | Yes (XLON exchange) |
| Daily close (EOD endpoint) | Yes |
| Rate limit | 800 req/day, 8/min |
| ETF support | Yes |
| Cost | Free |

Twelve Data free tier is more generous (800/day vs 25/day), making it more suitable if portfolio size grows. However, the free plan restricts which symbols are accessible — UK/LSE symbols may require a paid tier for full coverage. Requires live verification.

### Alternative: Yahoo Finance (unofficial) (LOW confidence)

`yahoo-finance2` npm package works as of 2025 but is unofficial, fragile, and rate-limited by Yahoo. Not recommended for production. Use as a development fallback only.

### Table Stakes

| Behaviour | Why Expected | Complexity |
|-----------|--------------|------------|
| Current price displayed next to each holding | Users expect to see portfolio value, not just quantity | Medium |
| Total portfolio value in £ calculated from prices | Core feature of any portfolio tool | Low (arithmetic) |
| Price refresh on page load or manual button | Daily freshness sufficient | Low |
| "Price as of" timestamp shown | Transparency about data staleness | Low |
| Graceful degradation when API unavailable | API outages must not break the portfolio view | Low |

### Differentiators

| Behaviour | Value Proposition | Complexity |
|-----------|-------------------|------------|
| % gain/loss per holding (vs avg cost) | Common in portfolio tools; users find it useful | Low (arithmetic) |
| Buy List enrichment: show current price in plan output | Context for planned buy amounts | Low |
| Colour-coded price delta (green/red) | Standard dashboard visual affordance | Low |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time streaming / WebSocket prices | Massive complexity; rate limits; irrelevant for monthly planner | Fetch on load + manual refresh |
| Storing historical OHLCV for charting | Out of scope for v1.1; adds schema complexity | Store only latest price per ticker |
| Showing intraday candles | Pulse is a planner, not a trading terminal | Show daily close only |
| Multi-exchange arbitrage (same ticker, different exchanges) | UK ISA only; all holdings are LSE/LSE-listed ETFs | Store one price per ticker |

### Recommended Implementation Pattern

```
New table: ticker_prices (ticker TEXT PK, price DECIMAL, currency TEXT, fetched_at TIMESTAMPTZ)
Refresh route: POST /api/prices/refresh
  → Read distinct tickers from user's holdings
  → Batch fetch from Alpha Vantage (GLOBAL_QUOTE endpoint)
  → Upsert to ticker_prices
  → Return to client
Portfolio view: JOIN holdings with ticker_prices for display
```

Store prices in Supabase rather than fetching client-side — keeps API key server-side, reduces client calls, and enables future scheduled refresh.

### Complexity

**Medium.** Alpha Vantage integration is low-friction. The schema addition (`ticker_prices`) is straightforward. The UX changes (price columns, valuation totals, % gain) touch multiple existing components. Estimated: 2 sessions.

### Dependencies on Existing Pulse Features

- Holdings table exists (Phase 2) — tickers already stored
- Buy List generator (Phase 5) can be enriched with prices without changing core logic
- decimal.js constraint applies — all price arithmetic must use `new Decimal()`

---

## Feature 4: Mobile-Responsive Layout

### What Users Expect

In 2026, any web tool is expected to be usable on a phone. The existing glassmorphism dashboard (tabs, sliders, Recharts charts, data tables) is desktop-only. Mobile support is **table stakes** — not a differentiator.

### The Real Problem

Pulse's current UI has several mobile-hostile patterns:

1. **Tab row** — 3–4 tabs in a horizontal row collapse badly below `md` breakpoint
2. **Trust-weight sliders** — 300px+ wide interactive elements need to fit in 375px viewport
3. **Recharts charts** — fixed-width charts overflow on small screens; need `ResponsiveContainer`
4. **Holdings tables** — wide columns (ticker, name, quantity, value, %) don't fit in 375px; need either horizontal scroll or card view
5. **Buy List table** — same problem as holdings table

None of these require new data features — this is purely a CSS/layout change.

### Table Stakes

| Behaviour | Why Expected | Complexity |
|-----------|--------------|------------|
| No horizontal overflow at 375px (iPhone SE) | Basic mobile usability | Medium |
| Tap targets ≥ 44px (Apple/Google HIG) | Touch accuracy on mobile | Low |
| Charts scale to screen width | `ResponsiveContainer` wrapper in Recharts | Low |
| Tab navigation usable on mobile | Horizontal scroll tabs or bottom nav | Low |
| Sliders usable with finger | Sufficient height + padding on range inputs | Low |

### Differentiators

| Behaviour | Value Proposition | Complexity |
|-----------|-------------------|------------|
| Bottom navigation bar on mobile (vs top tabs on desktop) | Standard mobile app pattern; feels native | Low–Medium |
| Card view for holdings/Buy List on mobile (vs table) | Tables are unreadable on 375px; cards are standard mobile pattern | Medium |
| Sticky "monthly budget" input on mobile | Key input should persist as user scrolls plan | Low |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Building a separate mobile layout | Double maintenance burden | Use Tailwind responsive prefixes throughout |
| Converting to a PWA / adding service worker | Adds deployment complexity; not requested | Ship responsive web only |
| Removing glassmorphism for mobile | Loses brand identity | Preserve `backdrop-blur` + glass cards; they work on mobile |

### Tailwind Responsive Strategy (HIGH confidence)

Tailwind uses **mobile-first** breakpoints. Unprefixed utilities apply at all sizes; `md:` and `lg:` prefix applies at ≥768px and ≥1024px respectively.

Standard breakpoints for Pulse:
- `< 768px` (no prefix) — mobile: stack layout, card-based tables, bottom nav
- `md:` (≥768px) — tablet+desktop: current side-by-side layout, top tabs, data tables

Key patterns:
```
<!-- Table → card view on mobile -->
<div class="block md:hidden"><!-- card --></div>
<div class="hidden md:block"><!-- table --></div>

<!-- Bottom nav mobile, top tabs desktop -->
<nav class="fixed bottom-0 md:static md:flex-row ...">

<!-- Full-width charts -->
<ResponsiveContainer width="100%" height={240}>
```

### Complexity

**Medium overall, Low per component.** No new APIs, no new data. Pure CSS/layout work. The effort is proportional to the number of components that need responsive variants. Holdings table, Buy List table, and charts are the highest-effort items. Glassmorphism (`backdrop-blur`, semi-transparent cards) works fine on mobile — iOS and Android both support `backdrop-filter`. Estimated: 2–3 sessions touching 6–10 components.

### Dependencies on Existing Pulse Features

- All 6 dashboard phases are affected
- Recharts `ResponsiveContainer` is already in the Recharts library (no new dependency)
- Framer Motion animations should be verified not to cause layout reflow on mobile
- Tailwind config: no changes needed; all breakpoints are standard Tailwind defaults

---

## Cross-Feature Dependencies

```
CSV Import → depends on: holdings schema (Phase 2) ✓ already built
Creator Search → depends on: YouTube API key (Phase 3) ✓ already built
                           creators table (Phase 2) ✓ already built
Live Prices → depends on: holdings table (Phase 2) ✓ already built
                        decimal.js already integrated ✓
Mobile Layout → depends on: all dashboard components (Phase 6) ✓ already built
```

No cross-dependencies between the four v1.1 features. All four can be built in parallel or sequenced arbitrarily.

---

## MVP Recommendation

**Phase ordering by value/effort ratio:**

1. **Creator Search** — Lowest effort, high daily UX value, uses existing API key. Ship first.
2. **CSV Import** — High effort but eliminates the #1 onboarding friction. Ship second.
3. **Mobile Layout** — Medium effort, enables use during commute. Ship third.
4. **Live Prices** — Medium effort, enriches existing views. Ship last (depends on holdings being imported cleanly first).

**Defer:**
- Real-time price streaming — not appropriate for a monthly planner; revisit in v2 if user demand exists
- Named broker format detection (Freetrade/HL/AJ Bell) — implement generic mapper first; add presets in a follow-on task once real export files are tested
- Bottom navigation bar — the tab layout may work adequately on mobile with horizontal scroll; validate before adding nav pattern complexity

---

## Sources

- YouTube Data API v3 search docs: https://developers.google.com/youtube/v3/docs/search/list
- YouTube quota details: https://developers.google.com/youtube/v3/determine_quota_cost
- PapaParse: https://www.papaparse.com/
- react-csv-importer: https://github.com/beamworks/react-csv-importer
- CSV import UX patterns: https://www.importcsv.com/blog/data-import-ux
- TradingView no public API confirmation: https://www.tradingview.com/support/solutions/43000474413-i-need-access-to-your-api-in-order-to-get-data-or-indicator-values/
- Alpha Vantage documentation: https://www.alphavantage.co/documentation/
- Twelve Data LSE coverage: https://twelvedata.com/exchanges/XLON
- Tailwind responsive design: https://tailwindcss.com/docs/responsive-design
- Flowbite bottom navigation: https://flowbite.com/docs/components/bottom-navigation/
- Freetrade CSV export: https://help.freetrade.io/en/articles/6627908-how-do-i-download-a-csv-export-of-my-activity-feed
- HL portfolio columns (community): https://firevlondon.com/2020/04/11/portfolio-tracking-spreadsheet-v2-0-release-notes/
