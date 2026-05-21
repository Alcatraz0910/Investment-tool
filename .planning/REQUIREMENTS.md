# Requirements: Pulse

**Defined:** 2026-05-13
**Core Value:** Given a monthly budget and a creator's strategy, tell the user exactly what to buy this month to move their portfolio toward that strategy — updated automatically whenever the creator's stance changes.

## v1.1 Requirements

Requirements for the Portfolio Intelligence milestone. Each maps to roadmap phases.

### CSV Portfolio Import

- [ ] **CSV-01**: User can upload a CSV file via drag-and-drop or file picker on the Portfolio page
- [ ] **CSV-02**: User can map CSV columns to Pulse fields (ticker, quantity, average cost) via a column mapping UI
- [ ] **CSV-03**: Pulse auto-detects HL and AJ Bell column layouts before falling back to manual mapping
- [ ] **CSV-04**: User sees a preview of parsed holdings rows before confirming import
- [ ] **CSV-05**: User can choose to merge uploaded holdings with existing or replace all existing holdings
- [ ] **CSV-06**: GBX (pence) prices in HL exports are auto-converted to £ on import using decimal.js

### Live Price Data

- [ ] **PRICE-01**: Portfolio page displays current price and total value per holding (server-side via yahoo-finance2, LSE .L suffix)
- [ ] **PRICE-02**: Buy List displays current price per ticker alongside £ target amount
- [ ] **PRICE-03**: User can manually trigger a price refresh via a Refresh button
- [ ] **PRICE-04**: TradingView chart widgets are embedded on portfolio holdings (display-only; do not feed plan logic)

### Creator Search

- [ ] **SRCH-01**: User can search YouTube channels by name or keyword from the Creators page
- [ ] **SRCH-02**: Search results display channel name, thumbnail, and subscriber count before tracking
- [ ] **SRCH-03**: Manual channel URL entry is preserved as a fallback alongside search

### Mobile Layout

- [ ] **MOB-01**: All dashboard tabs (Action Plan, Roadmap, Calculator, Portfolio, Creators) are usable on mobile screen sizes
- [ ] **MOB-02**: Trust weight sliders have touch-friendly targets on mobile
- [ ] **MOB-03**: Holdings and Buy List tables collapse to card view on small screens

## v1.2 Requirements — Creator Intelligence

### Creator Intelligence Extraction (Phase 11)

- **CI-01**: Transcript scraping is limited to the last 4 months per creator; older transcripts are not fetched or indexed
- **CI-02**: AI produces two extraction layers per creator: a stable summary (full 4-month window) and latest signals (last 30 days)
- **CI-03**: Extraction captures: favoured stocks (tickers), investment methodology, industry/sector focus, preferred index funds
- **CI-04**: Creator profile displays both layers distinctly — "established view" vs "this month"

### Watch List + Per-Creator Budget (Phase 12)

- **WL-01**: Buy list is replaced with a watch list populated from creator picks (both extraction layers)
- **WL-02**: Watch list items display live prices (via existing yahoo-finance2 integration)
- **WL-03**: User sets a monthly £ amount per creator (not a category % split)
- **WL-04**: App calculates actual share quantities to buy per creator based on their current picks and today's prices
- **WL-05**: ISA tab is removed from the dashboard entirely

### Market News Integration (Phase 13)

- **NEWS-01**: Finnhub or Alpha Vantage news API provides ticker-specific news for watch list items
- **NEWS-02**: RSS feeds (BBC Business, Reuters UK, Bank of England, ONS) provide UK macro context
- **NEWS-03**: AI cross-references news against watch list tickers and creator-backed sectors
- **NEWS-04**: Each watch list item shows a news flag with count of relevant stories
- **NEWS-05**: Creator card shows macro conditions for sectors that creator is backing
- **NEWS-06**: A "this month's context" summary (3-4 sentences, AI-generated) combines creator signals + latest signals + macro news; refreshes daily; regenerates on demand
- **NEWS-07**: News refresh runs daily; macro summary regenerates weekly or on-demand

### Creator Signals (Phase 14)

- **SIG-01**: Consensus signal surfaces when 2+ tracked creators back the same ticker
- **SIG-02**: Sentiment trend tracks whether a creator is becoming more bullish or cautious over the 4-month window
- **SIG-03**: Contradiction detection flags when a creator's recent videos contradict their established stance
- **SIG-04**: Creator cadence is tracked; creators who have not posted recently carry reduced weight in buy recommendations

### Visual Redesign (Phase 15)

- **VIS-01**: All dashboard tabs receive a cohesive visual overhaul — futuristic, clean, dark-first aesthetic
- **VIS-02**: A consistent design system is defined and applied: typography scale, colour palette, spacing tokens, motion principles
- **VIS-03**: Glassmorphism and subtle depth effects applied consistently across cards, modals, and panels
- **VIS-04**: All placeholder/utility styling replaced with polished components
- **VIS-05**: Animations and transitions are smooth and purposeful (Framer Motion); no jarring state changes

## v1.2 Requirements (Deferred — Pre-existing)

### Portfolio Sync

- **SYNC-01**: User can connect a UK broker account via TrueLayer Open Banking to sync holdings automatically
- **SYNC-02**: User can import Freetrade CSV (transaction history, not snapshot — requires aggregation logic)

### Automation

- **AUTO-01**: Transcript polling runs nightly via cron without user action
- **AUTO-02**: User receives notification when a tracked creator's strategy shifts >15pp

### Portfolio Analytics

- **ANLT-01**: User can view gain/loss per holding vs average cost (P&L tracking)
- **ANLT-02**: Holdings and Buy List display a TradingView price chart per ticker

## v1.3 Requirements — Household Budget Tracker

### Household Setup (HSLD)

- [ ] **HSLD-01**: User can add household members with a display name (e.g. "Me", "Partner")
- [ ] **HSLD-02**: User can enter a monthly income amount per household member
- [ ] **HSLD-03**: User can edit or remove household members and their income entries

### Transaction Import (TIMP)

- [ ] **TIMP-01**: User can import a bank transaction CSV per household member via file picker or drag-and-drop
- [ ] **TIMP-02**: Column mapping UI lets user identify date, description, and amount columns for any CSV format
- [ ] **TIMP-03**: Common UK bank formats (Monzo, Barclays, Lloyds, NatWest) are auto-detected where possible
- [ ] **TIMP-04**: User can view all imported transactions in a searchable, filterable list
- [ ] **TIMP-05**: User can delete individual transactions or clear a month's imports

### Categorisation (TCAT)

- [ ] **TCAT-01**: AI suggests a spending category for each transaction immediately after import
- [ ] **TCAT-02**: Categories include: Bills, Food & Groceries, Entertainment, Transport, Subscriptions, Shopping, Healthcare, Other
- [ ] **TCAT-03**: User can confirm AI category or override with their own selection per transaction
- [ ] **TCAT-04**: User category overrides are persisted

### AI Insights (AINS)

- [ ] **AINS-01**: AI identifies potential duplicate or overlapping subscriptions across transactions
- [ ] **AINS-02**: AI generates per-category cut-back observations (observational language only — no personalised advice)
- [ ] **AINS-03**: Insights panel highlights the top spending areas relative to income
- [ ] **AINS-04**: AI output never uses "advise", "recommend", or "suggest" (same guardrail as creator tool)

### Budget Summary (BSUM)

- [ ] **BSUM-01**: Budget page shows total household income for the selected month
- [ ] **BSUM-02**: Budget page shows total outgoings broken down by category with £ amounts and % of income
- [ ] **BSUM-03**: Monthly surplus (income − outgoings) is displayed prominently
- [ ] **BSUM-04**: User can navigate between months to view historical budget summaries

## Out of Scope

| Feature | Reason |
|---------|--------|
| TrueLayer Open Banking | OAuth complexity; deferred indefinitely — manual CSV covers v1.3 needs |
| Open Banking / bank feeds | Auto-import adds regulatory and technical complexity out of proportion to benefit |
| Server-side CSV parsing | Client-side (PapaParse) avoids upload size limits and is simpler |
| XLS/Excel format | CSV is universal; Excel format is a rabbit hole |
| Price streaming / WebSocket | Daily close sufficient for a monthly planning tool |
| FCA-regulated features | Information-only framing maintained throughout; no personalised advice |
| Trade execution | Pulse tells you what to buy; it does not place trades |
| Multi-user SaaS / billing | Personal-first; productize after validation |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CSV-01 | Phase 7 | Pending |
| CSV-02 | Phase 7 | Pending |
| CSV-03 | Phase 7 | Pending |
| CSV-04 | Phase 7 | Pending |
| CSV-05 | Phase 7 | Pending |
| CSV-06 | Phase 7 | Pending |
| PRICE-01 | Phase 8 | Pending |
| PRICE-02 | Phase 8 | Pending |
| PRICE-03 | Phase 8 | Pending |
| PRICE-04 | Phase 8 | Pending |
| SRCH-01 | Phase 9 | Pending |
| SRCH-02 | Phase 9 | Pending |
| SRCH-03 | Phase 9 | Pending |
| MOB-01 | Phase 10 | Pending |
| MOB-02 | Phase 10 | Pending |
| MOB-03 | Phase 10 | Pending |

| HSLD-01 | Phase 16 | Pending |
| HSLD-02 | Phase 16 | Pending |
| HSLD-03 | Phase 16 | Pending |
| TIMP-01 | Phase 17 | Pending |
| TIMP-02 | Phase 17 | Pending |
| TIMP-03 | Phase 17 | Pending |
| TIMP-04 | Phase 17 | Pending |
| TIMP-05 | Phase 17 | Pending |
| TCAT-01 | Phase 18 | Pending |
| TCAT-02 | Phase 18 | Pending |
| TCAT-03 | Phase 18 | Pending |
| TCAT-04 | Phase 18 | Pending |
| AINS-01 | Phase 19 | Pending |
| AINS-02 | Phase 19 | Pending |
| AINS-03 | Phase 19 | Pending |
| AINS-04 | Phase 19 | Pending |
| BSUM-01 | Phase 19 | Pending |
| BSUM-02 | Phase 19 | Pending |
| BSUM-03 | Phase 19 | Pending |
| BSUM-04 | Phase 19 | Pending |

**Coverage:**
- v1.1 requirements: 16 total
- v1.2 requirements: 17 total
- v1.3 requirements: 20 total
- All mapped to phases ✓

---
*Requirements defined: 2026-05-13*
*Last updated: 2026-05-21 — v1.3 Household Budget Tracker requirements added*
