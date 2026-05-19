---
phase: 11-creator-intelligence-extraction
plan: "03"
subsystem: strategy-extractor
tags: [extraction, claude, pinecone, two-call, ci-02, ci-03, ci-04]
dependency_graph:
  requires:
    - "11-01"  # Wave 0 foundation — stub test files and schema
  provides:
    - "pulse/src/lib/strategy/extractor.ts (PROFILE_TOOL_DEF, SYSTEM_PROMPT, CreatorProfile, extractCreatorStrategy)"
  affects:
    - "pulse/src/lib/strategy/contradiction.ts (unchanged, D-15)"
tech_stack:
  added: []
  patterns:
    - "Two-call Claude extraction: stable (4-month) + conditional latest (30-day)"
    - "Pinecone metadata date filter: { published_at: { $gte: ISO string } }"
    - "Forced tool_use with tool_choice: { type: 'tool', name: 'extract_creator_profile' }"
    - "anyOf nullable ticker schema for favoured_stocks and preferred_index_funds"
    - "server-only mock pattern in vitest tests"
key_files:
  created: []
  modified:
    - pulse/src/lib/strategy/extractor.ts
    - pulse/tests/extractor.test.ts
    - pulse/tests/extractor-schema.test.ts
    - pulse/src/lib/strategy/extractor.test.ts
decisions:
  - "SYSTEM_PROMPT prohibition text rewritten to avoid containing the words 'recommend'/'advise'/'suggest' — plan's example text had these words inside the prohibition instruction itself, which would fail the automated test"
  - "Old extractor.test.ts (src/lib/strategy/) updated to match new extract_creator_profile API — Rule 1 auto-fix"
  - "server-only mock added to both new test files — required for vitest environment"
  - "runContradictionCheck called with (prevAllocation, prevAllocation ?? {}) to satisfy TypeScript strict null check while preserving null short-circuit behaviour"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-19"
  tasks_completed: 2
  files_modified: 4
---

# Phase 11 Plan 03: Extractor Rewrite Summary

One-liner: Two-call extract_creator_profile pattern with Pinecone date filters, nullable ticker schema, and SYSTEM_PROMPT compliance tests — replaces old extract_allocation tool.

## What Was Built

### Task 1: Rewrite extractor.ts

`pulse/src/lib/strategy/extractor.ts` completely rewritten:

- **PROFILE_TOOL_DEF** (`export const`): New tool schema `extract_creator_profile` with `favoured_stocks`, `sector_focus`, `preferred_index_funds`, `methodology`, `confidence`, `source_video_ids`. Both `favoured_stocks[].ticker` and `preferred_index_funds[].ticker` use `anyOf: [{type:'string'},{type:'null'}]` (D-02, D-03).
- **SYSTEM_PROMPT** (`export const`): Observational framing — no "recommend", "advise", or "suggest". Instructs Claude to set `ticker=null` when symbol not cited.
- **CreatorProfile** (`export interface`): TypeScript types for the new schema.
- **retrieveChunks(creatorId, filter?)**: Updated to accept optional Pinecone metadata filter.
- **extractCreatorStrategy**: Two-call pattern:
  1. Stable: `published_at >= (now - 4 months)` filter → always runs; throws if 0 chunks.
  2. Latest: `published_at >= (now - 30 days)` filter → skipped if 0 chunks (D-09); `profile_latest = null`.
  3. DB insert: `profile_stable`, `profile_latest`, `allocation: null` (D-14).
- `QUERY_TEXTS` updated to new profile schema query strings (D-10).
- `max_tokens: 2048` (increased from 1024).
- `contradiction.ts` untouched (D-15).

### Task 2: Fill in tests

- **pulse/tests/extractor-schema.test.ts**: 10 passing tests — PROFILE_TOOL_DEF schema compliance (tool name, nullable tickers, conviction enum, confidence range, required fields) and SYSTEM_PROMPT compliance (no-advice language, ticker null instruction).
- **pulse/tests/extractor.test.ts**: 2 passing + 3 todo — schema constant assertions, 3 integration-level tests left as `.todo` (require full Pinecone mock with chunk-count variation).
- **pulse/src/lib/strategy/extractor.test.ts**: Updated old STRAT tests to match new API (tool name `extract_creator_profile`, updated error message substring).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SYSTEM_PROMPT advice-word check would fail as written**
- **Found during:** Task 1
- **Issue:** Plan's example SYSTEM_PROMPT ended with `Do not use the words "recommend", "advise", or "suggest"` — the word "advise" is inside the string, which would fail the automated test `expect(SYSTEM_PROMPT.toLowerCase()).not.toContain('advise')`.
- **Fix:** Replaced the prohibition text with `Use only observational language — describe what the creator expresses, covers, or discusses. Do not frame output as guidance or instructions to the reader.` — same semantic intent without the forbidden words.
- **Files modified:** pulse/src/lib/strategy/extractor.ts
- **Commit:** 9d59dc6

**2. [Rule 1 - Bug] Old extractor tests broke after rewrite**
- **Found during:** Task 2
- **Issue:** `src/lib/strategy/extractor.test.ts` had tests asserting `tool_choice.name === 'extract_allocation'` and error message `'did not return a tool_use block'` — both changed by the rewrite.
- **Fix:** Updated test descriptions and assertions to match new `extract_creator_profile` API; old mock payload updated to new CreatorProfile shape.
- **Files modified:** pulse/src/lib/strategy/extractor.test.ts
- **Commit:** 0d693c1

**3. [Rule 3 - Blocking] server-only import blocked test execution**
- **Found during:** Task 2
- **Issue:** `extractor.ts` has `import 'server-only'` which throws outside Next.js server context; both test files needed `vi.mock('server-only', () => ({}))` to run.
- **Fix:** Added mock to both `tests/extractor-schema.test.ts` and `tests/extractor.test.ts`.
- **Files modified:** Both test files
- **Commit:** 0d693c1

**4. [Rule 3 - Blocking] TypeScript null type mismatch on contradiction check call**
- **Found during:** Task 1
- **Issue:** Plan code called `runContradictionCheck(prevAllocation, prevAllocation)` — but when `prevAllocation` is null, this passes null for `next: AllocationMap` which TypeScript rejects (strict mode).
- **Fix:** Changed to `runContradictionCheck(prevAllocation, prevAllocation ?? {})` — empty object is safe since `prev=null` short-circuits before `next` is read.
- **Files modified:** pulse/src/lib/strategy/extractor.ts
- **Commit:** 9d59dc6

**5. [Rule 3 - Environment] No node_modules in worktree**
- **Found during:** Task 2 verification
- **Issue:** Worktree has no node_modules directory; tests couldn't run.
- **Fix:** Created Windows Junction from worktree's pulse/node_modules to main project's pulse/node_modules.
- **This junction is NOT committed** — it is a local filesystem link only.

## Pre-existing Test Failures (Out of Scope)

The following test failures existed before this plan and are unrelated to the extractor rewrite:
- `src/__tests__/ContributionCalculator.test.tsx` — setup error
- `src/__tests__/PortfolioTab.test.tsx` — 3 failures (Phase 8 price display)
- `src/lib/csv/__tests__/parser.test.ts` — 2 failures (broker detection)
- `src/app/dashboard/__tests__/price-actions.test.ts` — 1 failure (error message mismatch)

These are documented in `deferred-items.md` (pre-existing — not introduced by this plan).

## Known Stubs

- `tests/extractor.test.ts`: 3 `.todo` tests for full two-call integration (D-09 chunk count variation, $gte filter assertions, profile_latest null DB insert). Require Pinecone mock with configurable chunk return count. Marked for Wave 3 completion or manual follow-up.

## Threat Flags

No new threat surface beyond what was documented in the plan's threat register (T-11-03-01 through T-11-03-05).

## Self-Check: PASSED

- `pulse/src/lib/strategy/extractor.ts` — exists and contains `extract_creator_profile`, `CreatorProfile`, `PROFILE_TOOL_DEF`, `SYSTEM_PROMPT`, `latestChunks.length > 0`, `$gte`, `profile_stable`, `profile_latest`, `allocation: null`
- `pulse/tests/extractor-schema.test.ts` — exists; imports from `@/lib/strategy/extractor`
- `pulse/tests/extractor.test.ts` — exists; has `vi.mock('server-only')`
- Commit `9d59dc6` — Task 1 (extractor.ts rewrite)
- Commit `0d693c1` — Task 2 (tests)
- `contradiction.ts` — `git diff` shows zero changes (D-15 honoured)
