# Phase 3: Transcript Pipeline - Research

**Researched:** 2026-05-07
**Domain:** YouTube Data API v3, youtube-transcript npm, OpenAI Embeddings, Pinecone Vector DB, Next.js 15 API Routes
**Confidence:** HIGH (core stack), MEDIUM (youtube-transcript reliability, progress tracking approach)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Pipeline runs in a Next.js API Route (`POST /api/refresh/[creatorId]`). Not a Server Action — avoids Vercel function timeout constraints for long-running ops (30–120s). Route is authenticated (verifies user session before executing).
- **D-02:** While refreshing, the Creators tab shows a spinner on the [Refresh] button + a step status line below it. The client polls the API Route every 2 seconds and updates the status inline: e.g., "Fetching videos... 12/12", "Embedding chunks... 8/12 videos". Status disappears on completion or error.
- **D-03:** The [Refresh] button lives inline on each tracked creator row in the Creators tab (extends the Phase 2 creator row layout). Clicking one creator's button does not affect other rows.
- **D-04:** When `youtube-transcript` fails to fetch a video's transcript, insert a `transcripts` row with `raw_text = NULL`. Do not skip the row — the record is needed for retry tracking on subsequent refreshes. Final status summary shows total fetched vs attempted (e.g., "10/12 transcripts fetched, 2 pending retry").
- **D-05:** YouTube API errors (including quota exhaustion) are treated as generic pipeline errors: abort the current refresh, display an error message to the user ("YouTube API error — partial progress saved"), and preserve any transcripts already fetched in this run. Quota is not a practical concern (~3–5 units per creator vs 10,000/day free limit — transcript fetching via `youtube-transcript` npm uses zero API quota).
- **D-06:** Each creator row has an expand/collapse toggle showing a list of that creator's fetched transcripts. Columns: **Title | Published date | Status**. Status chip values: "Embedded" (`is_embedded = TRUE`), "Fetched" (`raw_text IS NOT NULL`, `is_embedded = FALSE`), "Pending" (`raw_text IS NULL`). Lives in the Creators tab, below the [Refresh] button.
- **D-07:** On re-refresh, videos with `is_embedded = TRUE` are skipped entirely — no re-fetch, no re-embed.
- **D-08:** Videos with `raw_text IS NOT NULL` AND `is_embedded = FALSE` have embedding re-attempted (auto-heals partial pipeline failures without re-fetching transcript text).
- **D-09:** Videos with `raw_text IS NULL` (null records from prior failed fetches) have transcript fetch re-attempted.
- **D-10:** New videos not yet in the `transcripts` table (published within 12 months, not previously seen) are always fetched and embedded.
- **D-11:** Add `last_refreshed_at TIMESTAMPTZ` column to `user_creators` table via SQL migration snippet run via Supabase SQL editor. Column is nullable; NULL means "never refreshed".
- **D-12:** The refresh API Route uses `SUPABASE_SERVICE_ROLE_KEY` (service role Supabase client) to update `user_creators.last_refreshed_at` after successful pipeline completion. Bypasses RLS — consistent with the existing transcripts INSERT/UPDATE pattern.
- **D-13:** `creators.channel_id` is nullable in seed data. On first refresh for a creator, if `channel_id` is NULL, the pipeline resolves it via YouTube API (`channels.list` by URL or handle). Once resolved, it is stored back to `creators.channel_id` via service role. Subsequent refreshes use the stored `channel_id` directly.

### Claude's Discretion

- Polling interval for step status updates (suggested: 2s, but executor may tune based on UX feel).
- Pinecone chunk size (~500 tokens) and overlap amount.
- Pinecone vector metadata schema: minimum fields are `creator_id`, `video_id`, `title`, `chunk_index`, `published_at` — executor may add others.
- Pinecone namespace key format (ROADMAP.md says "keyed by creator ID" — executor picks exact string format).
- Error message copy for UI error states.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRANS-01 | For each tracked creator, fetch transcripts for all videos published in the last 12 months (YouTube Data API v3 + `youtube-transcript` npm package as fallback to preserve quota) | YouTube Data API playlistItems.list (1 unit per 50 videos); youtube-transcript npm for text (zero quota); channel ID resolution via channels.list |
| TRANS-02 | Transcripts stored in Supabase with creator ID, video ID, title, and published date | Schema already exists (`transcripts` table); service role client for INSERT/UPDATE; UPSERT on `video_id` for idempotency |
| TRANS-03 | Transcript chunks embedded (OpenAI `text-embedding-3-small`) and stored in Pinecone with creator/video metadata keys | js-tiktoken for chunking; OpenAI SDK v6; Pinecone SDK v7; namespace per creator ID |
| TRANS-04 | Manual "Refresh" button per creator triggers re-fetch and re-embedding of new videos | Next.js API Route + client-side polling; idempotency rules D-07/D-08/D-09/D-10 |
| TRANS-05 | Last-refreshed timestamp displayed per creator on the dashboard | `last_refreshed_at` column added via SQL migration (D-11); service role update after pipeline completes (D-12) |
</phase_requirements>

---

## Summary

Phase 3 builds a sequential pipeline triggered per creator: resolve channel ID → list recent videos via YouTube Data API → fetch transcript text via `youtube-transcript` npm → store in Supabase → chunk and embed into Pinecone. The pipeline runs inside a Next.js 15 API Route (`POST /api/refresh/[creatorId]`) to avoid Vercel's Server Action timeout. Progress is communicated via client polling against a second `GET /api/refresh/[creatorId]` endpoint that reads pipeline status stored in a Supabase `refresh_jobs` table (the only viable stateless-safe approach without Redis or WebSockets).

The stack is fully server-side TypeScript: `googleapis` for YouTube, `youtube-transcript` for zero-quota transcript text, `openai` SDK for embeddings, `@pinecone-database/pinecone` v7 for vector upsert, and `@supabase/supabase-js` direct `createClient` (service role) for DB writes that bypass RLS. The UI extends the existing `creators-tab.tsx` with per-row state: spinner, step status line, and expand/collapse transcript list.

The main risks are (1) `youtube-transcript` breakage (unofficial API), for which the mitigation is defensive try/catch with NULL row insertion; and (2) Pinecone upsert idempotency, which is handled at the application layer via `is_embedded` flag rather than vector-layer checks.

**Primary recommendation:** Use `googleapis` npm for YouTube API calls (official, typed), `youtube-transcript` npm for zero-quota transcript fetching, `js-tiktoken` for token-aware chunking, `openai` SDK v6 for batch embeddings, and `@pinecone-database/pinecone` v7 for vector upsert — all invoked sequentially inside one API Route handler with Supabase-backed progress state.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Channel ID resolution | API Route (server) | — | Requires YOUTUBE_API_KEY; must not be client-side |
| Video list retrieval | API Route (server) | — | YouTube Data API; server-side key auth |
| Transcript text fetching | API Route (server) | — | No quota cost; can be called server-side in loop |
| Supabase transcript INSERT | API Route (server, service role) | — | Bypasses RLS; service role key server-only |
| Pinecone upsert | API Route (server) | — | PINECONE_API_KEY server-only |
| OpenAI embedding | API Route (server) | — | OPENAI_API_KEY server-only |
| Progress state storage | Supabase `refresh_jobs` table | — | Stateless API route; in-memory not viable on Vercel |
| Progress display polling | Client component | — | 2s interval fetch to GET /api/refresh/[creatorId] |
| Transcript list display | Server component (dashboard page) | Client component (expand toggle) | Initial load server-rendered; toggle client state |
| Refresh button + status | Client component (`creators-tab.tsx`) | — | Optimistic UI + polling during refresh |
| `last_refreshed_at` update | API Route (server, service role) | — | RLS bypass needed for `user_creators` write |

---

## Standard Stack

### Core (new packages to install)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `googleapis` | `^144.0.0` | YouTube Data API v3: channels.list, playlistItems.list | Official Google client; typed; API key auth included |
| `youtube-transcript` | `^1.3.1` | Fetch transcript text by video ID; zero YouTube API quota | Reverse-engineers YouTube's internal transcript endpoint; no OAuth needed |
| `openai` | `^6.36.0` | `embeddings.create` with `text-embedding-3-small` | Official OpenAI SDK v6; handles batch embed calls |
| `@pinecone-database/pinecone` | `^7.2.0` | Vector upsert, namespace scoping | Official Pinecone TS SDK v7; server-side only |
| `js-tiktoken` | `^1.0.21` | Token counting for chunking transcripts | Pure-JS tiktoken port; works in Node.js without WASM issues |

`[VERIFIED: npm registry]` — versions confirmed via `npm view` on 2026-05-07.

### Already Installed (no action needed)

| Library | Purpose in Phase 3 |
|---------|-------------------|
| `@supabase/supabase-js` `^2.105.3` | Service role client for transcript INSERT/UPDATE |
| `@supabase/ssr` `^0.10.2` | Authenticated client for user session verification in API Route |
| `next` `15.5.16` | API Route (`/api/refresh/[creatorId]/route.ts`) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `googleapis` | Raw `fetch` to YouTube REST API | `googleapis` provides types and handles pagination cleanly; raw fetch is fine but requires manual type management |
| `youtube-transcript` | YouTube Data API captions.list | captions.list requires OAuth; `youtube-transcript` needs zero quota and no OAuth — always prefer for v1 |
| `js-tiktoken` | `tiktoken` (WASM) | `tiktoken` has WASM compatibility issues in Next.js Edge runtime; `js-tiktoken` is pure JS |
| Supabase `refresh_jobs` table | In-memory Map | In-memory state lost on Vercel cold starts; Supabase table is the only reliable stateless option without Redis |

**Installation:**
```bash
cd pulse && npm install googleapis youtube-transcript openai @pinecone-database/pinecone js-tiktoken
```

---

## Architecture Patterns

### System Architecture Diagram

```
User clicks [Refresh]
        |
        v
POST /api/refresh/[creatorId]
        |
        +-- 1. Verify user session (createClient from @supabase/ssr)
        |          -- if no session → 401
        |
        +-- 2. Verify creator is tracked by this user (user_creators query)
        |          -- if not tracked → 403
        |
        +-- 3. Upsert refresh_jobs row {status: 'running', step: 'resolving channel'}
        |
        +-- 4. Resolve channel_id (if NULL in creators table)
        |       |
        |       +-- channels.list?forHandle=@handle or forUrl=...
        |       |    (YOUTUBE_API_KEY, ~1 quota unit)
        |       +-- UPDATE creators SET channel_id = ... (service role)
        |
        +-- 5. List videos from last 12 months
        |       |
        |       +-- channelId → uploads playlist ID (replace UC→UU)
        |       +-- playlistItems.list (1 unit / 50 videos, paginated)
        |       +-- Filter: publishedAt >= NOW() - 12 months
        |       +-- UPDATE refresh_jobs step: 'fetching transcripts'
        |
        +-- 6. For each video (loop):
        |       |
        |       +-- Query transcripts table for existing row
        |       |    -- D-07: is_embedded=TRUE → skip
        |       |    -- D-09: raw_text=NULL → retry fetch
        |       |    -- D-10: no row → fetch fresh
        |       |
        |       +-- fetchTranscript(videoId)  ← youtube-transcript npm
        |       |    -- success → INSERT/UPSERT row with raw_text, word_count
        |       |    -- failure → INSERT row with raw_text=NULL (D-04)
        |       |
        |       +-- UPDATE refresh_jobs step: 'fetching transcripts X/N'
        |
        +-- 7. Embed unfetched transcripts (raw_text NOT NULL, is_embedded=FALSE)
        |       |
        |       +-- For each transcript: chunk text (js-tiktoken, ~500 tokens, 50-overlap)
        |       +-- Batch embed chunks (openai.embeddings.create, array of strings)
        |       +-- Upsert to Pinecone namespace=creatorId (batch 100 vectors)
        |       +-- UPDATE transcripts SET is_embedded=TRUE (service role)
        |       +-- UPDATE refresh_jobs step: 'embedding X/N videos'
        |
        +-- 8. UPDATE user_creators SET last_refreshed_at = NOW() (service role)
        |
        +-- 9. UPDATE refresh_jobs {status: 'done', summary: '10/12 fetched, 2 pending'}
        |
        v
     Return 202 immediately (fire-and-forget; client polls for status)

Client polling loop (every 2s):
GET /api/refresh/[creatorId]
  → reads refresh_jobs row
  → returns {status, step, summary}
  → client updates UI
  → stops polling when status = 'done' | 'error'
```

### Recommended Project Structure

```
pulse/src/
├── app/
│   └── api/
│       └── refresh/
│           └── [creatorId]/
│               └── route.ts          # POST (trigger) + GET (status)
├── lib/
│   ├── supabase/
│   │   ├── server.ts                 # existing — authenticated client
│   │   └── service.ts                # NEW — service role client
│   ├── youtube/
│   │   └── client.ts                 # NEW — googleapis youtube init + helpers
│   ├── pinecone/
│   │   └── client.ts                 # NEW — Pinecone singleton + upsert helper
│   ├── openai/
│   │   └── client.ts                 # NEW — OpenAI singleton + embed helper
│   └── pipeline/
│       └── transcript-pipeline.ts    # NEW — orchestrates steps 4-9
└── components/ (or app/dashboard/)
    └── refresh-button.tsx            # NEW — client component: button + poller
```

### Pattern 1: Service Role Supabase Client

Use `@supabase/supabase-js` direct `createClient` (NOT `@supabase/ssr`) for service role — it needs no cookie handling.

```typescript
// pulse/src/lib/supabase/service.ts
// Source: https://supabase.com/docs/guides/auth/server-side/creating-a-client
import 'server-only'
import { createClient } from '@supabase/supabase-js'

let serviceClient: ReturnType<typeof createClient> | null = null

export function createServiceClient() {
  if (serviceClient) return serviceClient
  serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,  // NOT NEXT_PUBLIC_ prefix
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
  return serviceClient
}
```

`[VERIFIED: Supabase official docs + community discussion]`

### Pattern 2: API Route — Auth Verification + Fire-and-Forget

```typescript
// pulse/src/app/api/refresh/[creatorId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ creatorId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { creatorId } = await params

  // Verify user tracks this creator
  const { data: uc } = await supabase
    .from('user_creators')
    .select('id')
    .eq('user_id', user.id)
    .eq('creator_id', creatorId)
    .single()
  if (!uc) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Upsert job row then return 202 immediately
  // Pipeline runs asynchronously (fire-and-forget)
  void runPipeline(creatorId, user.id)  // no await

  return NextResponse.json({ status: 'started' }, { status: 202 })
}
```

`[ASSUMED]` — Fire-and-forget via `void asyncFn()` works on Vercel for the duration of the request/response cycle, but Vercel may terminate the function after the response is sent. **Safer approach:** keep the pipeline synchronous inside the POST handler (await it, then return 200). The 30–120s duration is within Vercel's default 60s timeout for Pro plans but may exceed 10s Hobby plan limit. Planner must decide: synchronous POST (simpler) vs async (needs background job infra). **Recommendation: synchronous POST with streaming or polling against Supabase job table.**

### Pattern 3: YouTube API — Channel ID Resolution

```typescript
// Source: https://developers.google.com/youtube/v3/docs/channels/list
import { google } from 'googleapis'

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
})

// Resolve by handle (e.g. "@DamienTalksMoney")
async function resolveChannelId(channelUrl: string): Promise<string | null> {
  const handle = extractHandle(channelUrl) // parse @handle from URL
  const res = await youtube.channels.list({
    part: ['id'],
    forHandle: handle,   // preferred — works for @handle URLs
  })
  return res.data.items?.[0]?.id ?? null
}
```

**Channel URL formats in seed data and how to resolve them:**
- `https://www.youtube.com/@Handle` → extract `Handle`, use `forHandle: '@Handle'` `[VERIFIED: Google Developers]`
- `https://www.youtube.com/c/CustomName` → use `forHandle` or `forUsername` — may fail for old-style URLs; fall back to `forUsername: 'CustomName'` `[ASSUMED]`
- `https://www.youtube.com/channel/UCxxxxxx` → `channel_id` is embedded in URL; extract directly, no API call needed `[VERIFIED: Google Developers]`

**Quota cost:** `channels.list` = 1 unit per call. `[VERIFIED: Google Developers Quota Calculator]`

### Pattern 4: YouTube API — List Videos from Last 12 Months

```typescript
// Source: https://developers.google.com/youtube/v3/docs/playlistItems/list
// Uploads playlist ID = channel_id with 'UC' prefix replaced by 'UU'
// [VERIFIED: multiple sources]

const uploadsPlaylistId = channelId.replace(/^UC/, 'UU')
const cutoff = new Date()
cutoff.setFullYear(cutoff.getFullYear() - 1)

let videos: VideoItem[] = []
let pageToken: string | undefined

do {
  const res = await youtube.playlistItems.list({
    part: ['snippet'],
    playlistId: uploadsPlaylistId,
    maxResults: 50,           // max per page
    pageToken,
  })
  
  for (const item of res.data.items ?? []) {
    const publishedAt = new Date(item.snippet!.publishedAt!)
    if (publishedAt < cutoff) { pageToken = undefined; break } // stop pagination early
    videos.push({
      videoId: item.snippet!.resourceId!.videoId!,
      title: item.snippet!.title!,
      publishedAt,
    })
  }
  pageToken = res.data.nextPageToken ?? undefined
} while (pageToken)
```

**Quota cost:** 1 unit per page of 50 videos. A creator with 100 videos in 12 months = 2 quota units. `[VERIFIED: Google Developers]`

### Pattern 5: Transcript Fetch — youtube-transcript npm

```typescript
// Source: https://github.com/Kakulukian/youtube-transcript
// [VERIFIED: npm registry + GitHub homepage]
import { YoutubeTranscript } from 'youtube-transcript'

async function fetchTranscriptText(videoId: string): Promise<string | null> {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId)
    // Each segment: { text: string, duration: number, offset: number }
    return segments.map(s => s.text).join(' ')
  } catch (err) {
    // Throws when: no captions, private video, deleted video, rate-limited
    // D-04: return null → caller inserts row with raw_text = NULL
    console.warn(`Transcript unavailable for ${videoId}:`, err)
    return null
  }
}
```

**Error types thrown by `youtube-transcript` v1.3.1:**
- No official typed error hierarchy — all failures throw generic `Error` with message string `[ASSUMED — based on npm description; package is minimal with no typed errors]`
- Catch-all `try/catch` is the correct defensive pattern
- Known failure modes: disabled captions, age-restricted videos, private videos, YouTube returning 429 (rare for sequential requests)

**Rate limits:** No documented rate limit for `youtube-transcript`. Sequential calls (not parallel) avoid triggering YouTube's informal throttling. For a creator with 50 videos, sequential calls at ~1–2s each = 50–100s total. `[ASSUMED — no official documentation exists]`

### Pattern 6: Token-Aware Chunking with js-tiktoken

```typescript
// Source: https://www.npmjs.com/package/js-tiktoken
import { get_encoding } from 'js-tiktoken'

const enc = get_encoding('cl100k_base')  // encoding for text-embedding-3-small

function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const tokens = enc.encode(text)
  const chunks: string[] = []
  let start = 0
  
  while (start < tokens.length) {
    const end = Math.min(start + chunkSize, tokens.length)
    const chunkTokens = tokens.slice(start, end)
    chunks.push(new TextDecoder().decode(enc.decode(chunkTokens)))
    if (end === tokens.length) break
    start += chunkSize - overlap
  }
  
  return chunks
}
```

**`text-embedding-3-small` token limit:** 8,191 tokens per input. Chunks of 500 tokens are well within this limit. `[VERIFIED: OpenAI developers docs]`

**Encoding:** `cl100k_base` is the correct encoding for `text-embedding-3-small`. `[CITED: https://platform.openai.com/docs/models/text-embedding-3-small]`

### Pattern 7: OpenAI Batch Embeddings

```typescript
// Source: https://platform.openai.com/docs/api-reference/embeddings
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function embedChunks(chunks: string[]): Promise<number[][]> {
  // API accepts array of strings; max 2048 inputs per request, total ≤ 300,000 tokens
  // With 500-token chunks: max ~600 chunks per call; use batch of 100 for safety
  const BATCH = 100
  const embeddings: number[][] = []
  
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH)
    const res = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch,
    })
    embeddings.push(...res.data.map(d => d.embedding))
  }
  
  return embeddings
}
```

`[VERIFIED: OpenAI API reference — 8191 token per-input limit, 300,000 total token batch limit]`

### Pattern 8: Pinecone Upsert with Namespace

```typescript
// Source: Pinecone TS SDK v7 docs (sdk.pinecone.io/typescript)
// [VERIFIED: npm registry + WebSearch confirmed v7.2.0 latest]
import { Pinecone } from '@pinecone-database/pinecone'

// Singleton — PINECONE_API_KEY auto-read from env
const pc = new Pinecone()

export function getPineconeNamespace(indexName: string, creatorId: string) {
  return pc.index(indexName).namespace(creatorId)
}

// Upsert pattern
const ns = getPineconeNamespace(process.env.PINECONE_INDEX_NAME!, creatorId)

await ns.upsert([
  {
    id: `${videoId}-chunk-${chunkIndex}`,
    values: embeddingVector,   // number[] of 1536 dims (text-embedding-3-small)
    metadata: {
      creator_id: creatorId,
      video_id: videoId,
      title: videoTitle,
      chunk_index: chunkIndex,
      published_at: publishedAt.toISOString(),
    },
  },
  // ... more vectors
])
```

**Upsert is inherently idempotent:** upserting the same vector ID overwrites the record. `[VERIFIED: Pinecone docs]` This means Phase 3 does NOT need to check Pinecone for existing vectors — the application-layer `is_embedded` flag in Supabase is the sole idempotency gate (D-07).

**Batch size:** max 1,000 vectors or 2MB per upsert call. Recommended batch = 100 vectors. `[VERIFIED: Pinecone docs + community]`

**Namespace format:** use raw UUID string of `creator_id` as namespace. Format: `"550e8400-e29b-41d4-a716-446655440000"`. Simple, collision-free, matches `creators.id` PK. `[Claude's Discretion — no locked decision]`

### Pattern 9: Progress Tracking via Supabase refresh_jobs Table

Since the API Route is stateless, progress state must be persisted externally. In-memory Maps are not viable on Vercel (cold starts, multi-instance). Redis is not in the stack. Supabase is the correct v1 choice.

**Required SQL migration (to be added to Phase 3 migration SQL, run via SQL editor):**

```sql
-- refresh_jobs: tracks per-creator pipeline progress
-- One row per (user_id, creator_id) pair; upserted on each refresh trigger
CREATE TABLE IF NOT EXISTS public.refresh_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  creator_id  UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'idle'
    CHECK (status IN ('running', 'done', 'error', 'idle')),
  step        TEXT,                   -- human-readable step label for UI
  summary     TEXT,                   -- completion summary e.g. "10/12 fetched"
  error       TEXT,                   -- error message if status = 'error'
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, creator_id)
);

ALTER TABLE public.refresh_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own refresh jobs"
  ON public.refresh_jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
-- INSERT/UPDATE: service role only (API Route uses service role)
```

**GET /api/refresh/[creatorId] endpoint:** reads `refresh_jobs` using the authenticated user client (anon key is fine for SELECT since RLS allows it). Returns `{ status, step, summary, error }`. Client polls this every 2s.

**Consideration re: Vercel timeout:** The pipeline runs synchronously inside the POST handler (await all steps). On Vercel Hobby (10s timeout) this WILL time out for creators with many videos. On Pro (60s default, configurable to 300s) it should be fine for most creators. The plan MUST document this constraint and configure `maxDuration` in `route.ts`:

```typescript
export const maxDuration = 300  // seconds — requires Vercel Pro or Self-hosted
```

`[ASSUMED — Vercel timeout limit for Hobby vs Pro; confirm before deployment]`

### Anti-Patterns to Avoid

- **Parallel transcript fetching:** Do NOT `Promise.all` transcript fetches. YouTube informally rate-limits parallel requests. Sequential is correct for v1. `[ASSUMED — no official docs; community wisdom]`
- **In-memory progress state:** A `Map<creatorId, status>` in the module scope is reset on cold starts. Always use Supabase.
- **Using `@supabase/ssr` createClient for service role:** `@supabase/ssr`'s `createServerClient` is designed for cookie-based auth. Service role client uses `@supabase/supabase-js` direct `createClient` with `persistSession: false`. `[VERIFIED: Supabase official docs]`
- **Sending full transcript to Claude:** Not a Phase 3 concern, but the schema stores `raw_text` — Phase 4 must NEVER pass `raw_text` directly to Claude. RAG pattern required. `[CLAUDE.md constraint]`
- **Embedding already-embedded chunks:** Guard on `is_embedded = TRUE` (D-07). Re-embedding is expensive and wastes OpenAI quota.
- **Using `search.list` for video discovery:** `search.list` costs 100 quota units per call vs 1 for `playlistItems.list`. Always use the uploads playlist approach. `[VERIFIED: Google Developers Quota Calculator]`

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token counting | Manual character heuristics | `js-tiktoken` with `cl100k_base` | Characters ≠ tokens; 500-char chunks are wildly inconsistent sizes |
| YouTube API pagination | Manual cursor tracking | `googleapis` client (handles cursor) | pageToken logic is fiddly; googleapis makes it clean |
| Transcript text fetching | YouTube captions API with OAuth | `youtube-transcript` npm | captions.list requires OAuth; this package needs zero auth |
| OpenAI retry/backoff | Manual retry loops | `openai` SDK v6 (built-in retry) | SDK retries 429s automatically with exponential backoff |
| Vector ID deduplication | Checking Pinecone before upsert | Upsert directly (idempotent by design) | Pinecone upsert overwrites by ID; pre-check is wasted I/O |

**Key insight:** The YouTube transcript unofficial API and Pinecone's upsert-by-ID both handle the hard parts (deduplication, unofficial protocol). The application only needs to guard against re-processing via Supabase flags — not via external service checks.

---

## Common Pitfalls

### Pitfall 1: Vercel Function Timeout

**What goes wrong:** A creator with 50+ videos takes 60–120s to fully process. Vercel Hobby plan kills functions at 10s. Even Pro kills at 60s default.
**Why it happens:** Sequential transcript fetching (~1-2s each) + embedding batches.
**How to avoid:** Set `export const maxDuration = 300` in `route.ts`. This requires Vercel Pro. Document this as a deployment requirement. Alternatively, split pipeline into two routes: one for fetch (Step 6) and one for embed (Step 7), called sequentially by the client.
**Warning signs:** Client receives a 504 or empty response before pipeline completes.

### Pitfall 2: youtube-transcript Breaking Changes

**What goes wrong:** `youtube-transcript` uses the unofficial YouTube internal API. YouTube can change the endpoint at any time, breaking transcript fetching.
**Why it happens:** No official API; reverse-engineered endpoint.
**How to avoid:** Wrap every `YoutubeTranscript.fetchTranscript()` call in try/catch. D-04 mandates inserting NULL row on failure — do not propagate the error to abort the whole pipeline. Monitor package versions.
**Warning signs:** Sudden spike in NULL `raw_text` rows for all creators on the same day.

### Pitfall 3: Channel ID Resolution from Non-@handle URLs

**What goes wrong:** Seed data has varied URL formats. `forHandle` only works for `@handle` style. Old `youtube.com/c/name` URLs may not resolve.
**Why it happens:** YouTube changed URL formats over the years; some seed data uses old `/c/` format.
**How to avoid:** Implement multi-strategy resolution: (1) extract `UCxxxxxxxx` directly if `/channel/` URL, (2) `forHandle` if `@handle` present, (3) `forUsername` if `/user/` or `/c/` format. Fall back gracefully. If all strategies fail, abort refresh with informative error.
**Warning signs:** `channels.list` returning empty `items` array.

### Pitfall 4: Supabase UPSERT on transcripts — video_id UNIQUE constraint

**What goes wrong:** Re-running refresh on the same creator would create duplicate rows if using plain INSERT.
**Why it happens:** video_id is globally UNIQUE in the transcripts table (not scoped to creator).
**How to avoid:** Use `.upsert({ ...row }, { onConflict: 'video_id' })` — Supabase's JS client supports this. On conflict, update `last_fetched`, `raw_text`, `word_count` but NOT `is_embedded` (preserve embedded status).
**Warning signs:** Supabase returning 409 conflict errors in the pipeline.

### Pitfall 5: Pinecone Namespace vs Index

**What goes wrong:** Confusing namespace with index. All creators share ONE Pinecone index; namespaces partition within it.
**Why it happens:** Pinecone docs use both terms; easy to create per-creator indexes accidentally.
**How to avoid:** One index (name from `PINECONE_INDEX_NAME` env var). Namespace = `creatorId` (UUID string). Phase 4 queries by namespace to get only that creator's vectors.
**Warning signs:** Index creation errors, or Phase 4 RAG returning vectors from wrong creators.

### Pitfall 6: OpenAI Embeddings — Input Token Limit

**What goes wrong:** Sending a raw transcript as a single embedding input (100k+ tokens) immediately throws a 400 error.
**Why it happens:** Forgetting to chunk before embedding.
**How to avoid:** Always chunk first (Pattern 6), then embed chunks (Pattern 7). Each chunk must be ≤ 8,191 tokens. With 500-token chunks there is ample safety margin.
**Warning signs:** OpenAI API returning `context_length_exceeded` error.

### Pitfall 7: Missing `refresh_jobs` Table RLS Insert Policy

**What goes wrong:** Service role writes to `refresh_jobs` succeed, but the GET status endpoint (using anon/auth client) returns 0 rows even though the job exists.
**Why it happens:** RLS SELECT policy was added correctly, but the INSERT/UPDATE is done via service role (which bypasses RLS) — this is correct. The SELECT policy `auth.uid() = user_id` correctly filters by user.
**How to avoid:** Ensure the `refresh_jobs.user_id` column is always populated with the triggering user's ID when upserting via service role.
**Warning signs:** GET status endpoint always returns 404 or empty data.

---

## Code Examples

### Verified Patterns Summary

All patterns are in the Architecture Patterns section above. Key file/pattern mapping:

| File | Pattern Reference |
|------|------------------|
| `pulse/src/lib/supabase/service.ts` | Pattern 1 |
| `pulse/src/app/api/refresh/[creatorId]/route.ts` | Pattern 2 |
| `pulse/src/lib/youtube/client.ts` | Patterns 3 + 4 |
| `pulse/src/lib/pipeline/transcript-pipeline.ts` | Pattern 5 (transcript fetch) |
| Token chunking utility | Pattern 6 |
| OpenAI embed helper | Pattern 7 |
| `pulse/src/lib/pinecone/client.ts` | Pattern 8 |
| `refresh_jobs` SQL migration | Pattern 9 |

---

## Schema Changes Required

### Migration 1: user_creators.last_refreshed_at (D-11)

```sql
-- Run via Supabase SQL Editor
ALTER TABLE public.user_creators
  ADD COLUMN IF NOT EXISTS last_refreshed_at TIMESTAMPTZ;
```

### Migration 2: refresh_jobs table (Pattern 9)

Full SQL in Pattern 9 above.

### TypeScript Type Update Required

`UserCreator` in `pulse/src/types/index.ts` needs `lastRefreshedAt: Date | null` added to match the new column (D-11).

---

## Environment Variables Required

```bash
# .env.local additions for Phase 3
YOUTUBE_API_KEY=AIza...                      # YouTube Data API v3 key (server-only, no NEXT_PUBLIC_)
OPENAI_API_KEY=sk-...                        # OpenAI API key (server-only)
PINECONE_API_KEY=pcsk_...                    # Pinecone API key (server-only)
PINECONE_INDEX_NAME=pulse-transcripts        # Pinecone index name (server-only)
SUPABASE_SERVICE_ROLE_KEY=eyJ...             # Already exists in seed pattern; add if missing
```

**All Phase 3 keys must NOT have `NEXT_PUBLIC_` prefix** — they are server-only secrets.

---

## Runtime State Inventory

Step 2.5 SKIPPED — Phase 3 is a greenfield pipeline implementation (no rename/refactor). No existing runtime state to audit.

---

## Environment Availability Audit

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All npm packages | ✓ | (existing Next.js project) | — |
| YouTube Data API quota (10,000/day) | Channel resolution + video listing | ✓ (assumed — user must enable API) | — | No fallback — must have API key |
| Pinecone index (pre-created) | TRANS-03 | [ASSUMED — must verify] | — | Cannot proceed without index |
| OpenAI API access | TRANS-03 embeddings | [ASSUMED — must verify] | — | Cannot proceed without key |
| Vercel Pro plan | maxDuration > 10s | [ASSUMED — must verify] | — | Split pipeline into smaller routes |

**Missing dependencies with no fallback:**
- YouTube Data API key and quota: user must create a Google Cloud project, enable YouTube Data API v3, create a server API key. This is a pre-requisite for the phase.
- Pinecone index: user must create an index in Pinecone dashboard with dimension=1536, metric=cosine, before running the pipeline. Index name must match `PINECONE_INDEX_NAME` env var.

**Missing dependencies with fallback:**
- Vercel timeout: if on Hobby plan, split the POST handler into smaller operations or use Vercel Pro.

---

## Validation Architecture

No formal test framework is configured in this project (`package.json` has no test script, no `jest.config.*`, no `vitest.config.*` found). `[VERIFIED: package.json inspection]`

### Phase Requirements → Manual Verification Map

| Req ID | Behavior | Test Type | How to Verify |
|--------|----------|-----------|---------------|
| TRANS-01 | Videos from last 12 months fetched | Manual smoke | Trigger Refresh on a tracked creator; check `transcripts` table in Supabase |
| TRANS-02 | Transcripts stored with creator_id, video_id, title, published_at | Manual smoke | Query `SELECT * FROM transcripts WHERE creator_id = '...'` |
| TRANS-03 | Chunks embedded and in Pinecone with metadata | Manual smoke | Use Pinecone console to query namespace = creatorId; verify metadata fields present |
| TRANS-04 | Re-refresh is idempotent | Manual smoke | Run Refresh twice; count rows — should not increase; `is_embedded` rows not re-processed |
| TRANS-05 | last_refreshed_at updated and displayed | Manual smoke | Check `user_creators.last_refreshed_at` after Refresh; verify UI shows timestamp |

**Wave 0 Gaps:** No test framework to set up — project is manual-verification only per current state.

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `supabase.auth.getUser()` in API Route before any pipeline step |
| V3 Session Management | yes | Handled by `@supabase/ssr` middleware (existing) |
| V4 Access Control | yes | Verify `user_creators` row before triggering pipeline (user may only refresh creators they track) |
| V5 Input Validation | yes | `creatorId` from URL param: validate as UUID before DB query |
| V6 Cryptography | no | No cryptographic operations in this phase |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated pipeline trigger | Spoofing | `getUser()` check before any processing |
| IDOR — trigger pipeline for another user's creator | Elevation of Privilege | `user_creators` row check (user_id + creator_id match) |
| API key exposure in client bundle | Information Disclosure | All keys use non-NEXT_PUBLIC_ prefix; server-only imports |
| YouTube API quota exhaustion by malicious calls | Denial of Service | Authenticated route + rate limiting at user level (deferred to v2) |
| Path traversal in creatorId param | Tampering | UUID validation before DB query |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `youtube-transcript` v1.3.1 throws generic `Error` with no typed error hierarchy | Pattern 5 | If it does have typed errors, catch-all still works but we miss retry-specific logic |
| A2 | Sequential transcript fetches avoid YouTube informal rate limiting | Pattern 5 | If YouTube rate-limits anyway, we get widespread NULL rows; add configurable delay between calls |
| A3 | Vercel Hobby plan 10s timeout; Pro plan 60s default | Pitfall 1 | If limits differ, adjust `maxDuration` accordingly |
| A4 | `forHandle` + `forUsername` cover all URL formats in seed data | Pattern 3 | If `/c/` URLs fail both, channel resolution errors; planner should add graceful fallback path |
| A5 | Fire-and-forget `void runPipeline()` works on Vercel for 60–120s | Pattern 2 note | Vercel terminates background work after response; synchronous pipeline inside POST is safer |
| A6 | Pinecone index must be pre-created with dimension=1536, metric=cosine | Environment Availability | Wrong dimension or metric causes embed errors; document in Wave 0 setup steps |
| A7 | `cl100k_base` is the correct js-tiktoken encoding for text-embedding-3-small | Pattern 6 | If wrong encoding, token counts will be slightly off but 500-token chunks still safe vs 8191 limit |

---

## Open Questions

1. **Vercel deployment plan — Hobby vs Pro?**
   - What we know: pipeline takes 30–120s; Hobby times out at 10s
   - What's unclear: user's Vercel plan
   - Recommendation: Planner should document `maxDuration = 300` and note Pro plan requirement. Fallback plan: split into fetch-phase and embed-phase routes called sequentially by client.

2. **Pinecone index already created?**
   - What we know: Phase 1 schema covers Supabase; Pinecone is external
   - What's unclear: whether user has already created a Pinecone index with correct config
   - Recommendation: Wave 0 of Phase 3 plan must include a setup-only step: "Create Pinecone index `pulse-transcripts` — 1536 dims, cosine metric, serverless on AWS us-east-1."

3. **YOUTUBE_API_KEY and OPENAI_API_KEY present in .env.local?**
   - What we know: `.env.local.example` only shows Supabase keys; no YouTube/OpenAI/Pinecone keys
   - What's unclear: whether user has these keys available
   - Recommendation: Wave 0 must include env var setup documentation.

4. **youtube-transcript reliability for finance YouTubers?**
   - What we know: package works for most public videos with captions enabled
   - What's unclear: what fraction of UK finance YouTubers disable auto-captions vs manual
   - Recommendation: D-04 (NULL row on failure) mitigates this; no further action needed.

---

## Sources

### Primary (HIGH confidence)
- [Pinecone TS SDK npm page](https://www.npmjs.com/package/@pinecone-database/pinecone) — v7.2.0 confirmed current via npm registry
- [OpenAI Embeddings API reference](https://platform.openai.com/docs/api-reference/embeddings) — 8191 token limit, 300k batch limit, array input confirmed
- [YouTube Data API playlistItems.list](https://developers.google.com/youtube/v3/docs/playlistItems/list) — 1 unit quota, 50 per page confirmed
- [YouTube Data API channels.list](https://developers.google.com/youtube/v3/docs/channels/list) — forHandle parameter confirmed
- [Supabase service role client](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — createClient pattern with persistSession: false confirmed
- npm registry: `googleapis@144.0.0`, `youtube-transcript@1.3.1`, `openai@6.36.0`, `js-tiktoken@1.0.21` — all confirmed via `npm view`

### Secondary (MEDIUM confidence)
- [WebSearch: Pinecone upsert batch limit 1000 vectors / 2MB](https://community.pinecone.io/t/getting-an-upsert-error-even-for-small-batch-sizes/824) — community confirmed, consistent with docs
- [WebSearch: uploads playlist ID = UC→UU substitution](https://blog.tericcabrel.com/retrieve-videos-youtube-data-api-v3-nodejs/) — multiple sources agree
- [Pinecone namespace syntax](https://sdk.pinecone.io/typescript/classes/Pinecone.html) — v7.2.0 SDK docs confirm `.namespace(id)` syntax

### Tertiary (LOW confidence — flagged as ASSUMED)
- youtube-transcript error handling behavior — only npm description reviewed; no detailed error type docs found
- Vercel timeout limits — from general knowledge, not verified against current Vercel pricing page
- Sequential fetch rate limit behavior — community wisdom, no official YouTube docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all package versions npm-verified
- YouTube API patterns: HIGH — verified against official Google Developer docs
- Architecture: MEDIUM-HIGH — patterns are standard but Vercel timeout behavior is ASSUMED
- youtube-transcript reliability: MEDIUM — package works per npm description; unofficial API is inherently fragile
- Progress tracking: HIGH — Supabase-backed pattern is sound; fire-and-forget caveat documented

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 (youtube-transcript package may break sooner; check GitHub for issues if errors spike)
