# Requirements — Pulse

## v1 Requirements

### Authentication

- [ ] **AUTH-01**: User can sign up and log in with email/password (Supabase Auth)
- [ ] **AUTH-02**: User session persists across browser sessions

### Creator Management

- [ ] **CREATOR-01**: Admin can add or remove creators from the curated list (channel URL + display name stored in Supabase)
- [ ] **CREATOR-02**: User can view the curated creator list and add any creator to their personal tracking list
- [ ] **CREATOR-03**: User can add a custom YouTube channel URL to their personal tracking list
- [ ] **CREATOR-04**: User can remove any creator from their personal tracking list (no cap on number tracked)

### Transcript Pipeline

- [ ] **TRANS-01**: For each tracked creator, fetch transcripts for all videos published in the last 12 months (YouTube Data API v3 + `youtube-transcript` npm package as fallback to preserve quota)
- [ ] **TRANS-02**: Transcripts stored in Supabase with creator ID, video ID, title, and published date
- [ ] **TRANS-03**: Transcript chunks embedded (OpenAI `text-embedding-3-small` or Cohere) and stored in Pinecone with creator/video metadata keys
- [ ] **TRANS-04**: Manual "Refresh" button per creator triggers re-fetch and re-embedding of new videos
- [ ] **TRANS-05**: Last-refreshed timestamp displayed per creator on the dashboard

### Strategy Extraction

- [ ] **STRAT-01**: Claude extracts implied asset allocation from a creator's transcripts via RAG (Pinecone retrieval of relevant chunks → Claude synthesis) producing a structured strategy object (e.g. `{ "Tech": 60, "Dividends": 20, "Cash": 20 }`)
- [ ] **STRAT-02**: Each extraction is versioned — every refresh creates a new snapshot; full history is preserved
- [ ] **STRAT-03**: Strategy output includes a confidence score (0–100%) and cites the source video(s) it was derived from
- [ ] **STRAT-04**: When Claude detects a contradiction between a creator's current and past stance, it is flagged on the strategy card rather than silently merged

### Creator Trust & Blending

- [ ] **BLEND-01**: User can set a per-category trust weight (0–100%) for each tracked creator via a Confidence Slider (e.g. "I trust Creator A 80% for Growth Stocks, 40% for Dividends")
- [ ] **BLEND-02**: PlanGenerator blends strategies from all tracked creators using their category weights to produce a single unified target allocation before calculating the Buy List (weighted average: `Σ(strategy_i × weight_i) / Σ(weight_i)`)
- [ ] **BLEND-03**: Dashboard shows a Blend Summary card: how much each creator influenced this month's unified allocation (e.g. "Creator A: 60% influence, Creator B: 40% influence")

### Portfolio Entry

- [ ] **PORT-01**: User can manually add holdings — ticker symbol, quantity, current value in £
- [ ] **PORT-02**: User can edit and delete existing holdings
- [ ] **PORT-03**: User sets a monthly contribution amount in £ (used as the budget for the Buy List)

### ISA Tracking

- [ ] **ISA-01**: ISA allowance tracker shows remaining annual allowance: £20,000 minus total contributions logged in the current UK tax year (6 April – 5 April)
- [ ] **ISA-02**: Plan Generator caps the recommended Buy List total to the remaining ISA allowance; alerts user if budget exceeds remaining allowance
- [ ] **ISA-03**: User can log ISA contributions manually (date + amount)

### Plan Generator

- [ ] **PLAN-01**: `PlanGenerator.ts` takes (current portfolio + monthly budget + blended creator strategy) and outputs a Next-Month Buy List: each recommended purchase as `{ ticker, category, amount_gbp, rationale }`
- [ ] **PLAN-02**: Buy List displays the current allocation gap per asset class and how this month's contribution closes it toward the target
- [ ] **PLAN-03**: After a creator refresh updates the strategy, the next generated Buy List reflects the new blended allocation
- [ ] **PLAN-04**: All plan output is labelled "Creator-derived information — not financial advice" with a disclaimer; no output uses the word "advice" or "recommend" in a regulatory sense

### Dashboard & UI

- [ ] **UI-01**: Glassmorphism dark mode aesthetic — Space Grey (#1C1C1E base) and Electric Indigo (#6366F1 accent) palette; Framer Motion for transitions
- [ ] **UI-02**: Action Plan panel — prominent display of this month's Buy List based on the latest blended creator strategy
- [ ] **UI-03**: Roadmap View — visual timeline comparing "Creator's Vision" (target allocation trajectory) vs "Your Current Path" (current portfolio trajectory at current contribution rate)
- [ ] **UI-04**: Contribution Calculator — horizontal slider (£200 → £1,000) that instantly recalculates and renders the updated Buy List without a page reload
- [ ] **UI-05**: Creator strategy card per tracked creator — shows current extracted allocation, confidence score, last-refresh date, and any active contradiction flags

---

## v2 Requirements (Deferred)

- TrueLayer UK Open Banking integration (live portfolio sync for Freetrade, AJ Bell, Hargreaves Lansdown)
- CSV statement upload as portfolio import fallback
- Scheduled nightly video polling (cron job) to auto-refresh creator transcripts
- Multi-user SaaS: billing, subscriptions, onboarding flow
- Tax year reporting / capital gains summary
- Price alerts and real-time market data feeds

---

## Out of Scope

- **Trade execution** — Pulse tells you what to buy; it does not place trades. No brokerage API integration for order submission.
- **Plaid integration** — Not suitable for UK market; replaced by TrueLayer in v2.
- **FCA-authorised advice** — All output is creator-derived information only. Full regulatory compliance is explicitly out of scope.
- **Social / sharing features** — No public plan sharing, copy-trader mechanics, or social feeds.
- **Real-time market data** — No live price feeds, no WebSocket quotes. Portfolio values are manually entered.
- **Automated video polling** — v1 is manual-refresh only; no background jobs or webhooks.

---

## Traceability

| Requirement | Phase |
|-------------|-------|
| AUTH-01, AUTH-02 | Phase 1: Foundation |
| CREATOR-01 – CREATOR-04 | Phase 2: Creator Management |
| TRANS-01 – TRANS-05 | Phase 3: Transcript Pipeline |
| STRAT-01 – STRAT-04 | Phase 4: Strategy Extraction |
| BLEND-01 – BLEND-03 | Phase 4: Strategy Extraction |
| PORT-01 – PORT-03 | Phase 2: Creator Management |
| ISA-01 – ISA-03 | Phase 5: Plan Generator |
| PLAN-01 – PLAN-04 | Phase 5: Plan Generator |
| UI-01 – UI-05 | Phase 6: Dashboard UI |

*(Traceability updated after roadmap is created)*
