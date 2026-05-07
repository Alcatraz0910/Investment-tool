# Phase 3: Transcript Pipeline - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the transcript ingestion pipeline: for each tracked creator, resolve their YouTube channel ID, fetch all videos from the last 12 months, store raw transcript text in Supabase, chunk and embed into Pinecone — and expose a per-creator Refresh button in the Creators tab that drives the whole flow.

Phase ends when TRANS-01 through TRANS-05 pass and all 4 success criteria are met.

**Out of scope for Phase 3:**
- Strategy extraction or AI analysis of transcripts (Phase 4)
- Trust weight sliders or blending (Phase 4)
- Plan/Buy List generation (Phase 5)
- Premium glassmorphism UI system (Phase 6)
- Background jobs or automated refresh scheduling (v1 is manual-only)

</domain>

<decisions>
## Implementation Decisions

### Refresh Architecture
- **D-01:** Pipeline runs in a Next.js API Route (`POST /api/refresh/[creatorId]`). Not a Server Action — avoids Vercel function timeout constraints for long-running ops (30–120s). Route is authenticated (verifies user session before executing).
- **D-02:** While refreshing, the Creators tab shows a spinner on the [Refresh] button + a step status line below it. The client polls the API Route every 2 seconds and updates the status inline: e.g., "Fetching videos... 12/12", "Embedding chunks... 8/12 videos". Status disappears on completion or error.
- **D-03:** The [Refresh] button lives inline on each tracked creator row in the Creators tab (extends the Phase 2 creator row layout). Clicking one creator's button does not affect other rows.

### Missing Transcripts
- **D-04:** When `youtube-transcript` fails to fetch a video's transcript, insert a `transcripts` row with `raw_text = NULL`. Do not skip the row — the record is needed for retry tracking on subsequent refreshes. Final status summary shows total fetched vs attempted (e.g., "10/12 transcripts fetched, 2 pending retry").
- **D-05:** YouTube API errors (including quota exhaustion) are treated as generic pipeline errors: abort the current refresh, display an error message to the user ("YouTube API error — partial progress saved"), and preserve any transcripts already fetched in this run. Quota is not a practical concern (~3–5 units per creator vs 10,000/day free limit — transcript fetching via `youtube-transcript` npm uses zero API quota).

### Transcript List UI
- **D-06:** Each creator row has an expand/collapse toggle showing a list of that creator's fetched transcripts. Columns: **Title | Published date | Status**. Status chip values: "Embedded" (`is_embedded = TRUE`), "Fetched" (`raw_text IS NOT NULL`, `is_embedded = FALSE`), "Pending" (`raw_text IS NULL`). Lives in the Creators tab, below the [Refresh] button.

### Re-refresh Idempotency
- **D-07:** On re-refresh, videos with `is_embedded = TRUE` are skipped entirely — no re-fetch, no re-embed.
- **D-08:** Videos with `raw_text IS NOT NULL` AND `is_embedded = FALSE` have embedding re-attempted (auto-heals partial pipeline failures without re-fetching transcript text).
- **D-09:** Videos with `raw_text IS NULL` (null records from prior failed fetches) have transcript fetch re-attempted.
- **D-10:** New videos not yet in the `transcripts` table (published within 12 months, not previously seen) are always fetched and embedded.

### Schema Addition — `last_refreshed_at`
- **D-11:** Add `last_refreshed_at TIMESTAMPTZ` column to `user_creators` table. This was missed in Phase 1 schema (D-05). Required for TRANS-05. The plan must include a SQL migration snippet to be run via Supabase SQL editor (D-03 compliant). Column is nullable; NULL means "never refreshed".
- **D-12:** The refresh API Route uses `SUPABASE_SERVICE_ROLE_KEY` (service role Supabase client) to update `user_creators.last_refreshed_at` after successful pipeline completion. Bypasses RLS — consistent with the existing transcripts INSERT/UPDATE pattern.

### Channel ID Resolution
- **D-13:** `creators.channel_id` is nullable in seed data. On first refresh for a creator, if `channel_id` is NULL, the pipeline resolves it via YouTube API (`channels.list` by URL or handle). Once resolved, it is stored back to `creators.channel_id` via service role. Subsequent refreshes use the stored `channel_id` directly.

### Claude's Discretion
- Polling interval for step status updates (suggested: 2s, but executor may tune based on UX feel).
- Pinecone chunk size (~500 tokens as specified in ROADMAP.md) and overlap amount.
- Pinecone vector metadata schema: minimum fields are `creator_id`, `video_id`, `title`, `chunk_index`, `published_at` — executor may add others.
- Pinecone namespace key format (ROADMAP.md says "keyed by creator ID" — executor picks exact string format).
- Error message copy for UI error states.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Requirements
- `.planning/ROADMAP.md` §Phase 3 — Plans (4 tasks), success criteria (4 criteria), tech choices (YouTube Data API v3, `youtube-transcript` npm, OpenAI `text-embedding-3-small`, Pinecone)
- `.planning/REQUIREMENTS.md` §Transcript Pipeline — TRANS-01 through TRANS-05 (full requirement text)
- `.planning/PROJECT.md` — Tech stack, key decisions, out-of-scope items

### Critical Constraints
- `CLAUDE.md` §Critical Constraints — no "advice/recommend/suggest" language, ISA tax year (6 Apr–5 Apr), `decimal.js` for £ arithmetic, manual-first v1, RAG pattern (never send full transcripts to Claude)

### Schema
- `.planning/phases/01-foundation/schema.sql` — Full DB schema. `transcripts` table (Table 6): `creator_id`, `video_id` (UNIQUE), `title`, `published_at`, `raw_text`, `word_count`, `is_embedded`, `last_fetched`. `creators` table (Table 2): `channel_id TEXT` (nullable, populated in Phase 3). `user_creators` table (Table 3): needs `last_refreshed_at TIMESTAMPTZ` added via SQL editor (D-11).

### Phase 1 & 2 Decisions
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-03 (no CLI migrations), D-04 (JSONB allocation), D-05 (no new columns without discussion — D-11 is the approved exception)
- `.planning/phases/02-portfolio-creator-management/02-CONTEXT.md` — D-12/D-13 (Creators tab layout: two sections — browse + custom), established Creators tab row structure that Phase 3 extends with [Refresh] button and expand toggle

### Existing Code (read before planning)
- `pulse/src/types/index.ts` — `Creator`, `UserCreator`, `Transcript` types (hand-written, import via `@/types`)
- `pulse/src/lib/supabase/server.ts` — `createClient()` for authenticated server components
- `pulse/src/app/auth/login/actions.ts` — canonical server action pattern
- `pulse/src/app/dashboard/page.tsx` — dashboard entry point; Creators tab implemented in Phase 2

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@/types` — `Creator`, `UserCreator` already typed; `Transcript` type likely defined (check `pulse/src/types/index.ts`)
- `pulse/src/lib/supabase/server.ts` → `createClient()` — use in API Route and server components
- Phase 2 Creators tab row component — extends with [Refresh] button (D-03) and expand toggle (D-06)
- `SUPABASE_SERVICE_ROLE_KEY` env var — already present (used by seed script pattern); use for service role client in API Route

### Established Patterns
- **Server components for data fetching:** `async function Page()` with `getUser()` auth check — apply to transcript list display
- **Server actions for mutations:** co-located `actions.ts` files — Phase 3 uses API Route instead (D-01), but the auth-check-first pattern still applies
- **Dark zinc theme:** `bg-zinc-900` / `bg-zinc-800 border border-zinc-700 rounded-xl` — apply to expand/collapse transcript list
- **Status chips:** Follow Phase 2 patterns for inline badges (Tracking / Untracking) — use same visual language for Embedded / Fetched / Pending chips

### Integration Points
- `user_creators` table — Phase 3 adds `last_refreshed_at` column and updates it after each refresh
- `creators` table — Phase 3 populates `channel_id` on first refresh (service role write)
- `transcripts` table — Phase 3 owns all INSERT/UPDATE operations (service role, no authenticated policy)
- Pinecone index — Phase 3 creates all vectors; Phase 4 queries them. Namespace = creator ID. Must be queryable by creator ID for Phase 4 RAG.
- `@/types` — Phase 3 may need to update `UserCreator` type to include `last_refreshed_at`

</code_context>

<specifics>
## Specific Ideas

- **Step status format the user approved:** "Fetching videos... 12/12", "Embedding chunks... 8/12 videos" — plain text status line below [Refresh] button, polled every 2s.
- **Transcript list columns the user approved:** Title | Published date | Status chip (Embedded / Fetched / Pending)
- **Failure summary the user approved:** "10/12 transcripts fetched, 2 pending retry" — shown after refresh completes with partial failures.
- **Channel ID resolution:** Must be automatic on first refresh (not manual admin step). Admin seed data only has channel URLs; channel IDs are resolved programmatically.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 3-Transcript Pipeline*
*Context gathered: 2026-05-07*
