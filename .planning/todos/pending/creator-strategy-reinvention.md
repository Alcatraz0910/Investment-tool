---
type: redesign
captured: 2026-05-18
source: user-session
priority: high
affects: phases 3, 4, 5 (transcript pipeline, strategy extraction, plan generator)
---

# Creator Strategy Reinvention

## What the User Wants

### 1. Richer creator intelligence (not % allocation)
Current model: Claude extracts category % targets (Stocks 43%, Index Funds 50%, Cash 7%)
Desired model: Claude extracts *specific* content from transcripts:
- Favoured stocks (named tickers the creator discusses positively)
- Their methodology for finding stocks (e.g. P/E ratio, dividend yield, moat analysis)
- Best index funds they recommend (specific funds, not just "index funds" category)

### 2. Per-ticker budget control
User wants to decide how much £ goes into each specific stock/fund themselves.
No category % blending. Instead: a list of creator-endorsed tickers the user can allocate budget to directly.

### 3. Transcript recency filter
Only scrape/analyse the last 4 months of transcripts.
Older transcripts are not relevant to current recommendations.

### 4. Smarter AI analysis
AI should analyse ALL transcripts holistically and produce a structured summary per creator:
- Top mentioned stocks (with frequency/conviction signal)
- Preferred index funds
- Investment methodology/philosophy
- Recent stance changes
This summary feeds the buy list directly.

## Ideas to Explore for Creators Feature

- **Conviction scoring** — how often a ticker is mentioned = proxy for conviction
- **Multi-creator overlap** — highlight stocks endorsed by 2+ creators you trust
- **Recency weighting** — more recent mentions weighted higher in summaries
- **Creator track record** — optional: flag when a previously mentioned stock went up/down
- **Methodology tagging** — tag each creator's style (dividend investing, growth, passive, etc.)
- **New vs recurring** — distinguish newly mentioned stocks from long-term holds
- **Creator comparison** — side-by-side view of what different creators currently favour
- **Sentiment trend** — is a creator becoming more/less bullish on a sector over time?

## Impact on Existing Phases
- Phase 3 (Transcript Pipeline): add 4-month recency filter
- Phase 4 (Strategy Extraction): completely rethink extraction schema — move from % allocation to ticker lists + methodology
- Phase 5 (Plan Generator): rethink blending — from weighted % to curated ticker shortlist with user-set £ amounts
- Phase 9 (Creator Search): still needed but now feeds the new model
