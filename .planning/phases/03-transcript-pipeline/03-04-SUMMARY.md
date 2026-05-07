---
phase: 03-transcript-pipeline
plan: "04"
subsystem: pipeline-orchestrator
tags: [phase-3, pipeline, orchestrator, idempotency, service-role, pinecone, embeddings]
dependency_graph:
  requires: [03-01, 03-02, 03-03]
  provides:
    - pulse/src/lib/pipeline/transcript-pipeline.ts (runRefreshPipeline orchestrator)
  affects: [03-05-api-route, 03-06-ui-refresh-button]
tech_stack:
  added: []
  patterns:
    - "AnySupabase cast pattern — untyped Supabase client via (svc as any) for no-generated-types projects"
    - "Sequential for-loop transcript fetch (no Promise.all) — YouTube informal rate limit defence"
    - "setStep() helper — upserts refresh_jobs step/status before each major phase for poller"
    - "Deterministic Pinecone vector IDs: ${videoId}-chunk-${idx} — upsert idempotency by ID"
    - "Application-layer idempotency flag: is_embedded guards re-processing (D-07)"
key_files:
  created:
    - pulse/src/lib/pipeline/transcript-pipeline.ts
  modified: []
decisions:
  - "Used (svc as any) cast rather than generated Database types — consistent with pre-existing creator-actions.ts pattern in this codebase; zero new TS errors introduced"
  - "Pinecone ns.upsert cast to (ns as any) — SDK v7 type mismatch between RecordMetadata array and UpsertOptions; runtime behavior is correct per SDK docs"
  - "setStep() extracted as module-private helper to deduplicate 7 refresh_jobs upsert call sites"
  - "D-08 retries handled in Step 6 (post-loop embed query) not in Step 5 — avoids double-counting fetchedOk; existing raw_text rows count toward fetchedOk in Step 5"
metrics:
  duration: "~20 minutes"
  completed_date: "2026-05-07"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 3 Plan 04: Transcript Pipeline Orchestrator Summary

**One-liner:** Sequential 8-step pipeline orchestrator with D-07/08/09/10 idempotency, per-video transcript-fetch try/catch (D-04), Pinecone batch upsert with deterministic vector IDs, and refresh_jobs step tracking for client-side polling.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create transcript-pipeline.ts with full 9-step orchestrator | 0ceb982 | pulse/src/lib/pipeline/transcript-pipeline.ts |

## File

### Created

**`pulse/src/lib/pipeline/transcript-pipeline.ts`** — 323 lines

Exports:
- `runRefreshPipeline(creatorId: string, userId: string): Promise<PipelineResult>`
- `interface PipelineResult { summary: string; fetched: number; total: number; pending: number }`

Imports from Wave 1/2/3:
- `youtube-transcript` — YoutubeTranscript.fetchTranscript
- `@/lib/supabase/service` — createServiceClient
- `@/lib/youtube/client` — resolveChannelId, listVideosLast12Months, VideoItem
- `@/lib/openai/client` — embedChunks
- `@/lib/pinecone/client` — getPineconeNamespace
- `@/lib/pipeline/chunker` — chunkText

## Idempotency Rule Mapping

| Rule | Code Location | Behaviour |
|------|---------------|-----------|
| D-07 | Step 5 loop, `if (existing && existing.is_embedded)` | Skip entirely — no re-fetch, no re-embed; count as fetchedOk |
| D-08 | Step 5 loop, `if (existing && existing.raw_text != null)` | Skip fetch, count as fetchedOk; Step 6 query picks up for embedding |
| D-09 | Step 5 loop, falls through to fetch (existing row, raw_text null) | Retry fetch; upsert updates raw_text via `onConflict: 'video_id'` |
| D-10 | Step 5 loop, falls through to fetch (no existing row) | Fresh fetch and insert via `onConflict: 'video_id'` |
| D-04 | Per-video try/catch around YoutubeTranscript.fetchTranscript | Failure → rawText=null → upsert row with raw_text=NULL; pipeline continues |
| D-12 | Step 7, `user_creators.update({ last_refreshed_at })` | Service-role update scoped to (user_id, creator_id) |
| D-13 | Step 3, `if (!channelId) resolveChannelId(...)` | Resolves via YouTube API and writes back to creators.channel_id |

## Threat Mitigations Applied

| ID | Mitigation |
|----|------------|
| T-03-04-01 | `user_creators` update filtered by `.eq('user_id', userId).eq('creator_id', creatorId)` |
| T-03-04-02 | All `transcripts` upserts use `{ onConflict: 'video_id' }` |
| T-03-04-03 | Deterministic vector IDs `${videoId}-chunk-${idx}`; is_embedded flag prevents re-processing |
| T-03-04-04 | Per-video try/catch with NULL fallback; hard DB errors still abort |
| T-03-04-05 | Sequential `for` loop — no `Promise.all` over transcript fetches |
| T-03-04-06 | Outer try/catch writes status='error' before re-throw; inner catch swallows secondary failures |

## TypeScript Compile Status

`npx tsc --noEmit` from `pulse/` directory:
- **0 errors** from `transcript-pipeline.ts`
- 2 pre-existing errors in `creator-actions.ts` (Phase 2, out of scope — same `never` type issue from missing Supabase generated types)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Supabase `never` type errors from untyped service client**
- **Found during:** Task 1 verification (tsc run)
- **Issue:** `createServiceClient()` without Database generic types causes `.from()` to return `never` in strict TypeScript. This produces TS2353/TS2339 errors on all table access. Same root cause as the 2 pre-existing errors in `creator-actions.ts`.
- **Fix:** Cast the service client to `AnySupabase = any` at the call site. Added explanatory comment documenting this is consistent with the project's existing pattern.
- **Files modified:** `pulse/src/lib/pipeline/transcript-pipeline.ts`
- **Commit:** 0ceb982 (same task commit)

**2. [Rule 1 - Bug] Pinecone SDK v7 `ns.upsert()` type mismatch**
- **Found during:** Task 1 verification (tsc run)
- **Issue:** `@pinecone-database/pinecone` v7 `Index.upsert()` TypeScript signature expects `UpsertOptions<RecordMetadata>` (an object with a `records` key) but the runtime API accepts a plain array. The type definition diverges from the documented usage.
- **Fix:** Cast `ns` to `any` at the upsert call site. Added comment explaining the SDK v7 type mismatch. Runtime behavior is correct per Pinecone SDK v7 docs.
- **Files modified:** `pulse/src/lib/pipeline/transcript-pipeline.ts`
- **Commit:** 0ceb982 (same task commit)

**3. [Rule 1 - Bug] Multi-line import failed acceptance criterion grep**
- **Found during:** Task 1 verification (acceptance criteria check)
- **Issue:** `import { resolveChannelId, listVideosLast12Months, type VideoItem }` was split across 4 lines; the acceptance criterion grep checks for the string `import { resolveChannelId, listVideosLast12Months` on a single line.
- **Fix:** Collapsed to single-line import.
- **Files modified:** `pulse/src/lib/pipeline/transcript-pipeline.ts`
- **Commit:** 0ceb982 (same task commit)

## Known Stubs

None — this is a pure orchestrator with no UI rendering. All data flows to Supabase/Pinecone via live API calls. No hardcoded values in the data path.

## Threat Flags

None — all network calls are outbound via existing SDK clients (YouTube, OpenAI, Pinecone). No new HTTP endpoints, auth paths, or schema changes introduced by this file.

## Self-Check: PASSED

- [x] `pulse/src/lib/pipeline/transcript-pipeline.ts` exists (323 lines)
- [x] Commit `0ceb982` exists in git log
- [x] All 19 acceptance criteria grep checks pass
- [x] TypeScript: 0 errors from transcript-pipeline.ts under project tsconfig
