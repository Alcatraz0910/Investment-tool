# Pulse

## What This Is

Pulse is a personal investment planning tool for UK retail investors focused on Stocks & Shares ISAs. It ingests YouTube finance creator transcripts, extracts their implied asset allocation strategy using AI, then reconciles that strategy against the user's current portfolio and monthly contribution budget to produce a concrete "Buy List" — exactly how to split next month's investment. The end goal is a premium, Family Office-style dashboard that makes creator-led investing systematic instead of reactive.

## Core Value

Given a monthly budget and a creator's strategy, tell the user exactly what to buy this month to move their portfolio toward that strategy — updated automatically whenever the creator's stance changes.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Creator Management**
- [ ] Admin-maintained curated creator list (YouTube channels) stored in Supabase
- [ ] Users can add any YouTube channel URL to their personal tracking list
- [ ] Users can remove creators from their list at any time
- [ ] Creator list is not capped — users can track as many channels as they want

**Transcript Pipeline**
- [ ] Pull last 12 months of video transcripts per tracked creator via YouTube Data API
- [ ] Manual "Refresh" trigger per creator (no background jobs in v1)
- [ ] Store transcripts in Pinecone with creator + date metadata for long-term memory

**Strategy Extraction**
- [ ] Claude processes transcripts and extracts implied asset allocation (e.g. 60% Tech, 20% Dividends, 20% Cash)
- [ ] Strategy is versioned — each refresh creates a new snapshot, preserving history
- [ ] Conflicting stances across videos are surfaced, not silently resolved

**Portfolio & Budget**
- [ ] User manually enters current holdings (ticker, quantity, current value)
- [ ] User sets monthly contribution amount (e.g. £500)
- [ ] ISA allowance tracker: shows £20,000 annual limit minus contributions to date

**Plan Generator**
- [ ] PlanGenerator.ts: inputs (current portfolio + monthly budget + creator strategy) → outputs Next-Month Buy List
- [ ] Buy List shows exact £ amounts per ticker to bring portfolio toward target allocation
- [ ] Slider-based Contribution Calculator: drag £200→£1000 and Buy List recalculates instantly
- [ ] When creator updates their strategy, the next Buy List reflects the pivot automatically

**Dashboard & UI**
- [ ] Glassmorphism dark mode aesthetic — Space Grey + Electric Indigo palette
- [ ] Roadmap View: visual timeline of "Creator's Vision" vs "Your Current Path"
- [ ] Action Plan panel: highlights this month's Buy List based on latest transcript analysis
- [ ] All AI output clearly labelled as creator-derived information, not financial advice

### Out of Scope

- Live portfolio sync (TrueLayer / Open Banking) — deferred to v2; v1 uses manual entry
- CSV statement upload — deferred to v2
- Scheduled/automated video polling (nightly cron) — v1 is manual refresh only
- Multi-user SaaS, billing, subscriptions — personal-first build; productize after validation
- FCA authorisation / regulated advice — information-only framing with disclaimers throughout
- Plaid integration — not suitable for UK market; replaced by TrueLayer in v2

## Context

- **Target account type:** UK Stocks & Shares ISA (£20,000 annual allowance)
- **Regulatory stance:** Pulse outputs creator-derived information, not personalised financial advice. All plan outputs carry clear disclaimers. FCA authorisation is explicitly out of scope for v1.
- **Creator model:** Admin curates a default set of vetted finance creators; users freely extend their personal list with any YouTube channel. No cap on tracked creators.
- **Portfolio sync:** Manual entry only for v1. TrueLayer (UK Open Banking) planned for v2 — it covers Freetrade, AJ Bell, Hargreaves Lansdown and other UK brokers that Plaid does not.
- **AI memory:** Pinecone stores creator transcript embeddings long-term, enabling the plan to evolve as creator stance shifts across months without reprocessing all historical content.
- **Personal-first:** Built for the owner's own investing workflow. Multi-user SaaS architecture is intentional but not activated in v1.

## Constraints

- **Tech Stack**: Next.js 15 (App Router), Tailwind CSS, Framer Motion, Supabase, Pinecone, YouTube Data API, Anthropic Claude (claude-sonnet-4-6 or claude-opus-4-7) — fixed by design decision
- **UK Regulatory**: Output must be framed as information derived from creator content, never personalised investment advice. Disclaimers required on all plan outputs.
- **ISA Limit**: £20,000 annual allowance — plan generator must not recommend contributions that would exceed remaining allowance
- **No background jobs (v1)**: All data refresh is user-triggered; no server-side cron or webhooks

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Manual portfolio entry (v1) | Removes TrueLayer OAuth complexity from the critical path; validate core plan logic first | — Pending |
| Manual refresh over cron | Simpler infra for personal use; avoids YouTube API quota burn on a schedule | — Pending |
| Pinecone for creator memory | Semantic search over 12 months of transcripts is impractical with pure SQL; vector store enables "what did this creator say about X?" queries | — Pending |
| Information-only framing | UK FCA prohibits personalised investment advice without authorisation; disclaimers protect the product | — Pending |
| Curated + open creator list | Curated list reduces cold-start friction; open addition satisfies power users who track niche channels | — Pending |
| TrueLayer over Plaid (v2) | Plaid UK coverage is sparse; TrueLayer is the standard UK Open Banking provider | — Pending |

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
*Last updated: 2026-05-06 after initialization*
