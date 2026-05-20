# Phase 13: Market News Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 13-market-news-integration
**Areas discussed:** Page load strategy, News badge interaction, API key provisioning, Context panel default state

---

## Page Load Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side pre-fetch | page.tsx reads news_cache from Supabase and passes initialNewsContext as prop — returning users see cached data immediately | ✓ |
| Empty on load | WatchListTab starts empty; user must click Refresh News before any data appears | |

**User's choice:** Deferred to Claude
**Notes:** Claude chose server-side pre-fetch for better returning-user UX. Empty state shown only when no cache row exists yet (first-ever visit).

---

## News Badge Interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Display-only count | "N news" badge shows integer count only — no click interaction | ✓ |
| Clickable popover | Badge opens a small popover showing headline titles with links | |

**User's choice:** Deferred to Claude
**Notes:** Claude chose display-only. Consistent with UI-SPEC intent. Popover deferred as a future enhancement if desired.

---

## Finnhub API Key Provisioning

| Option | Description | Selected |
|--------|-------------|----------|
| Wave 0 manual step | Plan includes "obtain free-tier key at finnhub.io, add to .env.local" as a manual Wave 0 task | ✓ |
| Assume already provisioned | Skip the obtain step; just add FINNHUB_API_KEY to .env.local | |

**User's choice:** Deferred to Claude
**Notes:** Research flagged Finnhub key as "Unknown — user must obtain." Claude chose to include Wave 0 manual obtain step to avoid a silent runtime failure.

---

## Context Panel Default State

| Option | Description | Selected |
|--------|-------------|----------|
| Open by default, no persistence | Panel is expanded on every visit; no localStorage state | ✓ |
| Closed by default | Panel collapses on load; user must click to expand | |
| Persist via localStorage | Remember collapse state across sessions | |

**User's choice:** Deferred to Claude
**Notes:** Claude chose always-open as the headline feature of Phase 13. No localStorage — simplicity over memory. User can collapse per-session.

---

## Claude's Discretion

- Finnhub `category` parameter → `general` (per RESEARCH.md recommendation)
- RSS feed fetch timeout → 10 s per feed (per RESEARCH.md recommendation)
- Supabase column types → follow RESEARCH.md DB schema exactly
- RSS feed fetch order → parallel via `Promise.allSettled`
- All four gray areas above

## Deferred Ideas

- Headline detail popover/drawer (showing titles + links) — future phase if desired
- Auto-scheduled refresh (cron) — violates v1 manual-first constraint
- Per-ticker news feed page — out of phase scope
