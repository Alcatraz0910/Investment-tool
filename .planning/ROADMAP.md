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

**Plans:** 4 plans

**Wave 1**
- [x] 01-01-PLAN.md — Scaffold Next.js 15, install dependencies, wire Supabase SSR client pair and middleware

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-02-PLAN.md — Auth pages (/auth/login, /auth/signup) and protected dashboard placeholder (/dashboard)
- [x] 01-03-PLAN.md — Full DB schema (9 tables + RLS) deployed to Supabase SQL editor

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-04-PLAN.md — Hand-written TypeScript domain types (src/types/index.ts)

**Cross-cutting constraints:**
- `getUser()` (not `getSession()`) in all server-side Supabase calls — enforced by middleware + dashboard page
- `decimal.js` Decimal type for all £ amount fields — enforced in types/index.ts
- No CLI migrations — schema deployed via Supabase SQL editor (D-03)

**Success Criteria:**
1. User can sign up, log in, and stay logged in across page reloads
2. Unauthenticated routes redirect to login; authenticated routes are accessible
3. DB schema is deployed to Supabase with correct foreign keys and RLS policies enabled

---

## Phase 2: Portfolio & Creator Management

**Goal:** User can build their portfolio (manual holdings entry), manage their creator list (curated + custom), and log ISA contributions — the data foundation for the plan.

**Requirements:** CREATOR-01, CREATOR-02, CREATOR-03, CREATOR-04, PORT-01, PORT-02, PORT-03, ISA-01, ISA-03

**Plans:** 4 plans

**Wave 1**
- [x] 02-01-PLAN.md — Schema migration (monthly_budget column), UserProfile type update, creator seed script (SQL)

**Wave 2** *(all depend on 02-01; run in parallel with each other)*
- [x] 02-02-PLAN.md — Dashboard tab bar + Portfolio tab (holdings CRUD + monthly budget inline edit)
- [x] 02-03-PLAN.md — Creators tab (browse curated list, track/untrack toggle, add custom creator form)
- [x] 02-04-PLAN.md — ISA tab (allowance summary, contribution log, log contribution form)

**Cross-cutting constraints:**
- All server actions call `getUser()` before any DB operation (defence-in-depth beyond middleware)
- All DB mutations scoped `.eq('user_id', user.id)` (defence-in-depth beyond RLS)
- `decimal.js` for all £ arithmetic (sum of contributions, remaining ISA allowance, holding values)
- Tax year computed server-side using 6 April boundary — never from user-supplied input
- No CLI migrations — seed-creators.sql and migration SQL run via Supabase SQL editor (D-03)

**Success Criteria:**
1. Admin can add a YouTube channel to the curated list and it appears in the user-facing browse list
2. User can add a creator from the curated list and a custom URL to their personal list, then remove both
3. User can enter holdings and see total portfolio value; monthly contribution amount is saved
4. ISA tracker correctly shows £20,000 minus logged contributions; resets on 6 April

---

## Phase 3: Transcript Pipeline

**Goal:** For each tracked creator, fetch 12 months of video transcripts, store them in Supabase, and embed them into Pinecone — ready for strategy extraction.

**Requirements:** TRANS-01, TRANS-02, TRANS-03, TRANS-04, TRANS-05

**Plans:** 7 plans

**Wave 0**
- [x] 03-01-PLAN.md — Setup: env vars, npm install (googleapis, youtube-transcript, openai, @pinecone-database/pinecone, js-tiktoken), migration.sql (last_refreshed_at + refresh_jobs via SQL editor), Pinecone index creation

**Wave 1** *(blocked on 03-01)*
- [x] 03-02-PLAN.md — Infra clients: lib/supabase/service.ts, lib/youtube/client.ts, lib/openai/client.ts, lib/pinecone/client.ts (server-only singletons)
- [x] 03-03-PLAN.md — Type updates (UserCreator.lastRefreshedAt, RefreshJob) + lib/pipeline/chunker.ts (cl100k_base, 500-token chunks)

**Wave 2** *(blocked on 03-02 + 03-03)*
- [x] 03-04-PLAN.md — lib/pipeline/transcript-pipeline.ts: orchestrator (resolve channel → list videos → fetch transcripts → embed → upsert to Pinecone → update last_refreshed_at); idempotency rules D-07/D-08/D-09/D-10

**Wave 3** *(blocked on 03-04)*
- [x] 03-05-PLAN.md — POST + GET /api/refresh/[creatorId]/route.ts (auth guard, UUID validation, ownership check, maxDuration=300; status polling endpoint)

**Wave 4** *(blocked on 03-03 + 03-05)*
- [x] 03-06-PLAN.md — Client components: refresh-button.tsx (2s polling) + transcript-list.tsx (expand/collapse, status chips)

**Wave 5** *(blocked on 03-06)*
- [ ] 03-07-PLAN.md — Integration: page.tsx data fetch (transcripts + last_refreshed_at) + creators-tab.tsx wiring; human-verified end-to-end smoke test

**Success Criteria:**
1. Clicking Refresh on a creator fetches at least the last 10 videos and stores transcripts in Supabase
2. Pinecone contains chunked embeddings for all stored transcripts, queryable by creator ID
3. Last-refreshed timestamp updates after each successful refresh
4. Re-running Refresh does not create duplicate transcript records (idempotent)

---

## Phase 4: Strategy Extraction & Blending

**Goal:** Claude extracts a versioned, confidence-scored asset allocation strategy from each creator's transcripts via RAG, and the app blends multiple creator strategies using user-set trust weights.

**Requirements:** STRAT-01, STRAT-02, STRAT-03, STRAT-04, BLEND-01, BLEND-02, BLEND-03

**Plans:** 5 plans

**Wave 0**
- [x] 04-01-PLAN.md — Setup: install @anthropic-ai/sdk + vitest, create lib/anthropic/client.ts singleton, fix Pinecone metadata (add chunk text), create test stubs

**Wave 1** *(run in parallel; both blocked on 04-01)*
- [x] 04-02-PLAN.md — Strategy extractor: RAG retrieval (3 sub-queries) + Claude tool_use extraction + creator_strategies INSERT (STRAT-01/02/03)
- [x] 04-03-PLAN.md — Contradiction detection (pure function) + StrategyBlender pure module (STRAT-04, BLEND-02/03)

**Wave 2** *(blocked on 04-02 + 04-03)*
- [x] 04-04-PLAN.md — Refresh route integration (non-blocking extraction, D-01/02) + saveCreatorWeight server action (BLEND-01)

**Wave 3** *(blocked on 04-04)*
- [x] 04-05-PLAN.md — Frontend: TrustWeightSlider, ContradictionDiff, StrategyCard, BlendSummary; extend creators-tab.tsx + page.tsx

**Success Criteria:**
1. After a creator Refresh, a new strategy snapshot is generated with category allocations, confidence score, and ≥1 source video citation
2. Each strategy extraction creates a new versioned record; previous versions are accessible
3. A significant allocation shift between versions triggers a visible contradiction flag on the creator card
4. User can set a trust weight for a creator and it persists; setting weight to 0 excludes that creator from the blend
5. Blend Summary correctly reflects weighted influence of each creator in the unified allocation

---

## Phase 5: Plan Generator

**Goal:** `generatePlan` takes the user's portfolio, monthly budget, and blended strategy to produce an actionable, ISA-capped Buy List; the Contribution Calculator updates it live.

**Requirements:** PLAN-01, PLAN-02, PLAN-03, PLAN-04, ISA-02

**Plans:** 4 plans

**Wave 0** *(manual blocking step + type prep)*
- [x] 05-01-PLAN.md — Schema migration (is_fill_ticker column + partial unique index via SQL editor) + extend types/index.ts (Holding.isFillTicker, BuyListItem.allocationGapPct)

**Wave 1** *(blocked on 05-01)*
- [x] 05-02-PLAN.md — `lib/plan/generator.ts` pure function + `generator.test.ts` vitest TDD (covers PLAN-01/02/03/04, ISA-02)

**Wave 2** *(blocked on 05-01 + 05-02)*
- [x] 05-03-PLAN.md — `plan-actions.ts` (upsertBuyList + setFillTicker server actions) + PortfolioTab fill-ticker toggle UI

**Wave 3** *(blocked on 05-01 + 05-02 + 05-03)*
- [x] 05-04-PLAN.md — PlanTab.tsx + ContributionCalculator.tsx + BuyListTable.tsx + page.tsx integration (4th Plan tab, always-fetch holdings + ISA, server-side generation + upsert)

**Cross-cutting constraints:**
- `decimal.js` for all £ arithmetic in generator.ts — never native JS floats
- `generator.ts` has zero server-only imports — must run in browser for ContributionCalculator
- No CLI migrations — is_fill_ticker migration via Supabase SQL editor (D-03)
- No "advice"/"recommend"/"suggest" in rationale strings (PLAN-04)
- ISA tax year computed via `getCurrentTaxYear()` from lib/tax-year.ts (6 April boundary)

**Success Criteria:**
1. PlanGenerator produces a Buy List where the sum of all amounts equals `min(budget, isa_remaining)` to the penny (using decimal arithmetic)
2. When a creator strategy updates, the next generated plan reflects the new blended allocation
3. ISA warning is shown when budget exceeds remaining allowance; plan total does not exceed the allowance
4. Dragging the Contribution Calculator slider updates the Buy List in < 100ms (no API call)

---

## Phase 6: Dashboard UI

**Goal:** Premium glassmorphism dashboard surfaces the Action Plan, Roadmap View, creator strategy cards, Blend Summary, and Contribution Calculator in a cohesive dark-mode interface.

**Requirements:** UI-01, UI-02, UI-03, UI-04, UI-05

**Plans:** 6 plans

**Wave 0** *(blocks all subsequent waves)*
- [x] 06-00-PLAN.md — Test infra: install recharts + @testing-library/react + jsdom; configure vitest jsdom; create 5 Wave 0 test stubs

**Wave 1** *(blocked on 06-00)*
- [x] 06-01-PLAN.md — Design system: globals.css body token, page.tsx max-w-4xl + glassmorphism shell, AnimatedTabPanel tab-fade wrapper

**Wave 2** *(blocked on 06-01; 06-02 and 06-04 run in parallel)*
- [x] 06-02-PLAN.md — Action Plan panel: BuyListTable div card list + AnimatePresence accordion + PlanTab "Your Action Plan" + ContributionCalculator controlled with budget lift
- [x] 06-04-PLAN.md — Creator cards: StrategyCard glassmorphism + lastRefreshedAt + BlendSummary + TrustWeightSlider accent + ContradictionDiff reskin + creators-tab stagger

**Wave 3** *(blocked on 06-00 + 06-01 + 06-02)*
- [x] 06-03-PLAN.md — Roadmap View: roadmap.ts computeRoadmap pure function + RoadmapView Recharts LineChart + PlanTab wiring

**Wave 4** *(blocked on 06-02 + 06-03 + 06-04)*
- [ ] 06-05-PLAN.md — Smoke tests: implement real assertions in 5 test stubs + human visual checkpoint

**Cross-cutting constraints:**
- `import { motion, AnimatePresence } from 'framer-motion'` (not `'motion/react'`) — matches package.json
- `'use client'` required on RoadmapView.tsx (Recharts SSR restriction)
- `decimal.js` for all £ arithmetic in roadmap.ts; convert to `number` only at Recharts data boundary
- No "advice"/"recommend"/"suggest" in any user-facing string
- Disclaimer "Creator-derived information — not financial advice" required on BuyListTable (all variants) and RoadmapView
- Do NOT modify generator.ts, blender.ts, plan-actions.ts, or any data-fetching code

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
