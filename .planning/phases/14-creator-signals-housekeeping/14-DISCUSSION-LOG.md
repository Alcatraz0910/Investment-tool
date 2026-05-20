# Phase 14: Creator Signals + Housekeeping - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 14-Creator-Signals-Housekeeping
**Areas discussed:** Signal UI placement, Sentiment trend approach, Contradiction scope, Cadence weighting

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Signal UI placement | Where do the 4 signals surface? Cards, merged section, or dedicated panel? | ✓ |
| Sentiment trend approach | Compare 2 snapshots vs pull historical rows | ✓ |
| Contradiction scope | What counts as contradiction; logged vs shown | ✓ |
| Cadence weighting | Visual only vs affects calcShareQuantity | ✓ |

**User's choice:** "Do what You think works best" — all areas delegated to Claude.

---

## Signal UI Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Watch List creator cards (badges) | Chips on existing glassmorphism cards per creator | ✓ |
| Dedicated signals panel | New section or tab for signals view | |
| Creators page | Surface signals on the `/dashboard/creators` page | |

**User's choice:** Delegated to Claude.
**Notes:** Resolved as badges/chips on existing Watch List creator cards — no new tab or panel. Keeps scope tight and avoids new navigation surface.

---

## Sentiment Trend Approach

| Option | Description | Selected |
|--------|-------------|----------|
| 2-snapshot compare (stable vs latest) | Client-side, no extra DB query | ✓ |
| Historical rows query | Pull multiple creator_strategies rows for richer trend | |

**User's choice:** Delegated to Claude.
**Notes:** 2-snapshot comparison is sufficient for the 4-month vs 30-day distinction. Historical rows would require additional DB queries and complex time-series logic — overkill for Phase 14.

---

## Contradiction Scope

| Option | Description | Selected |
|--------|-------------|----------|
| High-conviction ticker drop + sector stance flip | Two triggers; shown as badge with tooltip reason | ✓ |
| Sector stance flip only | Narrower definition | |
| Logged only (not shown to user) | Backend record, no UI | |

**User's choice:** Delegated to Claude.
**Notes:** Contradiction.ts redesigned to accept `(stable, latest) → { hasContradiction, reason }`. Shown as "⚠ Contradiction" badge with hover reason. If `profile_latest` is null, no contradiction possible.

---

## Cadence Weighting

| Option | Description | Selected |
|--------|-------------|----------|
| Visual indicator only | "No recent posts" badge + 80% opacity; no financial logic change | ✓ |
| Reduce calcShareQuantity weight | Fewer shares allocated to inactive creators | |
| Both visual + financial weighting | Combined approach | |

**User's choice:** Delegated to Claude.
**Notes:** Visual only — keeps financial calculation unchanged and predictable. User retains control via monthly budget field. Inactive = `profile_latest === null` (already meaningful state from extractor).

---

## Claude's Discretion

- All 4 gray areas fully delegated by user ("Do what You think works best")
- Whether contradiction detection is persisted to DB or recomputed client-side (D-09)
- Exact badge placement within creator cards (follow Phase 12/13 card conventions)
- SIG-02 sentiment badge location within card (header vs footer chip row)

## Deferred Ideas

- Headline detail view — Phase 13 carry-over; Phase 15+
- Auto-scheduled news refresh — violates v1 manual-first; post-v1.2
- Per-ticker news feed page — post-v1.2
- VALIDATION.md / VERIFICATION.md remediation — not in scope
