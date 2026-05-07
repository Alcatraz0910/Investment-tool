---
phase: 3
slug: transcript-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-07
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no test framework configured in project (no jest.config.*, vitest.config.*, or test script in package.json) |
| **Config file** | none — Wave 0 has no test setup (manual-verify project) |
| **Quick run command** | `cd pulse && npm run build` — TypeScript compilation only |
| **Full suite command** | `cd pulse && npm run build && npm run lint` |
| **Estimated runtime** | ~15–30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd pulse && npm run build` — confirm no TypeScript errors introduced
- **After every plan wave:** Run `cd pulse && npm run build && npm run lint`
- **Before `/gsd-verify-work`:** Full build + manual smoke tests against running app (see Manual-Only Verifications)
- **Max feedback latency:** 30 seconds (build) + manual smoke time

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-00-env | 00 | 0 | TRANS-01/03 | — | env vars server-only (no NEXT_PUBLIC_ prefix) | manual | — | ❌ W0 | ⬜ pending |
| 3-00-pinecone | 00 | 0 | TRANS-03 | — | index created with correct dims/metric | manual | — | ❌ W0 | ⬜ pending |
| 3-00-migration | 00 | 0 | TRANS-05 | — | last_refreshed_at + refresh_jobs exist in Supabase | manual | — | ❌ W0 | ⬜ pending |
| 3-01-service | 01 | 1 | TRANS-01 | T-3-01 | service role key not in client bundle | build | `npm run build` | ❌ W0 | ⬜ pending |
| 3-01-youtube | 01 | 1 | TRANS-01 | T-3-02 | API key server-only | build | `npm run build` | ❌ W0 | ⬜ pending |
| 3-01-pipeline | 01 | 1 | TRANS-01/02 | T-3-03 | auth check before pipeline execution | manual | — | ❌ W0 | ⬜ pending |
| 3-02-embed | 02 | 1 | TRANS-03 | — | chunks ≤ 500 tokens before embed | build | `npm run build` | ❌ W0 | ⬜ pending |
| 3-02-pinecone | 02 | 1 | TRANS-03 | — | namespace = creatorId UUID | build | `npm run build` | ❌ W0 | ⬜ pending |
| 3-03-api-route | 03 | 1 | TRANS-04 | T-3-04 | creatorId UUID validated; user owns creator | build | `npm run build` | ❌ W0 | ⬜ pending |
| 3-03-idempotency | 03 | 1 | TRANS-04 | — | D-07/08/09/10 rules in pipeline logic | manual | — | ❌ W0 | ⬜ pending |
| 3-04-ui-refresh | 04 | 2 | TRANS-04/05 | — | spinner/step status display | manual | — | ❌ W0 | ⬜ pending |
| 3-04-transcript-list | 04 | 2 | TRANS-05 | — | Embedded/Fetched/Pending chips correct | manual | — | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No automated test framework — Wave 0 focuses on infrastructure setup (not test stubs):

- [ ] `.env.local` — add `YOUTUBE_API_KEY`, `OPENAI_API_KEY`, `PINECONE_API_KEY`, `PINECONE_INDEX_NAME`
- [ ] Pinecone dashboard — create index `pulse-transcripts` (dimension=1536, metric=cosine, serverless AWS us-east-1)
- [ ] Supabase SQL Editor — run migration: `ALTER TABLE public.user_creators ADD COLUMN IF NOT EXISTS last_refreshed_at TIMESTAMPTZ`
- [ ] Supabase SQL Editor — create `refresh_jobs` table (full SQL in RESEARCH.md Pattern 9)

*All Wave 0 items are manual infrastructure setup; no test file generation needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Videos from last 12 months fetched | TRANS-01 | No test framework; requires live YouTube API + real creator | Trigger Refresh on tracked creator; query `SELECT count(*) FROM transcripts WHERE creator_id = '{id}'` |
| Transcripts stored with all required fields | TRANS-02 | Requires live API call | Query `SELECT creator_id, video_id, title, published_at FROM transcripts WHERE creator_id = '{id}' LIMIT 5` — all fields non-null |
| Chunks embedded and in Pinecone | TRANS-03 | External service; no test harness | Pinecone console → query namespace = creator UUID → verify vectors present with correct metadata |
| Re-refresh is idempotent | TRANS-04 | Requires live run | Run Refresh twice on same creator; row count in `transcripts` must not increase; `is_embedded=TRUE` rows not re-processed |
| last_refreshed_at updated and displayed | TRANS-05 | UI + DB verification | After Refresh: check `user_creators.last_refreshed_at IS NOT NULL`; verify UI shows timestamp on creator row |
| Pipeline aborts cleanly on YouTube API error | TRANS-01 (error path) | Requires error injection | Pass invalid API key temporarily; verify "YouTube API error — partial progress saved" message in UI |
| NULL row inserted for transcript-unavailable video | TRANS-01/02 (D-04) | Requires video without captions | Identify a video with disabled captions; verify `raw_text IS NULL` row exists after refresh |
| Progress status updates during refresh | TRANS-04 (D-02) | UI behavior | Watch Creators tab during Refresh; verify step labels update (e.g., "Fetching videos... 6/12") |
| Expand/collapse shows correct status chips | TRANS-05 (D-06) | UI behavior | After Refresh: expand creator row; verify Embedded/Fetched/Pending chips match Supabase state |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify (build check) or documented manual verification
- [ ] TypeScript build passes after each wave (primary automated gate)
- [ ] Wave 0 env/infrastructure items verified before Wave 1 implementation begins
- [ ] No watch-mode flags used in verification commands
- [ ] Feedback latency: build check ≤ 30s; full manual smoke ≤ 10 min
- [ ] `nyquist_compliant: true` set in frontmatter after verification passes

**Approval:** pending
