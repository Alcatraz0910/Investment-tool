# Pulse — Roadmap

## Milestones

- ✅ **v1.0 MVP** — Phases 1–6 (shipped 2026-05-07) — [archive](.planning/milestones/v1.0-ROADMAP.md)
- 🔲 **v1.1 Portfolio Intelligence** — Phases 7–10 (in progress)

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
- [ ] **Phase 9: Creator Search** — User can discover and track creators by name without knowing the channel URL
- [ ] **Phase 10: Mobile Layout** — All dashboard tabs are fully usable on a 375px phone screen with touch-friendly targets

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
