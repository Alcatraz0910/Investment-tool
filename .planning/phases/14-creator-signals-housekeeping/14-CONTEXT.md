# Phase 14: Creator Signals + Housekeeping - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Compute and surface four intelligence signals from the existing `profile_stable` / `profile_latest` JSONB columns already stored in `creator_strategies`:

- **SIG-01 Consensus** — highlight tickers backed by 2+ tracked creators
- **SIG-02 Sentiment trend** — detect whether a creator is trending bullish or cautious vs their 4-month baseline
- **SIG-03 Contradiction** — flag when a creator's recent 30-day picks contradict their stable stance (redesigns `contradiction.ts` per D-15)
- **SIG-04 Cadence** — visually mark creators who have not posted recently

Plus housekeeping: fix pre-existing TS errors in `creator-actions.ts`.

**No new API provisioning, no new DB tables, no new tabs.** All signals are computed from data already loaded by the Watch List page.

</domain>

<decisions>
## Implementation Decisions

### Signal UI Placement (SIG-01 through SIG-04)
- **D-01:** Signals render as small chips/badges on the **existing Watch List creator cards** — no new tab, page, or panel.
- **D-02:** **SIG-01 Consensus** — add a "Consensus" chip to any ticker in the "All Picks" merged section that is cited by 2+ creators. `buildMergedWatchList` already tracks `creators[]` per ticker; use `creators.length >= 2` as the threshold. No changes to the generator function — derive the chip in the UI layer.
- **D-03:** **SIG-02 Sentiment trend** — one badge per creator card: "↑ Trending bullish" (green), "↓ Trending cautious" (amber), or no badge if no change. Computed client-side by comparing `profile_stable.sector_focus` vs `profile_latest.sector_focus` (same-sector name match). If majority of matched sectors drifted toward `cautious` → cautious badge; toward `bullish` → bullish badge; mixed/unchanged → no badge. No badge shown if `profile_latest` is null.
- **D-04:** **SIG-03 Contradiction** — "⚠ Contradiction" badge on the creator card. Hover/tooltip reveals the reason string. A contradiction is triggered by either: (a) a ticker that was `high` conviction in `profile_stable` but is absent from `profile_latest`'s favoured_stocks, OR (b) a sector whose stance flipped (`bullish ↔ cautious`) between stable and latest. No badge shown if `profile_latest` is null (can't compare).
- **D-05:** **SIG-04 Cadence** — "No recent posts" badge on the creator card + card rendered at 80% opacity when `profile_latest === null`. This is visual only — does NOT affect `calcShareQuantity` or any financial computation.

### Contradiction.ts Redesign (SIG-03 / D-15)
- **D-06:** `contradiction.ts` is redesigned to accept `(stable: CreatorProfile, latest: CreatorProfile | null) → ContradictionResult` where `ContradictionResult = { hasContradiction: boolean; reason: string | null }`. Replaces the current stub that always short-circuits.
- **D-07:** If `latest` is null, return `{ hasContradiction: false, reason: null }` (no data to compare).
- **D-08:** `extractor.ts` call-site updated to pass both layers; result stored in a new `contradiction_detected: boolean` + `contradiction_reason: string | null` on the inserted `creator_strategies` row OR derived at render time (see D-09).
- **D-09:** Claude decides whether to persist contradiction result to DB or recompute client-side from loaded JSONB. Both are valid — choose whichever keeps the plan simpler.

### Sentiment Trend Computation (SIG-02)
- **D-10:** Compare 2 snapshots only (stable vs latest) — no historical `creator_strategies` row reads beyond what page.tsx already loads. The 2-layer comparison is sufficient for the 4-month vs 30-day distinction the requirements describe.
- **D-11:** Sector matching is by name (case-insensitive). Unmatched sectors (appear in one layer but not the other) are ignored for trend calculation.

### Cadence Definition (SIG-04)
- **D-12:** Inactive = `profile_latest === null`. This is already populated (or not) by the extractor based on whether any 30-day Pinecone chunks exist. No new DB columns or additional queries needed.
- **D-13:** Cadence does NOT affect `calcShareQuantity` or budget allocation. Visual indicator only — the user remains in control of weighting via the monthly budget field.

### Housekeeping
- **D-14:** Fix pre-existing TS errors in `creator-actions.ts` (TS2353/TS2339 flagged in STATE.md tech debt). Scope: make `npx tsc --noEmit` pass cleanly for this file.
- **D-15:** `unified_allocation: {}` stub in `upsertBuyList` is intentional — do NOT remove it.
- **D-16:** VALIDATION.md nyquist status and Phase 3/6 VERIFICATION.md gaps are out of scope for Phase 14.

### Claude's Discretion
- Whether contradiction detection is persisted to DB (new columns on `creator_strategies`) or recomputed client-side from JSONB on each page load (D-09) — choose the simpler path.
- Exact badge styling (colour, size, placement within the card) — follow glassmorphism aesthetic established in Phase 12.
- Whether SIG-02 sentiment badge appears inside the creator card header or as a footer chip row — match Phase 12/13 card layout conventions.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Constraints
- `CLAUDE.md` — decimal.js rule, RAG pattern, no-advice framing, ISA constraints
- `.planning/PROJECT.md` — glassmorphism aesthetic, dark-first, Framer Motion

### Phase Research & Design Contracts
- `.planning/REQUIREMENTS.md` §Creator Signals (Phase 14) — SIG-01 through SIG-04 acceptance criteria
- `.planning/ROADMAP.md` §Phase 14 — phase goal and scope bullet

### Existing Code to Read Before Modifying
- `pulse/src/lib/watchlist/generator.ts` — `buildWatchLists`, `buildMergedWatchList`, `WatchListItem`, `CreatorWatchList`, `MergedWatchListItem` types; signal computation extends or annotates these
- `pulse/src/lib/strategy/extractor.ts` — `CreatorProfile` type, `PROFILE_TOOL_DEF`, two-call pattern; `contradiction.ts` call-site (D-06 redesign)
- `pulse/src/lib/strategy/contradiction.ts` — current stub to be redesigned for SIG-03
- `pulse/src/app/dashboard/watchlist-actions.ts` — server actions for Watch List page
- `pulse/src/app/dashboard/page.tsx` — how `profileStable` / `profileLatest` are loaded and passed down; entry point for signal data

### Prior Phase Context (for integration consistency)
- `.planning/phases/12-watch-list-per-creator-budget/12-CONTEXT.md` — Watch List card structure, glassmorphism pattern, `CreatorWatchList` props
- `.planning/phases/13-market-news-integration/13-CONTEXT.md` — badge/chip patterns introduced in Phase 13 (news badge); follow the same visual language

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `buildMergedWatchList(watchLists)` in `generator.ts` — already groups tickers by creator count; `MergedWatchListItem.creators[]` is the SIG-01 consensus source
- `CreatorProfile.sector_focus[{sector, stance: 'bullish'|'neutral'|'cautious'}]` — raw material for SIG-02 sentiment trend; available in both `profile_stable` and `profile_latest`
- `CreatorProfile.favoured_stocks[{ticker, conviction: 'high'|'medium'|'low'}]` — raw material for SIG-03 contradiction (conviction flip detection)
- Phase 13 news badge components in `watch-list-tab.tsx` — established pattern for small chip/badge UI on Watch List

### Established Patterns
- All JSONB (`profile_stable`, `profile_latest`) already loaded in `page.tsx` RSC — signals derived client-side avoid additional DB round-trips
- `profile_latest === null` is already a meaningful state (extractor skips latest call when no 30-day chunks) — SIG-04 cadence piggybacks on this
- Glassmorphism card aesthetic from Phase 12; dark-first, subtle opacity variations acceptable
- `contradiction.ts` currently always returns no contradiction (null guard short-circuit) — redesign is isolated to this file + the extractor call-site

### Integration Points
- `WatchListTab.tsx` (Phase 12/13) receives `watchLists: CreatorWatchList[]` and `mergedWatchList: MergedWatchListItem[]` — signal badges slot into this component
- `extractor.ts` → `contradiction.ts` call-site: update to pass `(stable, latest)` after redesign
- `page.tsx` passes `profileStable` and `profileLatest` from DB → `buildWatchLists()` → `WatchListTab` — signals can be computed anywhere in this chain

</code_context>

<specifics>
## Specific Ideas

- User delegated all implementation choices to Claude — no "I want it like X" references
- Sentinel from Phase 13 discussion: Phase 13 CONTEXT noted "headline detail view" and "per-ticker news feed page" as Phase 14+ deferred ideas — those are NOT in scope here

</specifics>

<deferred>
## Deferred Ideas

- Headline detail view (popover/drawer with full news headlines) — from Phase 13 deferred list; Phase 15+
- Auto-scheduled news refresh — violates v1 manual-first constraint; post-v1.2
- Per-ticker news feed page — out of scope; post-v1.2
- VALIDATION.md nyquist remediation — out of scope for Phase 14 (D-16)
- Phase 3 / Phase 6 formal VERIFICATION.md — out of scope for Phase 14 (D-16)

</deferred>

---

*Phase: 14-Creator-Signals-Housekeeping*
*Context gathered: 2026-05-20*
