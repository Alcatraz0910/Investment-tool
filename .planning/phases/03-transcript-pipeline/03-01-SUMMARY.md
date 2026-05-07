---
phase: 03-transcript-pipeline
plan: "01"
subsystem: setup
tags: [phase-3, env, npm-install, sql-migration, pinecone, youtube, openai]
dependency_graph:
  requires: []
  provides:
    - pulse/.env.local.example (Phase 3 env var documentation)
    - .planning/phases/03-transcript-pipeline/migration.sql (Supabase DDL)
    - pulse/node_modules/googleapis (YouTube Data API v3 client)
    - pulse/node_modules/youtube-transcript (zero-quota transcript fetch)
    - pulse/node_modules/openai (embedding SDK)
    - pulse/node_modules/@pinecone-database/pinecone (vector store client)
    - pulse/node_modules/js-tiktoken (pure-JS token chunking)
  affects: []
tech_stack:
  added:
    - googleapis@^144.0.0
    - youtube-transcript@^1.3.1
    - openai@^6.36.0
    - "@pinecone-database/pinecone@^7.2.0"
    - js-tiktoken@^1.0.21
  patterns:
    - server-only env var naming (no NEXT_PUBLIC_ prefix for secrets)
    - idempotent SQL migrations (IF NOT EXISTS, ADD COLUMN IF NOT EXISTS)
    - RLS SELECT-only policy for service-role-write tables
key_files:
  created:
    - .planning/phases/03-transcript-pipeline/migration.sql
  modified:
    - pulse/.env.local.example
    - pulse/package.json
    - pulse/package-lock.json
decisions:
  - "All 5 Phase 3 keys use non-NEXT_PUBLIC_ prefix per RESEARCH.md Security Domain"
  - "js-tiktoken chosen over tiktoken (WASM) to avoid Next.js compatibility issues"
  - "refresh_jobs uses SELECT-only RLS; INSERT/UPDATE via service role only (D-12)"
  - "Pinecone index must be pre-created with dim=1536, metric=cosine (documented in Task 4 checkpoint)"
metrics:
  duration: "~10 minutes"
  completed_date: "2026-05-07"
  tasks_completed: 3
  tasks_total: 4
  files_created: 1
  files_modified: 3
---

# Phase 3 Plan 01: Setup & Prerequisites Summary

**One-liner:** Server-only env var documentation, 5 npm packages installed, and idempotent Supabase migration SQL authored — all Phase 3 infrastructure prerequisites ready except user-executed external service setup (Task 4 checkpoint).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Phase 3 env vars to .env.local.example | e7c7af6 | pulse/.env.local.example |
| 2 | Install Phase 3 npm packages | 9e1f27a | pulse/package.json, pulse/package-lock.json |
| 3 | Author migration.sql | b8555fd | .planning/phases/03-transcript-pipeline/migration.sql |

## Outcome

### Task 1 — .env.local.example
Five Phase 3 server-only env vars appended to `pulse/.env.local.example`:
- `YOUTUBE_API_KEY=` — YouTube Data API v3 (channel resolution + video listing)
- `OPENAI_API_KEY=` — OpenAI text-embedding-3-small
- `PINECONE_API_KEY=` — Pinecone vector store
- `PINECONE_INDEX_NAME=pulse-transcripts` — defaulted to the expected index name
- `SUPABASE_SERVICE_ROLE_KEY=` — service role for RLS-bypass writes (D-12)

None carry a `NEXT_PUBLIC_` prefix — Next.js will not bundle them into the client JS bundle (T-03-01-02 mitigated).

### Task 2 — npm packages
All 5 packages installed under `pulse/node_modules` and listed in `pulse/package.json` `dependencies`:

| Package | Version | Purpose |
|---------|---------|---------|
| googleapis | ^144.0.0 | YouTube Data API v3 (channels.list, playlistItems.list) |
| youtube-transcript | ^1.3.1 | Zero-quota transcript text fetching |
| openai | ^6.36.0 | text-embedding-3-small batch embeddings |
| @pinecone-database/pinecone | ^7.2.0 | Vector upsert, namespace scoping |
| js-tiktoken | ^1.0.21 | Token-aware chunking (pure JS, no WASM) |

`tiktoken` (WASM) deliberately excluded — compatibility issues in Next.js Edge runtime per RESEARCH.md Alternatives Considered.

### Task 3 — migration.sql
`migration.sql` created at `.planning/phases/03-transcript-pipeline/migration.sql` with two migrations:

1. **Migration 1 (D-11):** `ALTER TABLE public.user_creators ADD COLUMN IF NOT EXISTS last_refreshed_at TIMESTAMPTZ` — nullable, NULL = never refreshed, updated by API Route service role after pipeline completion.

2. **Migration 2 (RESEARCH Pattern 9):** `CREATE TABLE IF NOT EXISTS public.refresh_jobs` — tracks per-(user, creator) pipeline progress for client polling. Includes: status CHECK constraint (`running|done|error|idle`), UNIQUE(user_id, creator_id), RLS enabled, SELECT-only policy for `auth.uid() = user_id`. INSERT/UPDATE deliberately not exposed to authenticated role (service-role-only writes per D-12).

Both migrations are idempotent (IF NOT EXISTS, ADD COLUMN IF NOT EXISTS) — safe to re-run (T-03-01-03 mitigated).

## Deviations from Plan

None — plan executed exactly as written.

## Awaiting Human Action (Task 4)

Task 4 is a `checkpoint:human-action` gate. The user must complete:

1. **Run migration.sql in Supabase SQL Editor** — paste contents of `.planning/phases/03-transcript-pipeline/migration.sql` and run. Verify `last_refreshed_at` column on `user_creators` and `refresh_jobs` table with RLS enabled.

2. **Create Pinecone index** — name: `pulse-transcripts`, dimension: 1536, metric: cosine, type: Serverless, cloud: AWS, region: us-east-1. Wait until status = Ready.

3. **Populate pulse/.env.local** with all 5 keys (YOUTUBE_API_KEY, OPENAI_API_KEY, PINECONE_API_KEY, PINECONE_INDEX_NAME=pulse-transcripts, SUPABASE_SERVICE_ROLE_KEY).

4. **Confirm Vercel Pro plan** — pipeline runs synchronously for 30-120s; Hobby plan (10s limit) will time out. Pro plan required for `maxDuration = 300`.

## Known Stubs

None — this plan produces no stubs. All outputs are configuration/documentation/DDL with no placeholder data reaching UI rendering.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes beyond what the plan's threat model covers. `migration.sql` is DDL for user-applied migration only.

## Self-Check: PASSED

- pulse/.env.local.example contains all 5 Phase 3 env vars with no NEXT_PUBLIC_ prefix: VERIFIED
- pulse/package.json dependencies contains all 5 packages: VERIFIED (googleapis, youtube-transcript, openai, @pinecone-database/pinecone, js-tiktoken)
- .planning/phases/03-transcript-pipeline/migration.sql exists: VERIFIED
- migration.sql contains ADD COLUMN IF NOT EXISTS last_refreshed_at: VERIFIED
- migration.sql contains CREATE TABLE IF NOT EXISTS public.refresh_jobs: VERIFIED
- migration.sql contains ENABLE ROW LEVEL SECURITY: VERIFIED
- migration.sql contains auth.uid() = user_id: VERIFIED
- Commits e7c7af6, 9e1f27a, b8555fd exist: VERIFIED
