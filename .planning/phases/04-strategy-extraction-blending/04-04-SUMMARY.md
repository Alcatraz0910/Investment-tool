---
phase: 4
plan: "04-04"
subsystem: refresh-route-extraction-and-blend-weights
tags: [refresh-route, server-action, vitest, BLEND-01, D-01, D-02, supabase-service-client, vi-hoisted]
dependency_graph:
  requires:
    - "extractCreatorStrategy() function (04-02)"
    - "runRefreshPipeline() function (Phase 3)"
    - "user_creator_category_weights table (Phase 1 schema)"
    - "createServiceClient() (Phase 3)"
    - "vitest configured with @/ alias (04-01)"
  provides:
    - "POST /api/refresh/[creatorId] auto-extracts strategy after pipeline (D-01/D-02)"
    - "saveCreatorWeight() server action (BLEND-01)"
    - "5 passing tests for BLEND-01"
  affects:
    - "pulse/src/app/api/refresh/[creatorId]/route.ts"
    - "pulse/src/app/dashboard/actions.ts"
    - "pulse/src/app/dashboard/actions.test.ts"
tech_stack:
  added: []
  patterns:
    - "D-02 non-blocking extraction: inner try/catch inside outer pipeline try/catch — extraction failure returns 200 with extractionStatus:warning"
    - "vi.hoisted() for module-level mock refs in vitest (avoids Cannot access before initialization on hoisted vi.mock)"
    - "createClient() for auth check + createServiceClient() for write (Pattern 7: bypass RLS for service writes)"
    - "Pitfall 6: upsert with onConflict:'user_creator_id,category' — idempotent on rapid slider releases"
key_files:
  created: []
  modified:
    - pulse/src/app/api/refresh/[creatorId]/route.ts
    - pulse/src/app/dashboard/actions.ts
    - pulse/src/app/dashboard/actions.test.ts
decisions:
  - "vi.hoisted() required instead of top-level const for mock refs in test files with vi.mock factory closures — vi.mock is hoisted above const declarations"
  - "mockCreateClient reset in beforeEach (not just clearAllMocks) to restore default authenticated user between tests"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-07"
  tasks_completed: 3
  tasks_total: 3
---

# Phase 4 Plan 04: Refresh Route Extraction Integration & saveCreatorWeight Summary

**One-liner:** Extended refresh route calls extractCreatorStrategy post-pipeline with non-blocking D-02 error handling, and saveCreatorWeight server action upserts per-category or global trust weights — 5 BLEND-01 tests green using vi.hoisted() mock pattern.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 04-04-01 | Extend refresh route with extractCreatorStrategy (D-01/D-02) | 072a6fe | pulse/src/app/api/refresh/[creatorId]/route.ts |
| 04-04-02 | Add saveCreatorWeight server action (BLEND-01) | 9c48ae1 | pulse/src/app/dashboard/actions.ts |
| 04-04-03 | Implement BLEND-01 unit tests for saveCreatorWeight | 1d46d29 | pulse/src/app/dashboard/actions.test.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vi.hoisted() required for mockCreateClient in test mock factory**
- **Found during:** Task 04-04-03 (first test run)
- **Issue:** Plan specified `vi.mocked(createClient).mockResolvedValueOnce(...)` pattern (same as the extractor.test.ts approach from 04-02). However, actions.test.ts uses `vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))` — the factory references `mockCreateClient` which is hoisted above const declarations by vitest's transform, causing `ReferenceError: Cannot access 'mockCreateClient' before initialization`.
- **Fix:** Moved all mock refs into `vi.hoisted()` call: `const { mockUpdate, mockUpsert, mockCreateClient } = vi.hoisted(() => { ... })`. Also updated the auth-failure test to call `mockCreateClient.mockResolvedValueOnce()` directly rather than re-importing via `vi.mocked()`.
- **Files modified:** pulse/src/app/dashboard/actions.test.ts
- **Commit:** 1d46d29

## must_haves Verification

| Must-have | Status |
|-----------|--------|
| `route.ts` imports `extractCreatorStrategy` from `@/lib/strategy/extractor` | PASS |
| `route.ts` calls `await extractCreatorStrategy(creatorId, user.id)` inside inner try/catch | PASS |
| `route.ts` extraction catch sets `extractionStatus: 'warning'` | PASS |
| `route.ts` extraction catch sets `extractionWarning: 'Transcripts refreshed...'` message | PASS |
| `route.ts` 200 response includes `extractionStatus` field | PASS |
| `route.ts` pipeline error catch still returns 500 (extraction never reaches it) | PASS |
| `actions.ts` exports `saveCreatorWeight` | PASS |
| `actions.ts` imports `createServiceClient` from `@/lib/supabase/service` | PASS |
| `actions.ts` category=null path updates `user_creators` | PASS |
| `actions.ts` category=string path upserts `user_creator_category_weights` with `onConflict:'user_creator_id,category'` | PASS |
| All BLEND-01 tests green (5/5) | PASS |
| Full vitest suite green | PASS (34 passed, 0 failed) |
| `npx tsc --noEmit` exits 0 (no new errors) | PASS |

## Threat Coverage

| Threat ID | Disposition | Implementation |
|-----------|-------------|----------------|
| T-04-04-01 | mitigated | `createClient().auth.getUser()` check before any write; unauthenticated returns error string |
| T-04-04-02 | mitigated | `weight < 0 || weight > 100` server-side check; DB CHECK constraint as defence-in-depth |
| T-04-04-03 | mitigated | Extraction exception logged server-side via `console.warn`; client receives generic string only |
| T-04-04-04 | accepted | RLS on `user_creator_category_weights` requires `user_creator.user_id = auth.uid()` — row-level enforcement |

## Known Stubs

None — all plan goals achieved.

## Self-Check: PASSED

- pulse/src/app/api/refresh/[creatorId]/route.ts: FOUND
- pulse/src/app/dashboard/actions.ts: FOUND (saveCreatorWeight exported)
- pulse/src/app/dashboard/actions.test.ts: FOUND (5 tests, 0 todos)
- Commit 072a6fe: present in git log
- Commit 9c48ae1: present in git log
- Commit 1d46d29: present in git log
