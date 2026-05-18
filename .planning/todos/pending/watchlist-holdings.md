---
type: feature
captured: 2026-05-18
source: user-session
---

# Watchlist Holdings

Separate portfolio holdings into "Holdings" (owned) and "Watchlist" (tracking only).

## Behaviour
- Watchlist holdings: excluded from portfolio value and allocation gap calculations
- Watchlist holdings: CAN be starred (★) as fill tickers — appear in buy list suggestions
- Portfolio tab: two sections — Holdings / Watchlist

## Implementation scope
- DB: `is_watchlist boolean default false` on holdings table (migration required)
- UI: PortfolioTab splits into two labelled sections
- Plan generator: skip watchlist `currentValue` in allocation maths, keep fill ticker logic
- HoldingModal: watchlist toggle when adding/editing
