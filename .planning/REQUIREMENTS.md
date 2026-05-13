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

## v1.2 Requirements (Deferred)

### Portfolio Sync

- **SYNC-01**: User can connect a UK broker account via TrueLayer Open Banking to sync holdings automatically
- **SYNC-02**: User can import Freetrade CSV (transaction history, not snapshot — requires aggregation logic)

### Automation

- **AUTO-01**: Transcript polling runs nightly via cron without user action
- **AUTO-02**: User receives notification when a tracked creator's strategy shifts >15pp

### Portfolio Analytics

- **ANLT-01**: User can view gain/loss per holding vs average cost (P&L tracking)
- **ANLT-02**: Holdings and Buy List display a TradingView price chart per ticker

## Out of Scope

| Feature | Reason |
|---------|--------|
| TrueLayer Open Banking | OAuth complexity; deferred to v1.2 |
| Server-side CSV parsing | Client-side (PapaParse) avoids upload size limits and is simpler |
| XLS/Excel format | CSV is universal; Excel format is a rabbit hole |
| Price streaming / WebSocket | Daily close sufficient for a monthly planning tool |
| FCA-regulated features | Information-only framing maintained throughout; no personalised advice |
| Trade execution | Pulse tells you what to buy; it does not place trades |
| Multi-user SaaS / billing | Personal-first; productize after validation |

## Traceability

Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CSV-01 | — | Pending |
| CSV-02 | — | Pending |
| CSV-03 | — | Pending |
| CSV-04 | — | Pending |
| CSV-05 | — | Pending |
| CSV-06 | — | Pending |
| PRICE-01 | — | Pending |
| PRICE-02 | — | Pending |
| PRICE-03 | — | Pending |
| PRICE-04 | — | Pending |
| SRCH-01 | — | Pending |
| SRCH-02 | — | Pending |
| SRCH-03 | — | Pending |
| MOB-01 | — | Pending |
| MOB-02 | — | Pending |
| MOB-03 | — | Pending |

**Coverage:**
- v1.1 requirements: 16 total
- Mapped to phases: 0 (roadmap pending)
- Unmapped: 16 ⚠️

---
*Requirements defined: 2026-05-13*
*Last updated: 2026-05-13 after initial v1.1 definition*
