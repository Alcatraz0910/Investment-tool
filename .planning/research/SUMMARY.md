# Research Summary — Pulse v1.1

**Project:** Pulse
**Domain:** Personal UK ISA investment planning tool
**Milestone:** v1.1 — Portfolio Intelligence
**Researched:** 2026-05-13
**Confidence:** MEDIUM-HIGH

---

## Executive Summary

Pulse v1.1 adds four self-contained features to an existing 6,900-LOC Next.js 15 / Supabase / Tailwind codebase: CSV portfolio import, creator discovery via YouTube search, live price display, and mobile-responsive layout. All four bolt onto existing infrastructure — no new services, no new API keys except one optional price provider, and minimal schema changes. The highest-value addition is CSV import (eliminates the #1 onboarding friction) paired with live prices (makes the portfolio view meaningful). Creator search and mobile layout are quality-of-life improvements that complete the milestone.

The key architectural conflict to resolve: STACK.md recommends TradingView free widgets for price display while FEATURES.md and ARCHITECTURE.md both identify yahoo-finance2 as the correct tool for programmatic price data. These solve different problems and are not in conflict. **Resolution: use yahoo-finance2 server-side for price data that feeds portfolio valuation and generatePlan; optionally layer TradingView SingleTicker widgets as decorative per-holding chart overlays.** TradingView free widgets are display-only iframes — they cannot return price values to JavaScript. This distinction must be explicit in the phase plan.

The four principal risks are: (1) LSE ticker symbol format mismatches across price providers — apply transformation at the fetch boundary, never in stored data; (2) the Next.js 15.5 server action 1 MB body limit silently truncating large CSV payloads — fix with bodySizeLimit 5mb in next.config.ts; (3) YouTube search.list burning 100 quota units per call if debounce fires on every keystroke — mitigate with 500 ms debounce and explicit submit trigger; and (4) iOS Safari dropping backdrop-filter blur without -webkit- prefix on iOS < 18 — add both prefixes to all glassmorphism utilities. All four are well-understood and preventable.

---

## Key Findings

### Recommended Stack

No new services required. Three runtime npm packages are added; mobile layout uses existing Tailwind breakpoints only.

| Package | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| papaparse | 5.5.3 | Browser-side CSV parsing — BOM support, header auto-detect, RFC-4180 compliant | HIGH |
| @types/papaparse | ^5.3.x | TypeScript types for papaparse | HIGH |
| react-dropzone | 14.2.3 | Headless drag-and-drop file input, no styling conflicts | HIGH |
| yahoo-finance2 | 3.14.0 | LSE price data via .L suffix, no API key, server-only import | MEDIUM (unofficial) |
| react-ts-tradingview-widgets | 1.2.8 | Optional decorative chart widgets (display only, not data) | MEDIUM |

**Price provider decision table (resolves STACK vs FEATURES/ARCHITECTURE conflict):**

| Provider | LSE | Rate Limit | API Key | Programmatic | Verdict |
|---------|-----|-----------|---------|--------------|--------|
| yahoo-finance2 | Yes (.L) | Fine for personal use | None | Yes — server action | **USE for price data** |
| Alpha Vantage free | Yes (.LON) | 25 req/day | Required | Yes | Too restrictive |
| Twelve Data free | Yes (XLON) | 800 req/day | Required | Yes | Fallback if yahoo-finance2 breaks |
| TradingView widgets | Display only | N/A | None | NO — iframe | Optional chart decoration only |

**Ticker suffix by provider (store bare ticker in DB; transform at fetch boundary):**
- yahoo-finance2: VWRL → VWRL.L
- Alpha Vantage: VWRL → LON:VWRL
- TradingView widget symbol: LSE:VWRL

### Expected Features

**Must have (table stakes):**
- CSV import: drag-and-drop, header auto-map, preview before commit, replace-vs-merge choice
- Creator search by name: debounced, thumbnail + subscriber count, one-click track
- Portfolio current price next to each holding with as-of timestamp and 15-min delayed disclosure
- No horizontal overflow at 375px; tap targets >= 44px

**Should have (differentiators):**
- Named broker format presets: Hargreaves Lansdown, AJ Bell (skip Freetrade — exports transaction events, not snapshot)
- % gain/loss per holding vs average cost (pure arithmetic, no new data)
- Finance-keyword heuristic filter on creator search results
- Card view for holdings/Buy List on mobile (tables unreadable at 375px)

**Defer to v2+:**
- Real-time price streaming / WebSocket
- Freetrade CSV preset (requires transaction aggregation logic)
- XLS/XLSX support (2 MB xlsx dependency)
- Historical OHLCV / sparkline charts
- TrueLayer or broker API

### Architecture Approach

All four features integrate into the existing structure without new routes, new layouts, or new services. CSV import is a modal on the Portfolio tab. Creator search is a new component on /dashboard/creators. Live prices use a new server action that writes back to holdings.current_value (column already exists). Mobile layout is a Tailwind responsive-prefix pass across 6-10 existing components.

**Component surface:**

| Feature | New Files | Modified Files |
|---------|-----------|---------------|
| CSV Import | CSVImportModal.tsx, importHoldings() in actions.ts | PortfolioTab.tsx |
| Creator Search | CreatorSearchBar.tsx, /api/creators/search/route.ts | creators-tab.tsx |
| Live Prices | refreshHoldingPrices() in actions.ts | PortfolioTab.tsx |
| Mobile Layout | none | page.tsx, PortfolioTab.tsx, BuyListTable.tsx, TrustWeightSlider.tsx, creators-tab.tsx |

**Schema changes required:**
- Add UNIQUE constraint on holdings(user_id, ticker) to enable clean upsert on re-import
- No new tables needed — holdings.current_value and holdings.updated_at already exist

**Server/client boundary rules (must not break):**
- generator.ts has zero server imports — prices flow through DB → RSC props only
- ContributionCalculator must remain a client component — mobile layout refactor must not add server wrappers
- All money arithmetic: new Decimal(price.toString()).times(quantity) — never native * on floats
- New server actions: createClient() + getUser() + createServiceClient() for writes
- New API route: follows /api/refresh/[creatorId] auth pattern

### Critical Pitfalls

**Top 5 cross-feature:**

1. **Next.js 15.5 server action body limit (1 MB) silently truncates large CSVs** — Set both serverActions.bodySizeLimit and proxyClientMaxBodySize to 5mb in next.config.ts. Better: parse CSV client-side (PapaParse) and send the pre-parsed JSON array which is smaller.

2. **LSE ticker suffix mismatch — wrong security or no data returned** — Apply .L suffix only at the yahoo-finance2 call boundary. Never store suffixed tickers. Validate each ticker resolves on first import.

3. **YouTube search.list burns 100 units per call — quota exhausted in minutes without debounce** — 500 ms debounce minimum. Fire only on explicit submit (Enter key or button), not each keystroke. Cache session results in React state.

4. **iOS Safari drops backdrop-filter without -webkit- prefix (iOS < 18)** — All glassmorphism utilities must include -webkit-backdrop-filter alongside backdrop-filter. Verify tailwind.config.ts glass plugin includes both.

5. **BOM character on first CSV column header breaks all column-name lookups silently** — Enable bom: true in PapaParse. Test with Excel-exported files on Windows.

---

## Implications for Roadmap

### Recommended Phase Structure

ARCHITECTURE.md and FEATURES.md both suggest a 4-phase build. ARCHITECTURE.md ordering (CSV → Prices → Search → Mobile) is preferred over FEATURES.md ordering (Search first) because CSV import populates real data needed to test live prices meaningfully, and mobile layout should come last after all new UI elements are frozen.

### Phase 1: CSV Portfolio Import
**Rationale:** Highest onboarding impact. Populates real holdings data needed to test Phase 2. No external API dependencies — lowest risk to ship first.
**Delivers:** Drag-and-drop CSV upload → column mapping UI → preview table → upsert to Supabase holdings.
**Addresses:** Table stakes CSV features. HL and AJ Bell presets (verify column names from real exports first).
**Avoids:** BOM pitfall, body size limit, decimal.js float issue, overwrite/merge ambiguity.
**Key files:** CSVImportModal.tsx, importHoldings() server action.
**Schema:** UNIQUE constraint on holdings(user_id, ticker).

### Phase 2: Live Price Data
**Rationale:** Depends on populated holdings from Phase 1 for meaningful testing. One new npm package, one new server action. Immediately enriches portfolio view.
**Delivers:** Refresh Prices button → yahoo-finance2 server-side batch fetch → holdings.current_value updated → portfolio shows current value, % gain/loss, as-of timestamp.
**Addresses:** Portfolio valuation display, Buy List price enrichment.
**Avoids:** API key exposure, ticker suffix mismatch, stale price disclosure, decimal.js bypass.
**Key files:** refreshHoldingPrices() server action. Optional: TradingView widget for decorative chart per holding.

### Phase 3: Creator Discovery / Search
**Rationale:** Independent of Phases 1-2. Touches a separate page. YouTube API already provisioned — thin wrapper only. Quota risk needs manual testing time.
**Delivers:** Search input on creators page → debounced API call → channel results with thumbnail/subscriber count → one-click track (reuses existing addCustomCreator).
**Addresses:** Creator onboarding by name (vs channel URL paste), finance-keyword filtering.
**Avoids:** Quota burn, noise from unrelated channels, duplicate creator rows.
**Key files:** CreatorSearchBar.tsx, /api/creators/search/route.ts.

### Phase 4: Mobile-Responsive Layout
**Rationale:** CSS-only pass — no data or logic changes. Last ensures no responsive work is discarded by earlier structural additions.
**Delivers:** No overflow at 375px, tap targets >= 44px, card view for tables on mobile, charts with ResponsiveContainer + minWidth:0.
**Addresses:** All table stakes mobile behaviours.
**Avoids:** Recharts SVG overflow, iOS Safari blur drop, untappable sliders, ContributionCalculator server component regression.
**Key files:** none new. Modifies: page.tsx, PortfolioTab.tsx, BuyListTable.tsx, TrustWeightSlider.tsx, creators-tab.tsx.

### Phase Ordering Rationale

- CSV before Prices: real holdings needed for price testing
- Prices before Mobile: freezes portfolio UI structure before responsive pass
- Creator Search third: independent, quota-risk needs testing buffer
- Mobile last: single focused pass after all new UI elements are in place
- Phases 1 and 3 are fully independent and could be parallelised

### Research Flags

**Needs research during planning:**
- Phase 2 (Live Prices): yahoo-finance2 is unofficial. Verify quote() call signature and .L suffix against installed package version before writing server action. Fallback chain: Twelve Data free → Alpha Vantage free.
- Phase 1 (CSV broker presets): HL and AJ Bell column names are community-verified only. Obtain real export files before coding preset detection. Build generic mapper first; add presets in follow-on task.

**Standard patterns (skip deep research):**
- Phase 3 (Creator Search): YouTube Data API v3 search.list fully documented. Pattern mirrors existing API route in codebase.
- Phase 4 (Mobile Layout): Pure Tailwind responsive prefix work. All patterns documented, codebase already uses Tailwind throughout.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | papaparse/react-dropzone are industry-standard. yahoo-finance2 unofficial but community-verified. TradingView widget approach is officially supported free tier. |
| Features | HIGH | Table stakes from industry norms. UK broker column names MEDIUM — need live file verification. |
| Architecture | HIGH | Integration points well-understood; codebase baseline documented. No new services. |
| Pitfalls | HIGH | All critical pitfalls specific, verified, preventable with documented configuration steps. |

**Overall confidence:** HIGH for approach and architecture. MEDIUM for broker CSV column presets and yahoo-finance2 API stability.

### Gaps to Address

- HL/AJ Bell CSV columns: Community-verified, not official. Export real files before coding presets in Phase 1. Fallback: build generic column mapper first.
- Freetrade CSV: Exports transaction events, not holdings snapshot. Defer to v1.2.
- yahoo-finance2 stability: Unofficial. If broken at implementation: Twelve Data free → Alpha Vantage free. Document fallback chain in Phase 2 plan.
- TradingView widget SSR issue (#42): Mitigation documented (dynamic + ssr:false). Fallback: useEffect script-inject using TradingView embed snippet directly.

---

## Sources

### Primary (HIGH confidence)
- PapaParse docs — papaparse.com — CSV parsing, BOM option, header mode
- YouTube Data API v3 — developers.google.com/youtube/v3 — search.list (100 units), channels.list (1 unit)
- Tailwind responsive design — tailwindcss.com/docs/responsive-design — mobile-first breakpoints
- TradingView Free Widgets — tradingview.com/widget-docs — confirmed free, no API key, iframe-only
- Next.js server actions — nextjs.org — body size limit, bodySizeLimit config

### Secondary (MEDIUM confidence)
- react-ts-tradingview-widgets v1.2.8 on npm — React wrapper, Next.js issue #42 known
- yahoo-finance2 v3.14.0 on npm — LSE .L suffix, unofficial
- HL portfolio CSV columns — firevlondon.com community post — column names need live verification
- Alpha Vantage docs — alphavantage.co — 25 req/day free, .LON suffix format
- Twelve Data — twelvedata.com/exchanges/XLON — 800 req/day free, XLON exchange

### Tertiary (LOW confidence)
- AJ Bell CSV format — inferred from Portfolio Performance/Sharesight community support — column names unverified from official docs
- Freetrade CSV — help.freetrade.io — transaction events confirmed; holdings snapshot existence uncertain

---

*Research completed: 2026-05-13*
*Ready for roadmap: yes*