---
phase: 03-transcript-pipeline
plan: "05"
subsystem: api
tags: [phase-3, api-route, auth-guard, polling, max-duration]
dependency_graph:
  requires: [03-04]
  provides: [POST /api/refresh/[creatorId], GET /api/refresh/[creatorId]]
  affects: [03-06-refresh-button-ui]
tech_stack:
  added: []
  patterns: [auth-first-guard, defence-in-depth-scoping, uuid-validation, rls-scoped-get]
key_files:
  created:
    - pulse/src/app/api/refresh/[creatorId]/route.ts
  modified: []
decisions:
  - "POST handler awaits pipeline synchronously (safer than fire-and-forget on Vercel per RESEARCH Pattern 2 note)"
  - "UUID validation runs BEFORE auth check to short-circuit malformed params cheaply"
  - "defence-in-depth .eq(user_id) applied to both POST ownership check and GET refresh_jobs read"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-07"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 3 Plan 05: Refresh API Route Summary

**One-liner:** Next.js 15 API route with POST (pipeline trigger, 401/400/403/500 guards) and GET (RLS-scoped refresh_jobs poll) plus maxDuration=300.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create POST + GET handlers in api/refresh/[creatorId]/route.ts | ec2904c | pulse/src/app/api/refresh/[creatorId]/route.ts |

## Implementation Notes

**Route:** `pulse/src/app/api/refresh/[creatorId]/route.ts` — 125 lines.

**POST handler order:**
1. `await params` — Next.js 15 async params (T-03-05-08)
2. UUID_RE validation → 400 on mismatch (T-03-05-02)
3. `createClient()` + `auth.getUser()` → 401 if no user (T-03-05-01)
4. `user_creators` ownership check + `.eq('user_id', user.id)` → 403 if not tracked (T-03-05-03)
5. `await runRefreshPipeline(creatorId, user.id)` → 200 with summary (T-03-05-06)
6. Catch-all → 500 with D-05 copy `'YouTube API error — partial progress saved'` (T-03-05-04)

**GET handler order:**
1. `await params` + UUID_RE → 400
2. `auth.getUser()` → 401
3. RLS-scoped `.from('refresh_jobs').eq('user_id', user.id).eq('creator_id', creatorId).maybeSingle()`
4. Returns `{status, step, summary, error}` or `{status:'idle', step:null, summary:null, error:null}` (T-03-05-07)

**Key constants:**
- `export const maxDuration = 300` — declared at module top (RESEARCH Pitfall 1, T-03-05-06)
- `UUID_RE` — `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`

## Deviations from Plan

None - plan executed exactly as written.

## Acceptance Criteria Verification

| Criterion | Status |
|-----------|--------|
| File exists at pulse/src/app/api/refresh/[creatorId]/route.ts | PASS |
| `export const maxDuration = 300` present | PASS |
| `export async function POST` present | PASS |
| `export async function GET` present | PASS |
| `import { runRefreshPipeline }` from pipeline | PASS |
| `import { createClient }` from supabase/server | PASS |
| `auth.getUser()` used (not getSession) | PASS |
| `from('user_creators')` + `.eq('user_id', user.id)` | PASS |
| `await runRefreshPipeline(creatorId, user.id)` | PASS |
| D-05 copy `'YouTube API error — partial progress saved'` | PASS |
| `from('refresh_jobs')` + `.eq('user_id', user.id)` in GET | PASS |
| `'idle'` default response when no row | PASS |
| UUID_RE regex constant present | PASS |
| Status codes 401, 403, 400, 500 all present | PASS |
| `npx tsc --noEmit` produces no error TS in route file | PASS |

## Known Stubs

None.

## Threat Flags

None — all STRIDE mitigations from plan's threat_model are implemented inline.

## Self-Check: PASSED

- File `pulse/src/app/api/refresh/[creatorId]/route.ts` exists: FOUND
- Commit `ec2904c` exists: FOUND
