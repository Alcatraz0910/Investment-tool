# Technology Stack — v1.1 Additions

**Project:** Pulse
**Milestone:** v1.1 Portfolio Intelligence
**Researched:** 2026-05-13
**Scope:** NEW additions only. Existing stack (Next.js 15, Supabase, Pinecone, Claude, OpenAI, Recharts, decimal.js, Framer Motion) is validated and NOT re-researched.

---

## Feature 1: CSV Portfolio Import

### New Packages

| Package | Version | Purpose | Why |
|---------|---------|---------|-----|
| `papaparse` | 5.5.3 | CSV parsing in-browser | De facto standard (8.4M weekly downloads), RFC-4180 compliant, header auto-detect, streaming, no deps, TypeScript via `@types/papaparse` |
| `@types/papaparse` | ^5.3.x | TypeScript types for papaparse | PapaParse itself is JS-only; types maintained in DefinitelyTyped |
| `react-dropzone` | 14.2.3 | Drag-and-drop file input | Headless, unstyled — you apply existing Tailwind/glassmorphism classes. Zero conflict with existing design system |

### Do NOT Add

- `react-papaparse` — wrapper around PapaParse that adds React overhead; use PapaParse directly with `onChange` on an `<input type="file">` or react-dropzone's `onDrop`
- `csv-parse` (Node.js) — server-side parser; CSV should be parsed client-side before upload to avoid sending raw files to the server
- Any dedicated "CSV importer UI" library — they impose their own design language and will fight the glassmorphism theme; build the column-mapping step as a plain React component

### Integration Notes

- Parse entirely client-side: `Papa.parse(file, { header: true, skipEmptyLines: true, dynamicTyping: true })`
- PapaParse returns `{ data, errors, meta }` — use `meta.fields` (header row) to drive the column-mapping UI
- Broker format auto-detection: inspect `meta.fields` against known patterns (Hargreaves Lansdown exports "Stock", "Units Held", "Price (p)"; AJ Bell exports "Security", "Quantity", "Price"). No external library needed — a small `detectBrokerFormat(fields: string[])` util is sufficient
- GBX vs GBP: HL exports prices in pence (GBX). Divide by 100 before storing. Use `decimal.js` for this conversion — it's already in the project

---

## Feature 2: Creator Discovery / Search

### New Packages

None. YouTube Data API v3 `search.list` is **already integrated** in the project.

### API Usage

| Endpoint | Quota Cost | Daily Budget | Effective Limit |
|----------|-----------|--------------|-----------------|
| `search.list` | 100 units/call | 10,000 units/day | ~100 search calls/day |

### Integration Notes

- Call `search.list` with `type=channel&q={query}&part=snippet&maxResults=10`
- Returns `channelId`, `title`, `description`, `thumbnails` — sufficient to populate a search result card UI
- Quota: 100 units per `search.list` call. With 10,000 units/day default, budget is ~100 searches/day. Acceptable for personal use; no paid quota increase needed
- Debounce the search input by 500ms to avoid burning quota on every keystroke
- Cache results in React state (not persisted) — no new caching library needed

### Do NOT Add

- Any third-party YouTube channel search package — they wrap the same API with added fragility
- Server-side caching (Redis, etc.) for search results — over-engineering for personal-use quota levels

---

## Feature 3: Live Prices

### Decision: TradingView Free Widgets (NOT a data API)

**Recommendation: Use TradingView's free embeddable widgets via `react-ts-tradingview-widgets` (v1.2.8).**

#### Why Not the Alternatives

| Option | UK/LSE Coverage | Cost | Reliability | Verdict |
|--------|----------------|------|-------------|---------|
| **TradingView Widgets** | Full LSE/FTSE coverage, real-time | Free (with TV branding) | Official, maintained by TradingView | **USE THIS** |
| TradingView Data API (tradingviewapi.com) | Full | $10–$80/month | Third-party, not TradingView's own product | Too expensive for personal tool |
| `@mathieuc/tradingview` npm | Full | Free | Unofficial scraper, ToS risk, fragile | Do NOT use |
| `yahoo-finance2` (v3.14.0) | LSE via `.L` suffix | Free | Unofficial, Yahoo may break anytime, 15–20 min delayed | Fallback only |
| Alpha Vantage | LSE supported | Free: 25 req/day | Official but 25 req/day is unusable for portfolio valuation | Too restrictive |
| Polygon.io | US-focused; UK coverage unconfirmed | Free: 100 calls/month | Official | Not confirmed for LSE |

#### TradingView Widget Approach

TradingView provides free embeddable widgets (iframe-based) with **no API key required**. They display real-time prices with TradingView branding. This is their officially supported free tier.

| Package | Version | Purpose | Why |
|---------|---------|---------|-----|
| `react-ts-tradingview-widgets` | 1.2.8 | React wrapper for TradingView free widgets | TypeScript-first, covers SingleTicker, TickerTape, MiniChart widgets; wraps TradingView's own embed code |

#### Widget Types Available

| Widget | Use in Pulse | Notes |
|--------|-------------|-------|
| `SingleTicker` | Per-holding price row in portfolio table | Shows current price + % change for one symbol |
| `TickerTape` | Top-of-dashboard price strip | Scrolling tape of user's holdings |
| `MiniChart` | Optional: sparkline per holding | 52-week chart overlay |

#### LSE Symbol Format

TradingView uses `LSE:VWRL`, `LSE:FCIT`, etc. Store the TradingView symbol alongside the ticker in the `holdings` table (or derive it from a `{exchange}:{ticker}` convention). Not all AIM/smaller cap stocks are available — document this limitation.

#### Integration Notes

- Widgets are iframes; use `dynamic(() => import(...), { ssr: false })` in Next.js to avoid SSR mismatch
- `react-ts-tradingview-widgets` has a reported Next.js build issue (#42 on GitHub). Mitigate: import with `next/dynamic` and `ssr: false`. If build still fails, fall back to a plain script-inject approach (copy TradingView's embed snippet into a `useEffect`)
- TradingView branding appears on all free widgets — acceptable for a personal tool
- Widgets are read-only display. They do NOT expose price data as JavaScript values — you cannot programmatically read a price out of a widget to use in `generatePlan`. See Limitation below

#### Critical Limitation: Widgets Cannot Feed generatePlan

TradingView free widgets are display-only iframes. They cannot pass price data back to your React app. If you need live prices in the Buy List calculation (portfolio current value), you need a **data API** — not a widget.

**Resolution for v1.1:** Scope live prices as display enrichment only (show current price next to each holding). Keep `generatePlan` using manually entered book values. If programmatic prices are needed, revisit `yahoo-finance2` as a server-side Route Handler (15-min delayed, free, unofficial) or Alpha Vantage premium in v1.2.

#### Do NOT Add

- `@mathieuc/tradingview` or any unofficial TradingView scraper — ToS violation risk
- Polygon.io — insufficient evidence of LSE coverage
- A full charting library (Highcharts, etc.) — already have Recharts; don't add a second charting dependency
- `react-tradingview-widget` (v1.3.2) — older, last published 5+ years ago; use `react-ts-tradingview-widgets` instead

---

## Feature 4: Mobile-Responsive Layout

### New Packages

None. Tailwind CSS (already in project) is sufficient.

### Approach

Tailwind's mobile-first breakpoint system: unprefixed utilities apply at all sizes; `md:`, `lg:` prefixes apply at breakpoints and above.

| Breakpoint | Tailwind prefix | Width |
|------------|----------------|-------|
| Mobile | (none) | < 768px |
| Tablet | `md:` | >= 768px |
| Desktop | `lg:` | >= 1024px |

### Responsive Patterns for Pulse Dashboard

| Current (desktop) | Mobile target |
|-------------------|---------------|
| Multi-column grid | Single column stack |
| Side-by-side panels | Stacked cards |
| Wide nav tabs | Scrollable horizontal tab strip or bottom sheet |
| Glassmorphism cards (fixed width) | Full-width cards with `mx-4` padding |
| Data tables | Horizontal scroll (`overflow-x-auto`) or card list |

### Glassmorphism on Mobile

`backdrop-blur-*` works on iOS Safari 9+ and Android Chrome 76+. No compatibility fallback needed for modern phones. The existing `backdrop-blur-sm/md/lg` classes work unchanged — just ensure parent containers are not `overflow: hidden` which clips the blur on some mobile browsers.

### Do NOT Add

- Any CSS-in-JS library (styled-components, emotion) — project uses Tailwind, mixing paradigms adds build complexity
- A mobile UI component library (Ionic, NativeBase) — overkill for making existing web components responsive
- A separate mobile layout/router — Next.js App Router handles responsive at the CSS level

---

## Installation Summary

```bash
# CSV import
npm install papaparse react-dropzone
npm install -D @types/papaparse

# Live prices
npm install react-ts-tradingview-widgets
```

Total new runtime dependencies: **3**. No new API keys or services required for the core 4 features.

---

## Sources

- [papaparse on npm](https://www.npmjs.com/package/papaparse) — v5.5.3, 8.4M weekly downloads
- [react-dropzone on npm](https://www.npmjs.com/package/react-dropzone) — v14.2.3
- [react-ts-tradingview-widgets on npm](https://www.npmjs.com/package/react-ts-tradingview-widgets) — v1.2.8
- [TradingView Free Widgets](https://www.tradingview.com/widget/) — no API key required
- [TradingView Widget Docs](https://www.tradingview.com/widget-docs/) — official embed documentation
- [react-ts-tradingview-widgets Next.js issue #42](https://github.com/JorrinKievit/react-ts-tradingview-widgets/issues/42)
- [YouTube Data API v3 Quota Calculator](https://developers.google.com/youtube/v3/determine_quota_cost) — search.list = 100 units
- [Alpha Vantage Free Tier](https://www.alphavantage.co/premium/) — 25 req/day confirmed
- [Yahoo Finance LSE coverage](https://help.yahoo.com/kb/SLN2310.html) — .L suffix for LSE stocks
- [yahoo-finance2 on npm](https://www.npmjs.com/package/yahoo-finance2) — v3.14.0, unofficial
- [Tailwind Responsive Design](https://tailwindcss.com/docs/responsive-design) — mobile-first breakpoints
