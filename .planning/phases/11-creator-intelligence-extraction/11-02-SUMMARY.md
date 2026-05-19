---
phase: 11-creator-intelligence-extraction
plan: "02"
subsystem: youtube-client
tags: [youtube-api, channel-search, tdd, wave-1, ci-01, srch-01, srch-02]

requires:
  - phase: 11-creator-intelligence-extraction
    plan: "01"
    provides: vitest test infrastructure, stub test files

provides:
  - listVideosLast4Months export (4-month video window, CI-01)
  - searchChannels export (two-step YouTube API search, SRCH-01)
  - formatSubscriberCount export (pure formatting helper, SRCH-02)
  - SearchResult interface export
  - transcript-pipeline.ts updated to use listVideosLast4Months

affects: [11-03, 11-04]

tech-stack:
  added: []
  patterns:
    - "server-only mock in vitest setup.ts for server-side module testing"
    - "Two-step YouTube channel search: search.list + channels.list batch"
    - "setMonth(month - 4) for 4-month cutoff (JS handles year rollover)"

key-files:
  created: []
  modified:
    - pulse/src/lib/youtube/client.ts
    - pulse/src/lib/pipeline/transcript-pipeline.ts
    - pulse/src/__tests__/setup.ts
    - pulse/tests/youtube-client.test.ts
    - pulse/tests/search-result-formatting.test.ts

key-decisions:
  - "server-only mock added to src/__tests__/setup.ts — allows vitest to import server-side modules without Next.js runtime"
  - "formatSubscriberCount tests moved from search-result-formatting.test.ts to youtube-client.test.ts — co-located with the exported function"
  - "node_modules installed in worktree pulse/ — worktree has source files only; npm install --prefer-offline resolved from npm cache"

metrics:
  duration: ~4min
  completed: 2026-05-19T08:18:53Z
  tasks: 2
  files_modified: 5
---

# Phase 11 Plan 02: Wave 1 YouTube Client Summary

**YouTube client rewritten: 4-month video window (CI-01), channel search (SRCH-01), subscriber count formatter (SRCH-02) — 7 vitest tests green**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-19T08:14:49Z
- **Completed:** 2026-05-19T08:18:53Z
- **Tasks:** 2 (TDD: RED then GREEN for each)
- **Files modified:** 5

## Accomplishments

- `listVideosLast12Months` eliminated from entire codebase — replaced with `listVideosLast4Months` using `setMonth(month - 4)` cutoff
- `SearchResult` interface added (channelId, channelTitle, channelUrl, subscriberCount: number | null, thumbnailUrl: string | null)
- `searchChannels(query)` implemented: step 1 = `search.list` (100 quota), step 2 = `channels.list` batch (1 quota); never auto-called per D-19
- `formatSubscriberCount(count)` pure helper exported
- `transcript-pipeline.ts` import, call site, noVideosSummary string, and step comments updated to "4 months"
- `youtube-client.test.ts` filled in: 7 tests pass (2 cutoff logic + 5 formatSubscriberCount), 3 todo for real-API integration

## Task Commits

1. **Task 1: client.ts rewrite** — `98c30c5` (feat)
2. **Task 2: pipeline update + tests** — `3eb6654` (feat)

## Files Created/Modified

- `pulse/src/lib/youtube/client.ts` — removed listVideosLast12Months; added listVideosLast4Months, SearchResult, searchChannels, formatSubscriberCount
- `pulse/src/lib/pipeline/transcript-pipeline.ts` — import, call, noVideosSummary, comments updated to 4 months
- `pulse/src/__tests__/setup.ts` — added `vi.mock('server-only', () => ({}))` for vitest compatibility
- `pulse/tests/youtube-client.test.ts` — stub replaced with working tests (7 pass, 3 todo)
- `pulse/tests/search-result-formatting.test.ts` — redirected; tests consolidated into youtube-client.test.ts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Mock server-only in vitest setup**
- **Found during:** Task 1 GREEN phase (running tests)
- **Issue:** `import 'server-only'` in client.ts throws `"This module cannot be imported from a Client Component module"` in vitest jsdom environment. Tests fail at import, cannot reach any test logic.
- **Fix:** Added `vi.mock('server-only', () => ({}))` to `pulse/src/__tests__/setup.ts` — the existing shared setup file loaded by vitest for all tests.
- **Files modified:** `pulse/src/__tests__/setup.ts`
- **Commit:** `98c30c5`

**2. [Rule 3 - Blocking] node_modules missing in worktree**
- **Found during:** Task 1 RED phase (running tests)
- **Issue:** Worktree `pulse/` has source files only; `node_modules` not present. `npx vitest` pulled mismatched global version causing `Cannot find module 'vitest/config'`.
- **Fix:** Ran `npm install --prefer-offline` in worktree pulse/ — resolved from npm cache (fast).
- **Files modified:** None (node_modules not committed)
- **Impact:** Tests now run correctly with vitest v4.1.5

## Threat Surface Scan

T-11-02-01 (DoS): `searchChannels` never auto-called — confirmed by implementation (no background jobs, no auto-trigger).
T-11-02-02 (Spoofing): `channelUrl` constructed server-side as `https://www.youtube.com/channel/${id}` — confirmed in implementation.
T-11-02-03 (Info Disclosure): `import 'server-only'` retained — API key stays server-side.

No new threat surface beyond the plan's registered mitigations.

## Known Stubs

- `searchChannels` integration tests marked `it.todo` — require real `YOUTUBE_API_KEY` to exercise. Intentional: these are manual-run integration tests, not CI blockers.

## Self-Check: PASSED

- `pulse/src/lib/youtube/client.ts` — present, contains `listVideosLast4Months`, `searchChannels`, `formatSubscriberCount`, `SearchResult`
- `pulse/src/lib/pipeline/transcript-pipeline.ts` — contains `listVideosLast4Months`, no `listVideosLast12Months`
- Commits `98c30c5` and `3eb6654` — verified in git log
- 7 vitest tests pass, 0 failures
- `npx tsc --noEmit` — 0 new errors (2 pre-existing creator-actions.ts errors unchanged)
