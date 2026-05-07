---
phase: 03-transcript-pipeline
plan: "02"
subsystem: infra-clients
tags: [phase-3, infra, server-only, singletons, external-clients]
dependency_graph:
  requires: [03-01]
  provides: [supabase-service-client, youtube-client, openai-client, pinecone-client]
  affects: [03-04, 03-05, 03-06]
tech_stack:
  added:
    - "@supabase/supabase-js createClient (service-role, no SSR cookie handling)"
    - "googleapis youtube_v3 (API key auth, read-only)"
    - "openai SDK (text-embedding-3-small, batch 100)"
    - "@pinecone-database/pinecone v7 (namespace per creator UUID)"
  patterns:
    - "Module-scoped singleton cache (let cached = null)"
    - "Env-guard with descriptive setup instructions in throw message"
    - "import 'server-only' as first line in all four modules"
key_files:
  modified:
    - pulse/src/lib/supabase/service.ts
  created:
    - pulse/src/lib/youtube/client.ts
    - pulse/src/lib/openai/client.ts
    - pulse/src/lib/pinecone/client.ts
decisions:
  - "supabase/service.ts updated to add singleton cache (was non-cached), add autoRefreshToken:false and detectSessionInUrl:false"
  - "youtube/client.ts implements 3-strategy channel resolution (direct UC, @handle, /c|user/); UC->UU uploads playlist trick for video listing"
  - "openai/client.ts batches 100 chunks per embeddings.create call; model text-embedding-3-small (1536-dim)"
  - "pinecone/client.ts namespaces by creatorId UUID string — matches creators.id PK for Phase 4 RAG scoping"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-07"
  tasks_completed: 4
  tasks_total: 4
  files_modified: 1
  files_created: 3
---

# Phase 3 Plan 02: External Client Singletons Summary

Four server-only singleton clients for the transcript pipeline: Supabase service-role, YouTube Data API v3, OpenAI embeddings, and Pinecone namespaced index — all following the env-guard + module-scoped cache pattern.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Verify/update lib/supabase/service.ts | 71a48dc | Updated (pre-existing, enhanced) |
| 2 | Create lib/youtube/client.ts | 16239c0 | Created |
| 3 | Create lib/openai/client.ts | 52d748f | Created |
| 4 | Create lib/pinecone/client.ts | b1a64a3 | Created |

## Files

### Modified
- `pulse/src/lib/supabase/service.ts` — Added singleton cache, `autoRefreshToken: false`, `detectSessionInUrl: false`; updated error message to canonical shape

### Created
- `pulse/src/lib/youtube/client.ts` — YouTube Data API v3 singleton + `resolveChannelId()` (3 strategies) + `listVideosLast12Months()` (UC→UU uploads playlist, stops at cutoff) + `VideoItem` interface
- `pulse/src/lib/openai/client.ts` — OpenAI singleton + `embedChunks()` (100-chunk batches, `text-embedding-3-small`)
- `pulse/src/lib/pinecone/client.ts` — Pinecone singleton + `getPineconeNamespace(creatorId)` scoped by creator UUID

## Verification

All 4 files:
- Start with `import 'server-only'` (build-time client bundle enforcement)
- Use non-`NEXT_PUBLIC_` env var names for API keys
- Compile with no errors under project `tsconfig.json` (`skipLibCheck: true`)
- Export exactly the interfaces required by the plan's success criteria

TypeScript project check: 2 pre-existing errors in `creator-actions.ts` (Phase 2, out of scope). Zero errors in any Phase 3 Plan 02 files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 1 was update, not no-op**
- **Found during:** Task 1
- **Issue:** Pre-existing `service.ts` was missing singleton cache, `autoRefreshToken: false`, and `detectSessionInUrl: false`. Error message was also slightly different from canonical shape.
- **Fix:** Updated file to match the exact canonical shape from PATTERNS.md Section 1 while preserving the `createServiceClient` export signature.
- **Files modified:** `pulse/src/lib/supabase/service.ts`
- **Commit:** 71a48dc

**2. [Rule 1 - Known limitation] Plan verify command bypasses tsconfig**
- **Found during:** Task 2 verification
- **Issue:** `npx tsc --noEmit src/lib/youtube/client.ts` (single-file invocation) bypasses project `tsconfig.json` including `skipLibCheck: true`, producing false positives from `googleapis` type declarations (private identifier syntax errors in node_modules).
- **Fix:** Used `npx tsc --noEmit` (full project) to verify. Zero errors in any of the 4 created/modified files.
- **Impact:** None — the plan's acceptance criteria all pass; build will succeed.

## Known Stubs

None — no placeholder values or UI components in this plan. All files are pure SDK clients.

## Threat Flags

No new trust boundary surface beyond what is documented in the plan's threat model. All four files are server-only, all keys are non-`NEXT_PUBLIC_`, error messages use generic "X is not set" copy (T-03-02-02 mitigated).

## Self-Check: PASSED

Files exist:
- pulse/src/lib/supabase/service.ts: FOUND
- pulse/src/lib/youtube/client.ts: FOUND
- pulse/src/lib/openai/client.ts: FOUND
- pulse/src/lib/pinecone/client.ts: FOUND

Commits exist:
- 71a48dc: FOUND (supabase/service.ts)
- 16239c0: FOUND (youtube/client.ts)
- 52d748f: FOUND (openai/client.ts)
- b1a64a3: FOUND (pinecone/client.ts)
