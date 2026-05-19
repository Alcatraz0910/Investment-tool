# Pulse — Roadmap

## Milestones

- ✅ **v1.0 MVP** — Phases 1–6 (shipped 2026-05-07) — [archive](.planning/milestones/v1.0-ROADMAP.md)
- 🔄 **v1.1 Portfolio Intelligence** — Phases 7–10 (Phases 7–8 complete; 9–10 deferred into v1.2)
- 🔲 **v1.2 Creator Intelligence** — Phases 11–15 (next)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–6) — SHIPPED 2026-05-07</summary>

- [x] Phase 1: Foundation (4/4 plans) — completed 2026-05-06
- [x] Phase 2: Portfolio & Creator Management (4/4 plans) — completed 2026-05-07
- [x] Phase 3: Transcript Pipeline (7/7 plans) — completed 2026-05-07
- [x] Phase 4: Strategy Extraction & Blending (5/5 plans) — completed 2026-05-07
- [x] Phase 5: Plan Generator (4/4 plans) — completed 2026-05-07
- [x] Phase 6: Dashboard UI (6/6 plans) — completed 2026-05-07

Full details: [.planning/milestones/v1.0-ROADMAP.md](.planning/milestones/v1.0-ROADMAP.md)

</details>

### v1.1 Portfolio Intelligence

- [x] **Phase 7: CSV Portfolio Import** — User can bulk-import holdings from a broker CSV file (HL/AJ Bell presets + generic mapper) — completed 2026-05-17
- [x] **Phase 8: Live Price Data** — Portfolio shows current market prices and total value per holding; Buy List enriched with current price per ticker — completed 2026-05-18
- [ ] **Phase 9: Creator Search** — deferred; absorbed into v1.2 Phase 11 (creator discovery is part of Creator Intelligence)
- [ ] **Phase 10: Mobile Layout** — deferred; absorbed into v1.2 Phase 15 (Visual Redesign covers responsive polish)

## Phase Details

### Phase 7: CSV Portfolio Import
**Goal**: Users can populate or update their portfolio holdings by uploading a broker CSV, eliminating manual row-by-row entry
**Depends on**: Nothing (self-contained; no new external services)
**Requirements**: CSV-01, CSV-02, CSV-03, CSV-04, CSV-05, CSV-06
**Success Criteria** (what must be TRUE):
  1. User can drag a CSV file onto the Portfolio page (or use file picker) and see a column-mapping UI appear
  2. When uploading an HL or AJ Bell export, column headers are pre-filled without manual mapping
  3. User can review a preview table of parsed rows before any data is written to the database
  4. User can choose to merge new rows into existing holdings or replace all holdings, then confirm import
  5. GBX-denominated prices (HL pence exports) are silently converted to £ so portfolio values are correct after import
**Plans**: 4 plans
- [x] 07-01-PLAN.md — CSV Parser Utilities (PapaParse, broker detection, GBX conversion, row classification)
- [x] 07-02-PLAN.md — importHoldings server action (merge + replace modes)
- [x] 07-03-PLAN.md — ImportCSVModal multi-step UI (Upload → Map → Preview + Confirm)
- [x] 07-04-PLAN.md — PortfolioTab integration (Import CSV button + modal mount + manual smoke test)
**UI hint**: yes

### Phase 8: Live Price Data
**Goal**: Users can see current market prices and portfolio value without leaving Pulse, and the Buy List shows what each recommended ticker costs today
**Depends on**: Phase 7 (real holdings data required for meaningful price display testing)
**Requirements**: PRICE-01, PRICE-02, PRICE-03, PRICE-04
**Success Criteria** (what must be TRUE):
  1. Portfolio page shows a current price, total value, and an as-of timestamp for each holding after prices are refreshed
  2. Buy List shows current price per ticker alongside the £ target amount produced by generatePlan
  3. A Refresh Prices button triggers a server-side batch fetch; the UI updates without a full page reload
  4. An optional TradingView chart widget is visible per holding as a decorative overlay (display-only; does not alter plan logic)
**Plans**: 3 plans
- [x] 08-01-PLAN.md — Foundation (install yahoo-finance2, SQL migration, Holding types, refreshHoldingPrices + fetchTickerPrices server actions, page.tsx extension, price-actions tests)

Wave 2 *(blocked on Wave 1 completion)*
- [x] 08-02-PLAN.md — Portfolio Tab UI (TradingViewWidget, PortfolioTab price columns + chart toggle, tests)
- [x] 08-03-PLAN.md — Buy List Tab UI (BuyListTable prices prop + Price column, ContributionCalculator Refresh button, tests)

**Cross-cutting constraints:**
- .L suffix applied only at yahooFinance.quote() call boundary — never stored in DB
- GBp currency tickers divided by 100 via Decimal in both server actions
- Buy List prices are React state only — fetchTickerPrices never writes to DB
**UI hint**: yes

### Phase 9: Creator Search
**Goal**: Users can discover and track creators by searching YouTube by name, without needing to know or paste a channel URL
**Depends on**: Nothing (independent of Phases 7–8; YouTube API already provisioned)
**Requirements**: SRCH-01, SRCH-02, SRCH-03
**Success Criteria** (what must be TRUE):
  1. User can type a creator name or keyword into a search bar on the Creators page and see a list of matching YouTube channels
  2. Each search result shows a channel thumbnail, name, and subscriber count before the user decides to track
  3. One-click tracking adds the channel to the user's tracked list using the existing addCustomCreator flow
  4. The existing manual channel URL entry field remains available as a fallback alongside the search bar
**Plans**: TBD
**UI hint**: yes

### Phase 10: Mobile Layout
**Goal**: All dashboard tabs are fully usable on a 375px phone, with touch-friendly controls and no horizontal overflow
**Depends on**: Phases 7, 8, 9 (CSS pass must cover all new components added in prior phases)
**Requirements**: MOB-01, MOB-02, MOB-03
**Success Criteria** (what must be TRUE):
  1. All five dashboard tabs (Action Plan, Roadmap, Calculator, Portfolio, Creators) render without horizontal scroll at 375px viewport width
  2. Trust weight sliders have tap targets of at least 44px so they are usable with a finger on iOS and Android
  3. Holdings and Buy List tables collapse to a card layout on small screens so all data is readable without horizontal scrolling
**Plans**: TBD
**UI hint**: yes

### v1.2 Creator Intelligence

- [ ] **Phase 11: Creator Intelligence Extraction** — AI produces a two-layer summary per creator (4-month stable summary + 30-day latest signals); extracts favoured stocks, methodology, industry/sector focus, and preferred index funds; scrape window limited to last 4 months
- [ ] **Phase 12: Watch List + Per-Creator Budget** — Buy list replaced with a live watch list (real-time prices, news flags per item); user sets £X/month per creator; app translates into actual share quantities to buy based on current creator picks
- [ ] **Phase 13: Market News Integration** — Finnhub/Alpha Vantage ticker news + BBC Business/Reuters UK/BoE RSS feeds; AI cross-references against watch list tickers and creator-backed sectors; generates a "this month's context" summary (3-4 sentences) combining creator signals and macro news
- [ ] **Phase 14: Creator Signals + Housekeeping** — Consensus signal (2+ creators backing same ticker), sentiment trend (bullish/cautious shift over 4 months), contradiction detection (recent vs older stance), cadence weighting (less-active creators carry less weight); ISA tab removed
- [ ] **Phase 15: Visual Redesign** — Futuristic, clean UI overhaul across all dashboard tabs; cohesive design system (typography, colour palette, spacing, motion); glassmorphism, dark-first aesthetic; polished component library replacing placeholder styling

### Phase 11: Creator Intelligence Extraction
**Goal**: Creator refreshes produce a two-layer intelligence profile (stable 4-month summary + latest 30-day signals); users can discover creators by searching YouTube by name instead of pasting a URL
**Depends on**: Nothing new (Anthropic SDK, Pinecone, YouTube API already provisioned)
**Requirements**: CI-01, CI-02, CI-03, CI-04, SRCH-01, SRCH-02, SRCH-03
**Note on CI-04**: Data layer (profile_stable, profile_latest JSONB columns) delivered in Phase 11 Wave 0 SQL migration. UI rendering of both layers is Phase 12 scope.
**Success Criteria** (what must be TRUE):
  1. Creator refresh stores profile_stable and profile_latest JSONB rows in creator_strategies (profile_latest = null if creator has no 30-day posts)
  2. Transcript scraping fetches videos from the last 4 months only (not 12)
  3. extract_creator_profile tool captures: favoured stocks (nullable tickers), methodology, sector focus, preferred index funds
  4. User can search YouTube by channel name and see up to 5 results with thumbnail, name, subscriber count
  5. Clicking Track on a search result adds the creator and shows Tracking state
  6. Manual URL entry still works as a collapsible fallback ("Add by URL instead")
**Plans**: 4 plans
- [x] 11-01-PLAN.md — Wave 0: SQL migration (user runs in Supabase SQL Editor) + vitest install + test stubs
- [x] 11-02-PLAN.md — Wave 1: YouTube client (listVideosLast4Months, searchChannels, formatSubscriberCount); transcript-pipeline.ts import update
- [x] 11-03-PLAN.md — Wave 1: extractor.ts rewrite (PROFILE_TOOL_DEF, SYSTEM_PROMPT, two-call pattern, Pinecone date filters)
- [ ] 11-04-PLAN.md — Wave 2: searchCreators + trackSearchedCreator server actions; creators-tab.tsx search UI
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|---------------|--------|-----------|
| 1. Foundation | v1.0 | 4/4 | Complete | 2026-05-06 |
| 2. Portfolio & Creator Management | v1.0 | 4/4 | Complete | 2026-05-07 |
| 3. Transcript Pipeline | v1.0 | 7/7 | Complete | 2026-05-07 |
| 4. Strategy Extraction & Blending | v1.0 | 5/5 | Complete | 2026-05-07 |
| 5. Plan Generator | v1.0 | 4/4 | Complete | 2026-05-07 |
| 6. Dashboard UI | v1.0 | 6/6 | Complete | 2026-05-07 |
| 7. CSV Portfolio Import | v1.1 | 4/4 | Human verification pending | — |
| 8. Live Price Data | v1.1 | 3/3 | Human verification pending | — |
| 9. Creator Search | v1.1 | 0/? | Not started | — |
| 10. Mobile Layout | v1.1 | 0/? | Not started | — |
| 11. Creator Intelligence Extraction | v1.2 | 3/4 | In progress | — |
