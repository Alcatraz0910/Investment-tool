# Pulse — Roadmap

**6 phases** | **29 requirements mapped** | All v1 requirements covered ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|-----------------|
| 1 | Foundation | Working Next.js 15 app with auth, DB schema, and type system | AUTH-01, AUTH-02 | 3 |
| 2 | Portfolio & Creators | User can manage their portfolio and creator list | CREATOR-01–04, PORT-01–03, ISA-01, ISA-03 | 4 |
| 3 | Transcript Pipeline | App can fetch, store, and embed creator transcripts | TRANS-01–05 | 4 |
| 4 | Strategy Extraction | App extracts and blends creator strategies | STRAT-01–04, BLEND-01–03 | 5 |
| 5 | Plan Generator | App produces an actionable, ISA-aware Buy List | PLAN-01–04, ISA-02 | 4 |
| 6 | Dashboard UI | Premium glassmorphism interface surfaces the full plan | UI-01–05 | 5 |

---

## Phase 1: Foundation

**Goal:** Working Next.js 15 App Router project with Supabase auth, a complete DB schema, and shared TypeScript types — everything downstream phases build on.

**Requirements:** AUTH-01, AUTH-02

**Plans:**
1. Scaffold Next.js 15 App Router project with Tailwind CSS, Framer Motion, and Supabase client
2. Configure Supabase Auth (email/password, session persistence, middleware route protection)
3. Define full DB schema in Supabase: `users`, `creators`, `user_creators`, `holdings`, `isa_contributions`, `transcripts`, `creator_strategies`, `buy_lists`
4. Write shared TypeScript types (`types/index.ts`) covering all domain models

**Success Criteria:**
1. User can sign up, log in, and stay logged in across page reloads
2. Unauthenticated routes redirect to login; authenticated routes are accessible
3. DB schema is deployed to Supabase with correct foreign keys and RLS policies enabled

---

## Phase 2: Portfolio & Creator Management

**Goal:** User can build their portfolio (manual holdings entry), manage their creator list (curated + custom), and log ISA contributions — the data foundation for the plan.

**Requirements:** CREATOR-01, CREATOR-02, CREATOR-03, CREATOR-04, PORT-01, PORT-02, PORT-03, ISA-01, ISA-03

**Plans:**
1. Admin creator management: seed curated creator list in Supabase; admin API route to add/remove creators
2. User creator list: UI to browse curated list, add/remove creators to personal list, add custom YouTube channel URLs
3. Portfolio entry UI: add, edit, delete holdings (ticker, quantity, current value £); set monthly contribution amount
4. ISA tracker: log contributions (date + amount); display remaining allowance for current UK tax year (6 Apr – 5 Apr)

**Success Criteria:**
1. Admin can add a YouTube channel to the curated list and it appears in the user-facing browse list
2. User can add a creator from the curated list and a custom URL to their personal list, then remove both
3. User can enter holdings and see total portfolio value; monthly contribution amount is saved
4. ISA tracker correctly shows £20,000 minus logged contributions; resets on 6 April

---

## Phase 3: Transcript Pipeline

**Goal:** For each tracked creator, fetch 12 months of video transcripts, store them in Supabase, and embed them into Pinecone — ready for strategy extraction.

**Requirements:** TRANS-01, TRANS-02, TRANS-03, TRANS-04, TRANS-05

**Plans:**
1. YouTube transcript fetcher: given a channel URL, retrieve all videos from last 12 months (YouTube Data API v3 for video list; `youtube-transcript` npm package for transcript text; API captions fallback)
2. Supabase transcript store: persist raw transcript text with creator ID, video ID, title, published date; deduplicate on re-fetch
3. Pinecone embedding pipeline: chunk transcripts (~500 tokens), embed with OpenAI `text-embedding-3-small`, upsert to Pinecone namespace keyed by creator ID
4. Manual Refresh UI: per-creator "Refresh" button triggers the full fetch → store → embed pipeline; updates last-refreshed timestamp

**Success Criteria:**
1. Clicking Refresh on a creator fetches at least the last 10 videos and stores transcripts in Supabase
2. Pinecone contains chunked embeddings for all stored transcripts, queryable by creator ID
3. Last-refreshed timestamp updates after each successful refresh
4. Re-running Refresh does not create duplicate transcript records (idempotent)

---

## Phase 4: Strategy Extraction & Blending

**Goal:** Claude extracts a versioned, confidence-scored asset allocation strategy from each creator's transcripts via RAG, and the app blends multiple creator strategies using user-set trust weights.

**Requirements:** STRAT-01, STRAT-02, STRAT-03, STRAT-04, BLEND-01, BLEND-02, BLEND-03

**Plans:**
1. RAG pipeline: given a creator ID, query Pinecone for most relevant transcript chunks → construct context → call Claude to extract structured strategy (`{ category: string, allocation_pct: number }[]`) with confidence score and source video citations
2. Strategy versioning: store each extraction as a snapshot in Supabase `creator_strategies` table; preserve all historical versions
3. Contradiction detection: compare new strategy against most recent prior version; flag significant allocation shifts (>15%) on the creator's strategy card
4. Creator trust weights UI: Confidence Slider per creator per category (0–100%); saved to Supabase `user_creators` table
5. Strategy blender: `StrategyBlender.ts` — takes all tracked creators + their weights → weighted average → unified target allocation; produces Blend Summary (per-creator influence %)

**Success Criteria:**
1. After a creator Refresh, a new strategy snapshot is generated with category allocations, confidence score, and ≥1 source video citation
2. Each strategy extraction creates a new versioned record; previous versions are accessible
3. A significant allocation shift between versions triggers a visible contradiction flag on the creator card
4. User can set a trust weight for a creator and it persists; setting weight to 0 excludes that creator from the blend
5. Blend Summary correctly reflects weighted influence of each creator in the unified allocation

---

## Phase 5: Plan Generator

**Goal:** `PlanGenerator.ts` takes the user's portfolio, monthly budget, and blended strategy to produce an actionable, ISA-capped Buy List; the Contribution Calculator updates it live.

**Requirements:** PLAN-01, PLAN-02, PLAN-03, PLAN-04, ISA-02

**Plans:**
1. `PlanGenerator.ts`: pure TypeScript function — inputs `(portfolio: Holding[], budget_gbp: number, strategy: BlendedStrategy, isa_remaining: number)` → outputs `BuyList: { ticker: string, category: string, amount_gbp: Decimal, gap_closed_pct: number, rationale: string }[]`; uses `decimal.js` for all £ arithmetic; caps total to `isa_remaining`
2. ISA allowance guard: if `budget > isa_remaining`, truncate Buy List to remaining allowance and surface a warning; do not silently exceed the limit
3. Buy List API route (`/api/plan/generate`): calls PlanGenerator with current user data; stores result in Supabase `buy_lists` table with timestamp
4. Contribution Calculator: client-side slider component (£200 → £1,000) that calls PlanGenerator with updated budget and re-renders the Buy List without a network round-trip (compute in browser using cached strategy + portfolio)

**Success Criteria:**
1. PlanGenerator produces a Buy List where the sum of all amounts equals `min(budget, isa_remaining)` to the penny (using decimal arithmetic)
2. When a creator strategy updates, the next generated plan reflects the new blended allocation
3. ISA warning is shown when budget exceeds remaining allowance; plan total does not exceed the allowance
4. Dragging the Contribution Calculator slider updates the Buy List in < 100ms (no API call)

---

## Phase 6: Dashboard UI

**Goal:** Premium glassmorphism dashboard surfaces the Action Plan, Roadmap View, creator strategy cards, Blend Summary, and Contribution Calculator in a cohesive dark-mode interface.

**Requirements:** UI-01, UI-02, UI-03, UI-04, UI-05

**Plans:**
1. Design system: Tailwind theme config — Space Grey (#1C1C1E base, #2C2C2E surface, #3A3A3C border) + Electric Indigo (#6366F1 primary, #818CF8 hover) palette; glassmorphism card component (`backdrop-blur`, `bg-white/5`, `border-white/10`); Framer Motion layout animation tokens
2. Action Plan panel: monthly Buy List UI with per-ticker cards (ticker, amount, category, allocation gap progress bar); disclaimer banner; "last updated" metadata
3. Roadmap View: timeline visualization — "Creator's Vision" trajectory (target allocation at current contribution rate) vs "Your Current Path" (current portfolio extrapolated forward); built with Recharts or SVG
4. Creator strategy cards + Blend Summary: per-creator card (allocation pie, confidence score, last-refresh date, contradiction flag if active); Confidence Slider per category; Blend Summary card showing creator influence breakdown
5. Contribution Calculator: full-width slider section with real-time Buy List preview below it; smooth Framer Motion transition on recalculation

**Success Criteria:**
1. Dashboard renders with glassmorphism cards on Space Grey background with Electric Indigo accents; Framer Motion transitions play on mount
2. Action Plan panel shows the current month's Buy List with disclaimer visible; clicking a ticker shows its rationale
3. Roadmap View renders two distinct trajectory lines; a user with 0% allocation in Tech and a 60% Tech strategy shows a divergence
4. Each creator card shows its strategy, confidence score, last-refresh date; Confidence Sliders save on change and trigger plan recalculation
5. Contribution Calculator slider drag updates the Buy List preview in real time with no visible lag

---

## Dependency Map

```
Phase 1 (Foundation)
    └── Phase 2 (Portfolio & Creators)
            ├── Phase 3 (Transcript Pipeline)
            │       └── Phase 4 (Strategy Extraction)
            │               └── Phase 5 (Plan Generator)
            └── Phase 5 (Plan Generator) [needs portfolio + ISA data]
                        └── Phase 6 (Dashboard UI)
```

Phase 6 depends on all prior phases. Phases 3 and 2 (portfolio side) can begin in parallel after Phase 1 completes.
