# Domain Pitfalls — Pulse v1.1

**Domain:** UK ISA investment planning tool (Next.js 15 / Supabase / Tailwind)
**Milestone:** v1.1 — CSV Portfolio Import, Creator Discovery/Search, Live Price Data, Mobile Layout
**Researched:** 2026-05-13

---

## Feature 1: CSV Portfolio Import

### Critical Pitfall 1.1 — BOM-Poisoned First Column Name

**What goes wrong:** Excel on Windows saves CSV as UTF-8 with BOM (`﻿` prepended). When parsed, the first column header becomes `﻿Ticker` instead of `Ticker`. All column-name lookups for that column fail silently — no error, just no data mapped.

**Why it happens:** PapaParse and most Node CSV parsers do not strip the BOM by default. The PapaParse `bom: true` option exists but is opt-in.

**Prevention:**
- Enable `bom: true` in PapaParse options (strips `﻿` before parsing).
- Alternatively, strip manually before parsing: `csv.replace(/^﻿/, '')`.
- Test with files saved from Excel on Windows, not just files created programmatically.

---

### Critical Pitfall 1.2 — Next.js Server Action 1MB Body Size Limit

**What goes wrong:** Server actions have a **1MB default body size limit**. A 500-holding portfolio CSV exported from HL or Trading 212 can easily exceed this. The request is silently truncated — no 413 error, the action just receives an incomplete or empty body.

**Why it happens:** Next.js enforces this to prevent DDoS. The limit is not surfaced clearly at the client level.

**Prevention:**
- Set `serverActions.bodySizeLimit` in `next.config.ts`:
  ```ts
  serverActions: { bodySizeLimit: '5mb' }
  ```
- For Next.js 15.5+, also set `proxyClientMaxBodySize: '5mb'` — a new proxy layer introduced in 15.5 that defaults to 1MB and silently drops binary data before it reaches the action.
- Parse the CSV server-side (in the action) rather than sending parsed JSON through the action body — raw CSV is far smaller than a JSON array of holdings objects.

---

### Critical Pitfall 1.3 — Number Format Variation Breaks `decimal.js` Construction

**What goes wrong:** UK brokers format numbers differently:
- Hargreaves Lansdown: `1,234.56` (thousands comma)
- Some export tools: `1234.56`
- Some European-locale exports: `1.234,56`

`new Decimal("1,234.56")` throws `[DecimalError] Invalid argument: 1,234.56`.

**Why it happens:** `decimal.js` does not accept comma-formatted strings. It treats the comma as an invalid character, not as a thousands separator.

**Prevention:**
- Strip thousands separators before `new Decimal()`: `value.replace(/,/g, '')`.
- Apply this to every numeric field: quantity, average cost, market value.
- Add a validation step after mapping: attempt `new Decimal(field)` in a try/catch per row and collect row-level errors for the preview UI.

---

### Critical Pitfall 1.4 — Overwrite vs Merge Ambiguity Corrupts Existing Data

**What goes wrong:** User imports a CSV with 10 holdings. They already have 15 manual holdings in Supabase. If import uses `upsert` on ticker, it overwrites the 10 tickers present in the CSV but leaves the other 5 untouched — creating a split state where some holdings are from the CSV snapshot and others are stale manual entries.

**Why it happens:** There is no single correct behaviour — both "replace all" and "merge" are defensible, but mixing them silently is never correct.

**Prevention:**
- Show a preview modal before commit. Make the choice explicit:
  - "Replace all holdings with this CSV" (DELETE + INSERT)
  - "Merge: update matched tickers, keep unmatched"
- Default to "Replace all" with a warning. Personal tool — one portfolio source is cleaner than two.
- Wrap in a Supabase transaction: DELETE existing rows then INSERT new ones atomically. Never a partial-replace state.

---

### Moderate Pitfall 1.5 — Ticker Symbols Not in Supabase Holdings Table

**What goes wrong:** The CSV contains tickers that don't match anything in an existing `securities` or `assets` lookup table. Silent row drops mean the imported portfolio is incomplete.

**Why it happens:** UK brokers export raw ticker symbols (e.g., `VWRL`, `SMMT`), but Pulse's holdings table may only have the tickers the user previously entered manually.

**Prevention:**
- Treat ticker as a free-text string on import — don't foreign-key it to any lookup table at the holdings level.
- Surface unrecognised tickers in the preview as "New holding — will be created" vs "Existing holding — will be updated." Let the user proceed or abort.

---

### Moderate Pitfall 1.6 — Date Format Inconsistency Across Brokers

**What goes wrong:** HL exports dates as `DD/MM/YYYY`. Trading 212 uses `YYYY-MM-DD`. Parsing `15/05/2025` as ISO fails; parsing `05/15/2025` gives the wrong month (US format misread).

**Prevention:**
- Use `date-fns/parseISO` for ISO dates, `date-fns/parse` with explicit format string for slash-delimited dates.
- Detect format by regex: if `/^\d{4}-\d{2}-\d{2}$/` → ISO; if `/^\d{2}\/\d{2}\/\d{4}$/` → DD/MM/YYYY. Never assume US format for UK broker exports.
- For v1.1 CSV import of holdings (not transactions), date may not be required at all — skip it rather than risk misparse.

---

### Minor Pitfall 1.7 — CORS is Not the Issue, But Auth Is

**What goes wrong:** Developers instinctively add CORS headers for file uploads. In Next.js App Router with server actions, CORS is irrelevant for same-origin uploads. The real failure is auth context: `getUser()` in a server action only works if the Supabase auth cookies are present in the request.

**Prevention:**
- Use `createServerActionClient` (or the Supabase SSR helper) inside the action, not the anon client.
- Test upload as an authenticated user — don't test in an Incognito tab where the session cookie is absent.

---

## Feature 2: Creator Discovery/Search

### Critical Pitfall 2.1 — `search.list` Exhausts Daily Quota in Minutes

**What goes wrong:** YouTube Data API's daily quota is **10,000 units**. `search.list` costs **100 units per call**. A user typing a search query with 3-character debounce firing on every keystroke can burn 1,000 units (10 calls) before finishing typing a name. Three users searching actively can exhaust the entire day's quota.

**Why it happens:** The quota cost asymmetry — `channels.list` costs 1 unit, `search.list` costs 100 — is not obvious from the API surface. Both look like "search" to the implementer.

**Prevention:**
- Debounce search input to **500ms minimum**, not 200–300ms.
- Never fire `search.list` on each keystroke — only on explicit submit (Enter key or Search button) or after debounce settles.
- Cache results in Supabase or in-memory for the session: if the user searches "Graham Stephan" twice, use the cached result.
- Display remaining-quota feedback in dev (log units consumed). Set up quota alerting in Google Cloud Console.
- Consider a server-side rate limiter per user session to prevent quota abuse in multi-user scenarios (v2 concern, but architect for it now).

---

### Critical Pitfall 2.2 — Search Returns Non-Investment Channels

**What goes wrong:** `search.list` returns channels by keyword relevance. Searching "UK investing" returns fitness influencers, cooking channels, and real estate agents alongside finance YouTubers. There is no content-type filter in the YouTube API.

**Why it happens:** YouTube's search algorithm is not content-category-aware via the API. The `type=channel` filter narrows to channels only, but not to investment-content channels.

**Prevention:**
- After retrieving channels from `search.list`, call `channels.list` (1 unit each) to fetch the description and subscriber count.
- Apply a client-side heuristic filter: keywords in channel description (`invest`, `ISA`, `portfolio`, `dividend`, `FIRE`, `stocks`, `ETF`) used to flag likely-relevant results.
- Show the channel description snippet in the search UI so the user can make the judgment call. Don't auto-add.
- Cap search results at 5 — do not paginate. More results = more quota + more noise.

---

### Moderate Pitfall 2.3 — Channel Has No Videos Indexed in Pulse Yet

**What goes wrong:** User discovers and adds a new channel via search. The channel is now in `tracked_creators` but has no transcripts, no Pinecone chunks, no strategy extraction. The dashboard silently shows no strategy for this creator, which looks like a bug.

**Prevention:**
- After adding a creator, immediately prompt: "Refresh transcripts to start extracting strategy?" with a button that triggers the existing manual refresh flow.
- Show an explicit empty state on the creator card: "No strategy yet — click Refresh to fetch transcripts." Do not render a blank strategy panel that looks broken.
- This is an existing UX pattern from v1.0 — reuse it; don't add a new code path.

---

### Minor Pitfall 2.4 — Channel ID vs Handle vs URL Input Ambiguity

**What goes wrong:** The existing v1.0 custom URL feature accepts YouTube channel URLs. Discovery search returns channel IDs. These are different inputs to the same `creators` table. Conflation causes duplicate rows (same channel added as a URL-custom entry and as a search result).

**Prevention:**
- Normalise all inputs to `channel_id` (the `UCxxxxxxxx` format) before inserting into `creators`.
- Before insert, check: `SELECT id FROM creators WHERE youtube_channel_id = $1`. If exists, show "Already tracking this creator."
- The `channels.list` API call (needed anyway for the channel description/subscriber count) returns the canonical channel ID — use that as the deduplication key.

---

## Feature 3: Live Price Data

### Critical Pitfall 3.1 — API Key Exposure on the Client

**What goes wrong:** Price data fetching logic is written in a client component (to avoid server round-trips). The API key for the price provider (Yahoo Finance wrapper, Alpha Vantage, etc.) is embedded in the client bundle or called directly from the browser, exposing it publicly.

**Why it happens:** Developer optimises for simplicity — fetch in `useEffect`, pass key from `NEXT_PUBLIC_*` env var. `NEXT_PUBLIC_*` variables are bundled into client JS and visible in the browser's source.

**Prevention:**
- All price API calls must go through a **Next.js Route Handler** (`/api/prices`) or a server action. Never `NEXT_PUBLIC_PRICE_API_KEY`.
- The Route Handler calls the price provider with the server-side env var, returns the price data to the client.
- Rate-limit the Route Handler per user session to prevent misuse even from authenticated users.

---

### Critical Pitfall 3.2 — Stale Prices Displayed as "Live" Without Disclosure

**What goes wrong:** Prices are fetched once on page load and cached. 20 minutes later, the portfolio valuation still shows the same prices. There is no visual indication that prices are not current. This is a regulatory/trust risk: presenting stale financial data as live is misleading.

**UK-specific context:** LSE data through most free providers (Yahoo Finance, Alpha Vantage free tier) is delayed **15 minutes by exchange licensing rules**. This is not a bug — it is a contractual and regulatory constraint.

**Prevention:**
- Display a timestamp: "Prices as of HH:MM (15-min delayed)." Never label as "Live" unless confirmed real-time.
- Add a visible "Refresh prices" button rather than auto-polling (consistent with v1.0 manual-refresh philosophy, and avoids rate limit burn).
- Store the fetch timestamp alongside prices; visually flag prices older than 30 minutes as stale (e.g., grey out or show a warning icon).
- In the Buy List output, add to the existing disclaimer: "Prices shown are indicative and may be delayed up to 15 minutes. Not financial advice."

---

### Critical Pitfall 3.3 — UK Ticker Symbol Format Mismatch

**What goes wrong:** User holds `VWRL` (LSE-listed Vanguard ETF). Yahoo Finance requires `VWRL.L` to identify the LSE listing. Without the `.L` suffix, Yahoo Finance either returns no data or returns the wrong security (a US-listed ticker with the same symbol).

**Why it happens:** Pulse stores tickers as bare symbols (`VWRL`, `LLOY`, `BP`). Price APIs for UK equities require exchange suffixes.

**Provider-specific suffixes:**
- Yahoo Finance: `.L` for LSE (e.g., `VWRL.L`, `LLOY.L`)
- Alpha Vantage: `LON:VWRL`
- Some providers: no suffix required (exchange is inferred from currency)

**Prevention:**
- Store a separate `exchange` field on the holding (defaulting to `LSE` for this personal UK ISA tool).
- Apply suffix transformation at the price-fetch layer, not in the holding data: `const yahooTicker = exchange === 'LSE' ? ticker + '.L' : ticker`.
- On import and manual entry, validate that the ticker resolves to a price — show a warning if not. Don't silently show £0 or null.
- For index funds (e.g., `VANGUARD FTSE ALL-WORLD UCITS ETF`), the ISIN is more reliable than the ticker symbol for price lookups. Consider storing ISIN alongside ticker for fund holdings.

---

### Critical Pitfall 3.4 — Price × Quantity Uses Native Float Instead of decimal.js

**What goes wrong:** Live prices arrive from the API as JS numbers (floats). Portfolio valuation calculates `price * quantity` using native `*`. This violates the project's `decimal.js` constraint and introduces floating-point errors at display time.

**Why it happens:** The price data path is new code — the developer knows about `decimal.js` in `PlanGenerator.ts` but forgets to apply it in the new portfolio valuation component.

**Prevention:**
- All arithmetic in portfolio valuation must use `decimal.js`: `new Decimal(price).times(new Decimal(quantity))`.
- Treat the price from the API as a string or call `.toString()` before passing to `Decimal` constructor — avoids the float-to-Decimal rounding the API float already carries.
- Lint rule / code review checklist: any file doing `price *` or `quantity *` is a red flag.

---

### Moderate Pitfall 3.5 — Rate Limits Break the Entire Portfolio View

**What goes wrong:** The Route Handler fetches prices for all holdings in one render. If the user holds 25 securities and the price API limits to 5 requests/second, the batch fails or returns partial results. The portfolio view shows a mix of priced and unpriced holdings with no clear error.

**Prevention:**
- Batch ticker symbols in one API call where the provider supports it (Yahoo Finance v2 `spark` endpoint accepts comma-separated tickers).
- If batching is not available, use sequential requests with a small delay between them server-side. Never fire 25 parallel fetch requests from the client.
- Implement partial-success rendering: show price for holdings that resolved, show "—" for those that failed, and surface a non-blocking error banner: "Some prices could not be fetched."

---

### Minor Pitfall 3.6 — TradingView Widget vs TradingView Data API Are Different Products

**What goes wrong:** The PROJECT.md mentions "TradingView live prices." The TradingView **embeddable widget** (free, iframe-based) displays a chart for one ticker. The TradingView **Data API / Broker API** (paid, requires partnership agreement) provides programmatic price data. Treating them as equivalent wastes implementation time.

**Why it happens:** "TradingView" is used colloquially to mean price data. Their public widgets do not expose programmatic price values — they display in an iframe only.

**Prevention:**
- Clarify in phase planning which product is intended. For portfolio-wide valuation (many tickers), the free TradingView widget is not suitable.
- Practical alternatives for a personal tool: Yahoo Finance unofficial API (free, no key, rate-limited), Alpha Vantage free tier (25 requests/day after key registration), or Open Exchange Rates for FX if multi-currency.
- If TradingView widgets are used for individual ticker charts (decorative), that is viable — but the price number must come from a separate data source.

---

## Feature 4: Mobile-Responsive Layout

### Critical Pitfall 4.1 — Recharts SVG Overflows on Small Screens Without Explicit Container Constraints

**What goes wrong:** `<ResponsiveContainer width="100%" height={300}>` inside a flex/grid parent renders correctly on desktop. On mobile (320–390px wide), the SVG renders at a fixed width (the width the component measured at mount time) and causes horizontal scroll on the page.

**Why it happens:** Recharts' `ResponsiveContainer` uses a ResizeObserver. If the container is inside a CSS grid or flex layout that allows the container to be wider than the viewport at mount time, the chart locks to that width and does not shrink below it.

**Prevention:**
- Wrap each chart in a `div` with `style={{ width: '100%', overflowX: 'hidden' }}`. Never rely on a parent flex container to constrain width.
- Set `minWidth={0}` on the flex/grid child containing the chart. Without this, flex children default to `min-width: auto` which ignores the flex container's constraints.
- Test at 375px width (iPhone SE baseline) before shipping.
- For pie/donut charts showing allocation: consider switching to a simple percentage list or horizontal bar chart below 640px, which renders predictably without SVG sizing issues.

---

### Critical Pitfall 4.2 — Glassmorphism Blur Drops on iOS Safari Without `-webkit-` Prefix

**What goes wrong:** The v1.0 glassmorphism UI uses `backdrop-filter: blur(Xpx)`. On iOS Safari below version 18, `backdrop-filter` without the `-webkit-` prefix is ignored. Cards appear fully transparent (no blur/frost effect), which can make text unreadable against busy backgrounds.

**Why it happens:** Safari required `-webkit-backdrop-filter` prefix until June 2024 (Safari 18 dropped the requirement). Many users still run iOS 16/17.

**Prevention:**
- Add both in Tailwind config or inline styles:
  ```css
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  ```
- In Tailwind, create a plugin or use arbitrary variants: `[&]:[backdrop-filter:blur(12px)] [&]:[-webkit-backdrop-filter:blur(12px)]`.
- Verify the `tailwind.config.ts` glassmorphism utilities include both prefixes.
- Performance warning: 10+ blur elements on mid-range Android phones cause visible jank. Reduce blur intensity or element count for mobile.

---

### Moderate Pitfall 4.3 — Trust-Weight Sliders Are Untappable on Mobile

**What goes wrong:** The trust-weight sliders (range inputs) are styled with `h-2` (8px) track height. The thumb is similarly small. On mobile, the tap target is below the 44×44px minimum. Users cannot reliably hit the thumb; the slider either doesn't respond or jumps unexpectedly.

**Why it happens:** Range input styling is notoriously inconsistent across browsers. CSS `height` on `<input type="range">` affects the track, not the thumb. The thumb needs explicit size via browser-specific pseudo-elements.

**Prevention:**
- Style the thumb to be at least 44×44px touch target using:
  ```css
  &::-webkit-slider-thumb { width: 24px; height: 24px; }
  &::-moz-range-thumb { width: 24px; height: 24px; }
  ```
- Wrap in a `div` with `py-3` padding (adds tap area without changing layout).
- Alternatively, replace sliders with a numeric input `<input type="number" min="0" max="100">` on mobile breakpoints — more reliable touch target, exact value entry.

---

### Moderate Pitfall 4.4 — Dashboard Table Layouts Break at Mobile Widths

**What goes wrong:** The Buy List and holdings table use `<table>` with 6–8 columns. At 375px, each column is ~47px wide — truncated and unreadable. No responsive strategy means horizontal scroll or broken layout.

**Prevention:**
- At `sm:` breakpoint and below, switch Buy List table to a card list: one card per holding with ticker, allocation %, and buy amount stacked vertically.
- This is a layout change, not a data change. The same component can render as table (md+) and card list (sm-) using Tailwind responsive classes.
- Never hide the allocation % or buy amount on mobile — these are the core data the user needs on-the-go.

---

### Minor Pitfall 4.5 — No Physical Device Testing Strategy

**What goes wrong:** Responsive design is tested by dragging the browser window on a desktop. This misses:
- iOS Safari-specific rendering bugs (backdrop-filter, viewport height `100vh` vs `100dvh`)
- Android Chrome scroll behaviour
- Notch/safe area insets on modern iPhones

**Prevention:**
- Use browser DevTools device emulation as a first pass only. It does not emulate iOS Safari accurately.
- For this personal tool: test on the actual device the user will use (the developer's own phone). One real device test is worth 100 DevTools checks.
- For `100vh` issues on mobile (browser chrome pushes content below fold): use `100dvh` (dynamic viewport height) instead of `100vh` on full-height containers.
- Add `viewport-fit=cover` to `<meta name="viewport">` and `padding-bottom: env(safe-area-inset-bottom)` on the bottom nav/fixed elements.

---

## Cross-Feature Integration Pitfalls

### Integration Pitfall A — CSV Import Breaks Existing Buy List (Quantity Change Without Decimal.js)

**What goes wrong:** CSV import writes new `quantity` values to the holdings table. The `generatePlan` function reads `quantity` from Supabase to compute current portfolio value and allocation drift. If the CSV import stores quantity as a raw JS float (e.g., `parseFloat(row.quantity)`), and `generatePlan` wraps it in `new Decimal()`, the Decimal constructor receives a float already carrying rounding error.

**Prevention:**
- Store quantity in Supabase as `numeric` type (not `float8`). Supabase returns `numeric` as a string in the JS client — `new Decimal("1234.5")` is safe.
- In the import pipeline, parse the CSV string directly to `new Decimal()`, call `.toString()`, and store that string value.

---

### Integration Pitfall B — Price Data Conflicts With Plan Generator's Cost Basis Logic

**What goes wrong:** Live prices surface the current market value of holdings. The plan generator uses average cost (book cost) from the holdings table to compute allocation drift. If live prices are inadvertently written back into the `average_cost` field during an import or sync, the allocation drift calculation becomes wrong.

**Prevention:**
- Keep a strict separation: `market_price` (live, volatile) is never stored in `holdings.average_cost`. These are separate fields serving separate purposes.
- The plan generator should only read `average_cost` (or `quantity`) from the holdings table. Live prices are fetched on-demand for display only, never persisted as cost basis.

---

### Integration Pitfall C — Creator Search Adds Channel Already in Curated Admin List

**What goes wrong:** Admin-curated creators and user-searched creators share the same `creators` table. A user searches for and adds "Damien Talks Money" — but this creator is already in the curated list under a slightly different name. Two rows exist; the user ends up with duplicate strategy extractions that double-weight one creator in the blend.

**Prevention:**
- Deduplication key is `youtube_channel_id` (canonical, unique). Apply `UNIQUE` constraint on that column if not already present.
- Before inserting via discovery, query by `youtube_channel_id`. If exists, link the user to the existing row via `tracked_creators` rather than inserting a new `creators` row.

---

### Integration Pitfall D — Mobile Layout Breaks Contribution Calculator Client-Side Recomputation

**What goes wrong:** The v1.0 `ContributionCalculator` recomputes the plan client-side with zero server imports (documented as a key decision). On mobile, a state update (e.g., slider change) triggers re-render. If the new mobile layout adds a server component wrapper around the calculator, the recomputation breaks or causes a full server round-trip.

**Prevention:**
- The mobile layout refactor must keep `ContributionCalculator` and the plan generator in the client component tree. Do not add `async` or server component wrappers to these components.
- Verify by checking the component boundary: the `"use client"` directive must remain on `ContributionCalculator` and any new mobile wrapper components that contain it.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| CSV Import — parsing | BOM on first column, float construction | PapaParse `bom:true`, strip commas before `new Decimal()` |
| CSV Import — persistence | Overwrite vs merge ambiguity | Explicit preview modal with user choice before commit |
| CSV Import — server action | 1MB body limit silent failure | `bodySizeLimit: '5mb'` in `next.config.ts`, test with large files |
| Creator Search — quota | `search.list` 100-unit cost | 500ms debounce, explicit submit, result caching |
| Creator Search — duplicates | Same channel added twice | UNIQUE on `youtube_channel_id`, dedup before insert |
| Live Prices — auth | API key in client bundle | Route Handler only, never `NEXT_PUBLIC_PRICE_*` |
| Live Prices — UK tickers | Missing `.L` suffix for LSE | Exchange-aware suffix layer at fetch boundary |
| Live Prices — disclosure | Stale prices shown as live | Timestamp + "15-min delayed" label on all price displays |
| Live Prices — arithmetic | Float × quantity bypasses decimal.js | `new Decimal(price.toString()).times(quantity)` everywhere |
| Mobile Layout — charts | Recharts SVG overflow | `overflowX: hidden` wrapper, `minWidth: 0` on flex children |
| Mobile Layout — blur | iOS Safari backdrop-filter | `-webkit-backdrop-filter` alongside unprefixed in all glass utilities |
| Mobile Layout — sliders | Trust-weight thumb too small | 44px thumb target, or switch to number input on mobile |
| Cross-feature — import+plan | Float quantity breaks plan generator | Supabase `numeric` column type, store as string |
| Cross-feature — prices+plan | Live price written to cost basis | Never persist `market_price` to `average_cost` field |
