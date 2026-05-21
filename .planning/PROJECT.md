# Pulse

## What This Is

Pulse is a personal investment planning tool for UK retail investors with Stocks & Shares ISAs. It ingests YouTube finance creator transcripts, extracts their implied asset allocation strategy using Claude AI via RAG, then reconciles that strategy against the user's current portfolio and monthly contribution budget to produce a concrete "Buy List" — exactly how to split next month's investment across tickers to move toward the target allocation. The v1.0 MVP delivers a premium glassmorphism dashboard with real-time contribution calculator, roadmap view, and multi-creator strategy blending.

## Core Value

Given a monthly budget and a creator's strategy, tell the user exactly what to buy this month to move their portfolio toward that strategy — updated automatically whenever the creator's stance changes.

## Requirements

### Validated (v1.0)

- ✓ Supabase email/password auth with session persistence — v1.0
- ✓ Admin-maintained curated creator list stored in Supabase — v1.0
- ✓ Users can track/untrack creators and add custom YouTube channel URLs — v1.0
- ✓ YouTube transcript pipeline: fetch 12-month history, chunk, embed to Pinecone — v1.0
- ✓ Manual Refresh trigger per creator with real-time progress polling — v1.0
- ✓ Claude RAG strategy extraction: versioned, confidence-scored, with source citations — v1.0
- ✓ Contradiction detection when creator allocation shifts >15pp between versions — v1.0
- ✓ Per-category trust weight sliders; weighted average blend across all tracked creators — v1.0
- ✓ `generatePlan` (decimal.js): ISA-capped Buy List with fill-ticker routing — v1.0
- ✓ ISA allowance tracker (£20k / tax year) with contribution logging — v1.0
- ✓ Glassmorphism dark-mode dashboard: Action Plan, Roadmap View, Contribution Calculator — v1.0
- ✓ All output framed as creator-derived information, not financial advice — v1.0

### Active (v1.1)

- [ ] CSV statement upload — generic CSV with column mapping, replaces manual holding entry
- [ ] Creator discovery/search — search YouTube channels by name
- [ ] TradingView live prices — portfolio valuation + Buy List enrichment
- [ ] Mobile-responsive layout — dashboard usable on phones

### Out of Scope

- Live portfolio sync (TrueLayer) — deferred to v1.1+; v1 uses manual entry
- CSV statement upload — deferred to v1.1+
- Scheduled/automated video polling — v1 is manual refresh only
- Multi-user SaaS, billing, subscriptions — personal-first; productize after validation
- FCA authorisation / regulated advice — information-only framing throughout
- Plaid integration — not suitable for UK market; TrueLayer is the standard UK provider
- Trade execution — Pulse tells you what to buy; it does not place trades

## Current Milestone: v1.3 — Household Budget Tracker

**Goal:** A standalone budgeting section where household members (user + partner) import bank CSVs, AI categorises spending, users review/edit categories, AI surfaces cut-back observations, and a monthly surplus is displayed.

**Key decisions already made:**
- Standalone section — NOT connected to Watch List monthly budgets
- Manual CSV import only — no Open Banking / TrueLayer
- AI advice framed as observations (same guardrail as creator tool)
- Phases 16–19

---

## Previous Milestone: v1.2 Complete

**v1.2 Creator Intelligence shipped 2026-05-20.**

Phases 11–15 complete:
- Phase 11: Two-layer creator intelligence profiles (stable 4-month + 30-day signals), YouTube channel search
- Phase 12: Watch List with per-creator budgets, real-time prices, live share quantity calculation
- Phase 13: Market news integration (Finnhub + RSS), AI "This Month's Context" summary
- Phase 14: Creator signal badges (consensus, sentiment trend, contradiction, inactive)
- Phase 15: Visual redesign — Geist fonts, glassmorphism UI primitives (Card, Badge, Button, StatTile), animated tab bar, mobile-responsive Portfolio and Watch List tabs

## Context

- **Current state:** v1.3 milestone started 2026-05-21. Phases 16–19 planned.
- **Codebase:** ~10,000+ LOC TypeScript/TSX; 15 phases, 33 plans; full design system in pulse/src/components/ui/
- **Tech stack:** Next.js 15 (App Router), Supabase, Pinecone, Anthropic Claude, OpenAI embeddings, Recharts, Framer Motion, decimal.js
- **Target account type:** UK Stocks & Shares ISA (£20,000 annual allowance, 6 Apr – 5 Apr)
- **Regulatory stance:** Creator-derived information only. All plan outputs carry disclaimers. FCA authorisation explicitly out of scope.
- **Known tech debt:** Phase 3 and Phase 6 missing formal VERIFICATION.md; VALIDATION.md files in draft; `unified_allocation: {}` stub in upsertBuyList; pre-existing TS errors in creator-actions.ts

## Constraints

- **Tech Stack:** Next.js 15 (App Router), Tailwind CSS, Framer Motion, Supabase, Pinecone, YouTube Data API, Anthropic Claude — fixed by design decision
- **UK Regulatory:** Output must be framed as information derived from creator content, never personalised investment advice
- **ISA Limit:** £20,000 annual allowance — plan generator must not recommend contributions exceeding remaining allowance
- **No background jobs (v1):** All data refresh is user-triggered; no server-side cron or webhooks
- **decimal.js:** All £ arithmetic uses Decimal — never native JS floats

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Manual portfolio entry (v1) | Removes TrueLayer OAuth complexity from critical path | ✓ Validated — works well for personal use |
| Manual refresh over cron | Simpler infra; avoids YouTube API quota burn on a schedule | ✓ Validated |
| Pinecone for creator memory | Semantic search over 12 months of transcripts requires vector store | ✓ Validated — RAG pattern works |
| Information-only framing | UK FCA prohibits personalised investment advice without authorisation | ✓ Validated — disclaimers throughout |
| Curated + open creator list | Curated reduces cold-start; open satisfies power users | ✓ Validated |
| TrueLayer over Plaid (v2) | Plaid UK coverage sparse; TrueLayer is standard UK Open Banking provider | — Pending (v2) |
| `getUser()` not `getSession()` | Supabase SSR recommendation; prevents stale session reads | ✓ Validated |
| `decimal.js` for all £ math | Floating-point errors in financial arithmetic | ✓ Validated — zero rounding issues |
| RAG pattern (never full transcript) | Transcripts exceed 100k tokens per creator | ✓ Validated — 3 sub-queries work well |
| `generator.ts` zero server imports | Enables client-side recomputation for ContributionCalculator | ✓ Validated |
| Dedicated creators route (v1.0) | Creator cards + strategy + refresh too complex for a tab | ✓ Validated |

---
## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-13 — Milestone v1.1 started*
