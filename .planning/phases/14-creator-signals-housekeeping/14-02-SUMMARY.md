---
plan: "14-02"
status: complete
wave: 1
completed: "2026-05-20"
---

# Plan 14-02 Summary

## What was built

Redesigned `contradiction.ts` to compare two `CreatorProfile` snapshots (4-month stable vs 30-day latest) instead of the old AllocationMap percentage-delta approach. The new pure function checks whether high-conviction tickers disappeared and whether sector stances flipped bullish/cautious, returning `ContradictionResult { hasContradiction, reason }`. Updated `extractor.ts` to pass the real profile objects to the check and use `.reason` in the DB INSERT, removing the stale `prevRows`/`prevAllocation` fetch. Extended `CreatorWatchList` in `generator.ts` with `profileLatestNull`, `profileStable`, and `profileLatest` fields that Plan 14-03 needs for badge rendering.

## Key changes

- `pulse/src/lib/strategy/contradiction.ts`: full replacement — new `CreatorProfile`-based signature, `ContradictionResult.reason` (drops `note` and `shifts`), null-latest short-circuit, two contradiction checks (missing high-conviction ticker, sector stance flip)
- `pulse/src/lib/strategy/contradiction.test.ts`: rewritten to test new API (Rule 1 fix — old tests referenced removed fields)
- `pulse/src/lib/strategy/extractor.ts`: call-site updated to `runContradictionCheck(stableProfile, latestProfile)`, INSERT uses `contradiction.reason`, stale `prevRows`/`prevAllocation` fetch block removed
- `pulse/src/lib/watchlist/generator.ts`: `CreatorWatchList` interface gains `profileLatestNull: boolean`, `profileStable: CreatorProfile | null`, `profileLatest: CreatorProfile | null`; both return sites in `buildWatchLists` populated

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated contradiction.test.ts to match new API**
- **Found during:** Task 1 — tsc after writing contradiction.ts reported 20 errors in the test file
- **Issue:** `contradiction.test.ts` called `runContradictionCheck(null, AllocationMap)` and accessed `.note` / `.shifts` which no longer exist
- **Fix:** Rewrote the test file with `CreatorProfile`-based fixtures testing the new checks (null-latest, missing high-conviction ticker, sector stance flip, case-insensitive sector match)
- **Files modified:** `pulse/src/lib/strategy/contradiction.test.ts`
- **Commit:** a241c3f

## Commits

| Hash | Message |
|------|---------|
| a241c3f | feat(14-02): redesign contradiction.ts with CreatorProfile-based signature |
| 9277d15 | feat(14-02): update extractor call-site and extend CreatorWatchList |

## Verification

- [x] `cd pulse && npx tsc --noEmit` exits 0
- [x] `contradiction.ts` exports `ContradictionResult` with `hasContradiction: boolean` and `reason: string | null`
- [x] `runContradictionCheck` accepts `(stable: CreatorProfile, latest: CreatorProfile | null)`
- [x] Returns no-contradiction when `latest` is null
- [x] `CreatorWatchList` interface has `profileLatestNull`, `profileStable`, `profileLatest`
- [x] `buildWatchLists` populates all three fields (3 occurrences in generator.ts)
- [x] `extractor.ts` passes `(stableProfile, latestProfile)` and uses `.reason`
- [x] No `contradiction.note` references remain in extractor.ts
