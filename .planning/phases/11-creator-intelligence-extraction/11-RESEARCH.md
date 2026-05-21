# Phase 11: Creator Intelligence Extraction — Research

**Researched:** 2026-05-19
**Domain:** RAG-backed structured extraction (Anthropic SDK + Pinecone), YouTube Data API v3, Next.js 15 server actions
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01**: `extract_allocation` tool replaced by new `extract_creator_profile` tool. Old category-% model retired.
- **D-02**: `favoured_stocks.ticker` — use ticker as creator cited it. May be null. Do not infer.
- **D-03**: `preferred_index_funds.ticker` is nullable.
- **D-04**: `tool_choice: { type: 'tool', name: 'extract_creator_profile' }` — forced structured output.
- **D-05**: System prompt rewritten. Must not contain "advice", "recommend", "suggest". Framed as observation.
- **D-06**: Two separate Claude calls per refresh: stable call then latest call.
- **D-07**: Stable layer = Pinecone filter `published_at >= (now - 4 months)`.
- **D-08**: Latest layer = Pinecone filter `published_at >= (now - 30 days)`. ISO string filter syntax.
- **D-09**: If 30-day query returns 0 chunks → skip latest extraction, set `profile_latest = null`. No empty Claude call.
- **D-10**: Updated query texts for new schema.
- **D-11**: `listVideosLast12Months` → `listVideosLast4Months`. Old function removed.
- **D-12**: Existing Pinecone vectors older than 4 months NOT deleted. Excluded via date filter only.
- **D-13**: Two new nullable JSONB columns in `creator_strategies`: `profile_stable`, `profile_latest`. SQL snippet delivery (user runs in Supabase SQL Editor).
- **D-14**: `allocation` column made nullable. Old rows untouched. New extractions set `allocation = NULL`.
- **D-15**: No changes to `has_contradiction`, `contradiction_note`, or contradiction check.
- **D-16**: New `searchChannels(query)` in `youtube/client.ts`. `search.list` with `type: 'channel'`, max 5 results.
- **D-17**: Subscriber count requires second `channels.list` call. Batch all 5 IDs in one call.
- **D-18**: New `trackSearchedCreator(channelId, channelTitle, channelUrl, thumbnailUrl)` server action. Inserts directly with `channel_id` set; bypasses URL validation.
- **D-19**: Search fires on Enter or button press only. 500ms debounce on input, no auto-fire.
- **D-20**: URL input preserved as fallback under "Add by URL instead" toggle/disclosure.
- **D-21**: Search result card: thumbnail 40×40px, channel name, formatted subscriber count, "Track" / "Tracking ✓" button.

### Claude's Discretion

- Exact Pinecone filter syntax for date comparison (string vs timestamp — test both; use whichever Pinecone accepts)
- Ordering of stable vs latest extraction call (stable first — cheaper to fail fast)
- Error handling when `profile_stable` extraction fails — surface in `refresh_jobs.step`

### Deferred Ideas (OUT OF SCOPE)

- Contradiction check redesign (Phase 14)
- Creator profile display (Phase 12)
- Backfill old creator strategies (user-triggered, not automated migration)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CI-01 | Transcript scraping limited to last 4 months | `listVideosLast4Months` rename in `youtube/client.ts` + `transcript-pipeline.ts` import update |
| CI-02 | Two extraction layers per creator: stable (4-month) + latest (30-day) | Two-call pattern in rewritten `extractor.ts`; Pinecone date filters; `profile_stable`/`profile_latest` JSONB columns |
| CI-03 | Extraction captures: favoured stocks (tickers), methodology, sector focus, preferred index funds | New `extract_creator_profile` tool schema; updated query texts; new TypeScript interfaces |
| CI-04 | Creator profile displays both layers distinctly ("established view" vs "this month") | Out of scope for Phase 11 (rendering is Phase 12); DB schema delivers the data |
| SRCH-01 | User can search YouTube channels by name/keyword from Creators page | `searchChannels()` in `youtube/client.ts`; search bar UI in `creators-tab.tsx` |
| SRCH-02 | Search results show thumbnail, name, subscriber count before tracking | `channels.list?part=statistics` batch call for subscriber counts; result card UI (D-21) |
| SRCH-03 | Manual channel URL entry preserved as fallback | "Add by URL instead" disclosure toggle (D-20); `addCustomCreator` action unchanged |
</phase_requirements>

---

## Summary

Phase 11 is a rewrite of the creator data pipeline plus the addition of YouTube channel search. The extraction layer (`extractor.ts`) is replaced wholesale: the old single-call `extract_allocation` tool is retired in favour of a two-call `extract_creator_profile` pattern that produces a stable 4-month profile and a latest 30-day snapshot. Both profiles are stored as nullable JSONB columns in a new SQL migration. The YouTube client gains two new functions: `listVideosLast4Months` (window change) and `searchChannels` (new feature). The UI gains a search bar as the primary creator-add flow, with the existing URL form preserved as a collapsed fallback.

All research dependencies are already installed (`@anthropic-ai/sdk ^0.95.0`, `@pinecone-database/pinecone ^7.2.0`, `googleapis ^144.0.0`). No new packages are required. The critical technical detail to verify before planning execution is the Pinecone metadata `published_at` format: **confirmed as ISO string** (transcript-pipeline.ts stores `row.published_at` which is a Supabase timestamptz ISO string). The `$gte` filter with an ISO string value is therefore the correct approach.

**Primary recommendation:** Plan as four waves — (1) SQL migration + DB types, (2) YouTube client functions, (3) extractor.ts rewrite, (4) UI + server action — with each wave depending on the previous.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pinecone date-filtered RAG retrieval | API/Backend (`extractor.ts`) | — | Server-only pipeline; no client involvement |
| Claude two-call extraction | API/Backend (`extractor.ts`) | — | Server-only; `'use server-only'` enforced |
| DB migration (new JSONB columns) | Database/Storage | — | Schema change via SQL snippet in Supabase |
| YouTube search API call | API/Backend (`youtube/client.ts`) | — | API key must stay server-side |
| Search results UI + Track button | Frontend (Client Component) | Frontend Server (SSR page) | `useActionState` pattern in `creators-tab.tsx` |
| `trackSearchedCreator` server action | API/Backend (Server Action) | — | Uses service-role client; no client-side DB access |
| 4-month video window | API/Backend (`youtube/client.ts`) | — | `listVideosLast4Months` called from pipeline server-side |
| `refresh_jobs` step tracking | Database/Storage | API/Backend | Tracks pipeline progress; read by client poll |

---

## Standard Stack

### Core (all already installed — no new packages)

| Library | Installed Version | Purpose | Why Standard |
|---------|------------------|---------|--------------|
| `@anthropic-ai/sdk` | `^0.95.0` [VERIFIED: package.json] | Forced tool_use extraction | Already in use since Phase 4 |
| `@pinecone-database/pinecone` | `^7.2.0` [VERIFIED: package.json] | Vector store RAG with metadata filters | Already in use since Phase 3 |
| `googleapis` | `^144.0.0` [VERIFIED: package.json] | YouTube Data API v3 (search + channels) | Already in use since Phase 3 |
| `@supabase/supabase-js` | `^2.105.3` [VERIFIED: package.json] | DB writes for new columns | Already in use |
| `next` | `15.5.16` [VERIFIED: package.json] | Server actions, `useActionState` | Project framework |

### Supporting (for eval — dev-only, not yet installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `promptfoo` | latest | Schema compliance + no-advice language evals | Wave 0 gap — install if running AI-SPEC eval suite |
| `zod` | already in project? | Runtime schema validation of tool output | Eval scripts only (not production path) |

**Installation check:** `promptfoo` not in package.json [VERIFIED: package.json scan]. Per AI-SPEC, `npm install -D promptfoo` in eval Wave 0 if eval suite is built this phase.

---

## Architecture Patterns

### System Architecture Diagram

```
User triggers Refresh
        │
        ▼
transcript-pipeline.ts::runRefreshPipeline()
        │
        ├── listVideosLast4Months(channelId)    ← YouTube playlistItems.list API
        │        cutoff = now - 4 months
        │
        ├── [per video] fetchTranscript + upsert to Supabase transcripts table
        │
        ├── [per un-embedded transcript] chunkText → embedChunks → Pinecone upsert
        │        metadata: { creator_id, video_id, title, published_at (ISO string), text }
        │
        └── calls extractCreatorStrategy(creatorId, userId)
                 │
                 ├── STABLE LAYER
                 │    retrieveChunks(creatorId, filter: published_at >= now-4mo)
                 │    → buildContextString()
                 │    → Claude: extract_creator_profile (tool_choice forced)
                 │    → parse ToolUseBlock → CreatorProfile
                 │
                 ├── LATEST LAYER (skip if 0 chunks)
                 │    retrieveChunks(creatorId, filter: published_at >= now-30d)
                 │    → if chunks.length === 0 → profile_latest = null
                 │    → else Claude: extract_creator_profile
                 │    → parse ToolUseBlock → CreatorProfile | null
                 │
                 └── INSERT into creator_strategies
                          { profile_stable, profile_latest, allocation: NULL,
                            confidence, source_video_ids, has_contradiction, contradiction_note }


User types in search bar (Enter or button press)
        │
        ▼
creators-tab.tsx (Client Component)
        │
        ├── useActionState(searchCreators, {})
        │
        └── searchCreators() Server Action
                 │
                 ├── youtube.search.list(q, type:'channel', maxResults:5)  ← 100 quota units
                 │
                 ├── youtube.channels.list(ids, part:'statistics')          ← 1 quota unit
                 │
                 └── returns SearchResult[] { channelId, channelTitle, channelUrl,
                                              subscriberCount, thumbnailUrl }
                          │
                          ▼
                 Result cards rendered inline (AnimatePresence)
                 "Track" → trackSearchedCreator() Server Action
                        → INSERT creators (with channel_id pre-set)
                        → INSERT user_creators
```

### Recommended Project Structure

```
pulse/src/lib/strategy/
├── extractor.ts          # Full rewrite: new TOOL_DEF, SYSTEM_PROMPT, two-call pattern
└── contradiction.ts      # DO NOT MODIFY

pulse/src/lib/youtube/
└── client.ts             # Add searchChannels(), listVideosLast4Months(); remove listVideosLast12Months

pulse/src/app/dashboard/
├── creator-actions.ts    # Add trackSearchedCreator(), add searchCreators()
└── creators-tab.tsx      # Replace URL input with search bar (primary); URL as disclosure fallback
```

### Pattern 1: Pinecone Date Filter (ISO String)

**What:** Pinecone metadata filter using `$gte` comparison on an ISO 8601 string field.
**When to use:** Both stable (4-month) and latest (30-day) retrieval calls.
**Confirmed format:** `published_at` stored as ISO string (`row.published_at` from Supabase timestamptz) — verified in `transcript-pipeline.ts` line 216.

```typescript
// Source: verified from transcript-pipeline.ts metadata upsert
const stableFilter = {
  published_at: { $gte: new Date(Date.now() - 4 * 30 * 24 * 60 * 60 * 1000).toISOString() }
}

const latestFilter = {
  published_at: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() }
}

// Usage in ns.query() — same cast pattern as existing retrieveChunks()
const result = await (ns as any).query({
  vector,
  topK: 20,
  includeMetadata: true,
  filter: stableFilter,
})
```

**Confidence:** HIGH — `published_at` metadata format confirmed from source code [VERIFIED: transcript-pipeline.ts line 216].

### Pattern 2: Forced Tool Use — Two-Call Pattern

**What:** Two sequential Anthropic messages.create calls with the same tool schema but different Pinecone-filtered context strings.
**When to use:** `extractCreatorStrategy()` rewrite — stable call always first (fail fast), latest call conditional on chunk count.

```typescript
// Source: AI-SPEC Section 3 — Entry Point Pattern
// Stable call (always fires)
const stableResponse = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 2048,  // increased from 1024 — new schema is larger
  system: SYSTEM_PROMPT,
  messages: [{ role: 'user', content: stableContextString }],
  tools: [PROFILE_TOOL_DEF],
  tool_choice: { type: 'tool', name: 'extract_creator_profile' },
})

// Latest call (conditional on D-09)
const latestResponse = latestChunks.length > 0
  ? await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: latestContextString }],
      tools: [PROFILE_TOOL_DEF],
      tool_choice: { type: 'tool', name: 'extract_creator_profile' },
    })
  : null

// Parse — guaranteed ToolUseBlock due to forced tool_choice
const stableBlock = stableResponse.content.find(
  (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
)
if (!stableBlock) throw new Error('Claude did not return tool_use block')
const stableProfile = stableBlock.input as CreatorProfile
```

### Pattern 3: Nullable Ticker in JSON Schema (anyOf)

**What:** Anthropic tool schemas do not support `nullable: true` keyword directly. Use `anyOf` to express nullable string.
**When to use:** `favoured_stocks[].ticker` (D-02) and `preferred_index_funds[].ticker` (D-03).

```typescript
// Source: AI-SPEC Section 4 — Tool Use
ticker: {
  anyOf: [{ type: 'string' }, { type: 'null' }],
  description: 'Stock symbol as cited by the creator (e.g. "AAPL"). Set to null if creator named the company but did not cite the ticker symbol.',
}
```

**Confidence:** HIGH — `anyOf` is standard JSON Schema; Anthropic accepts it in `input_schema`. [ASSUMED: exact Anthropic SDK version behaviour with anyOf not independently verified this session, but is the documented pattern for nullable fields in JSON Schema draft-07]

### Pattern 4: YouTube search.list + channels.list Batch

**What:** Two-step YouTube API call: search returns channel metadata without subscriber counts; second `channels.list?part=statistics` call batches all IDs.
**When to use:** `searchChannels()` in `youtube/client.ts`.

```typescript
// Source: verified pattern from AI-SPEC + googleapis v144 [ASSUMED: exact response shape from training]
const yt = getYouTubeClient()

// Step 1: search — 100 quota units
const searchRes = await yt.search.list({
  part: ['snippet'],
  q: query,
  type: ['channel'],
  maxResults: 5,
})

const channelIds = searchRes.data.items
  ?.map(item => item.snippet?.channelId)
  .filter((id): id is string => Boolean(id)) ?? []

if (channelIds.length === 0) return []

// Step 2: subscriber counts — 1 quota unit (batch all IDs)
const statsRes = await yt.channels.list({
  part: ['snippet', 'statistics'],
  id: channelIds,
})

// Merge: map channelId → subscriberCount
const statsMap = new Map(
  statsRes.data.items?.map(item => [
    item.id!,
    item.statistics?.subscriberCount ?? null,
  ]) ?? []
)

return channelIds.map(id => {
  const searchItem = searchRes.data.items?.find(i => i.snippet?.channelId === id)
  return {
    channelId: id,
    channelTitle: searchItem?.snippet?.channelTitle ?? '',
    channelUrl: `https://www.youtube.com/channel/${id}`,
    subscriberCount: statsMap.get(id) ? Number(statsMap.get(id)) : null,
    thumbnailUrl: searchItem?.snippet?.thumbnails?.default?.url ?? null,
  }
})
```

**Quota:** search.list = 100 units; channels.list = 1 unit. Total per search = ~101 units. [VERIFIED: AI-SPEC + CONTEXT.md D-17]

### Pattern 5: useActionState for Search Results

**What:** Next.js 15 `useActionState` wrapping a server action that returns search results. Same shape as existing `[customState, customAction, customPending]` pattern in `creators-tab.tsx`.
**When to use:** Search bar + results display in `CreatorsTab`.

```typescript
// Source: verified from creators-tab.tsx existing pattern
type SearchState = {
  results?: SearchResult[]
  error?: string
}

const [searchState, searchAction, searchPending] = useActionState<SearchState, FormData>(
  async (_prev, formData) => {
    const query = formData.get('channelQuery') as string
    if (!query?.trim()) return {}
    const result = await searchCreators(query)
    return result.error ? { error: result.error } : { results: result.data }
  },
  {}
)
```

### Pattern 6: listVideosLast4Months — Month Rollover

**What:** `setMonth(month - 4)` handles year boundary correctly (JS Date arithmetic). Replaces `setFullYear(year - 1)`.
**When to use:** `listVideosLast4Months` replacing `listVideosLast12Months`.

```typescript
// Source: CONTEXT.md D-11 specifics
export async function listVideosLast4Months(channelId: string): Promise<VideoItem[]> {
  const yt = getYouTubeClient()
  const uploadsPlaylistId = channelId.replace(/^UC/, 'UU')

  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 4)  // JS handles year rollover (e.g. Jan → Sep prior year)
  // Rest of implementation identical to listVideosLast12Months
  // ...
}
```

### Anti-Patterns to Avoid

- **Calling Claude with empty context:** If `stableChunks.length === 0`, throw immediately — do not call Claude. It will hallucinate a profile from training data. [VERIFIED: AI-SPEC Guardrails + existing extractor.ts pattern]
- **Promise.all on extraction calls:** Stable must succeed before attempting latest (D-06). Sequential only. [VERIFIED: AI-SPEC Section 4b + CONTEXT.md established pattern]
- **Auto-firing search on keypress:** 100 units per search.list call. Debounce input for UX but only fire on Enter or button press. [VERIFIED: CONTEXT.md D-19 + STATE.md key decisions]
- **Inferring tickers from company names:** System prompt must explicitly instruct Claude to set `ticker: null` when creator names a company but doesn't cite its symbol. [VERIFIED: AI-SPEC critical failure mode #1]
- **tool_choice.name mismatch:** `tool_choice.name` must exactly match the `name` field in the `tools` array. Mismatch returns HTTP 400. [VERIFIED: AI-SPEC pitfall #4]
- **Forgetting SQL migration before code:** The `allocation NOT NULL` constraint will cause 500 errors on every refresh if SQL migration hasn't been run. [VERIFIED: AI-SPEC critical failure mode #5]
- **Using `useActionState` for search state without proper reset:** When new search fires, show pending state and clear old results. Guard against stale results display.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured AI output | Custom JSON parser, regex extraction from prose | `tool_choice: { type: 'tool' }` forced tool use | Guarantees schema compliance; prose response is unreliable |
| Nullable JSON Schema fields | Custom schema workaround | `anyOf: [{ type: 'string' }, { type: 'null' }]` | Standard JSON Schema draft-07 pattern; Anthropic accepts it |
| Pinecone date filtering | Post-query JavaScript filter | Pinecone `filter` parameter in `ns.query()` | Server-side filtering; avoids fetching all vectors then discarding |
| Subscriber count formatting | Custom number formatter | Intl.NumberFormat or simple `(n >= 1e6 ? (n/1e6).toFixed(1)+'M' : ...)` | Trivial; don't abstract |
| YouTube channel ID from search result | URL parsing heuristics | `item.snippet.channelId` from search response | API returns it directly |

**Key insight:** The two hardest parts of this phase (structured extraction and date-range RAG) both have clean library solutions already in the codebase. The rewrite is primarily a schema and call-pattern change, not a capability addition.

---

## Common Pitfalls

### Pitfall 1: Pinecone Filter Silent Passthrough

**What goes wrong:** If the `filter` parameter is ignored (wrong syntax, wrong metadata key name), both stable and latest queries return the same unfiltered chunks. User sees identical layers.
**Why it happens:** Pinecone SDK silently ignores malformed filter syntax in some versions; no error is thrown.
**How to avoid:** After implementing, run a manual test: create a creator with vectors that span both windows, verify stable and latest return different chunk counts.
**Warning signs:** `profile_stable` and `profile_latest` JSONs are identical after a refresh on a creator with recent posts.
**Confirmed metadata key:** `published_at` — [VERIFIED: transcript-pipeline.ts line 276 metadata object].

### Pitfall 2: allocation NOT NULL Constraint Causes Silent 500s

**What goes wrong:** Phase 11 code INSERTs `creator_strategies` rows without `allocation`. If the column is still NOT NULL, every refresh throws a DB error.
**Why it happens:** Migration not run before code deployed.
**How to avoid:** SQL migration (D-13/D-14) is Wave 0 for Phase 11. Must run before any other wave.
**Warning signs:** Refresh button shows error state immediately after "Extracting stable profile..." step.

### Pitfall 3: Ticker Hallucination

**What goes wrong:** Claude resolves company names to well-known tickers ("Tesla" → "TSLA") even without explicit creator citation.
**Why it happens:** Claude's training knowledge maps company names to tickers.
**How to avoid:** System prompt must include explicit instruction: "Set `ticker` to null if the creator did not cite the stock symbol by name in the transcript." Reinforce in tool schema description.
**Warning signs:** Extractions consistently populate `ticker` on creators who never mention ticker symbols.

### Pitfall 4: Empty Latest Context Produces Hallucinated Profile

**What goes wrong:** If `latestChunks.length === 0` and the Claude call fires anyway, Claude produces a coherent-looking profile from training data (not from transcripts).
**Why it happens:** Empty `buildContextString([])` returns an empty string; Claude falls back to prior knowledge.
**How to avoid:** Guard `if (latestChunks.length === 0) { latestProfile = null; skip call }` — D-09. This is already a locked decision.
**Warning signs:** `profile_latest` is populated with high confidence for a creator who hasn't posted in months.

### Pitfall 5: search.list Returns `snippet.channelId` Not `id`

**What goes wrong:** Search result items use `item.snippet.channelId` for the channel ID, not `item.id` (which is a `{ kind, channelId }` object in channel-type searches).
**Why it happens:** YouTube API v3 search response shape differs from channels.list response shape.
**How to avoid:** Use `item.snippet?.channelId` when extracting IDs from search results; use `item.id` from channels.list response.
**Confidence:** MEDIUM — [ASSUMED: based on training knowledge of YouTube Data API v3 response shapes; verify in implementation against actual response]

### Pitfall 6: max_tokens Too Low for New Schema

**What goes wrong:** Tool output is truncated mid-array. Claude stops generating before all stocks/sectors are output.
**Why it happens:** Old `max_tokens: 1024` was sized for the small `extract_allocation` schema.
**How to avoid:** Use `max_tokens: 2048` for both calls. [VERIFIED: AI-SPEC Section 4]

### Pitfall 7: `trackSearchedCreator` Skips channel_id Resolution

**What goes wrong:** If `trackSearchedCreator` inserts a `creators` row without `channel_id`, the subsequent refresh pipeline will try to resolve it from a URL — but the URL was constructed as `youtube.com/channel/UCxxx` which resolves correctly via Strategy 1 in `resolveChannelId`. This is safe.
**Why it happens:** Not actually a pitfall — `trackSearchedCreator` inserts `channel_id` directly (D-18), so resolution step is bypassed entirely.
**Confirmation:** `resolveChannelId` Strategy 1 handles `/channel/UCxxx` URLs with zero quota cost — confirmed in `youtube/client.ts`.

---

## Code Examples

### Tool Schema — extract_creator_profile

```typescript
// Source: CONTEXT.md D-01, D-02, D-03 + AI-SPEC Section 4b
const PROFILE_TOOL_DEF: Anthropic.Tool = {
  name: 'extract_creator_profile',
  description:
    'Record what this creator expresses about their investment approach based on the transcript excerpts provided.',
  input_schema: {
    type: 'object' as const,
    properties: {
      methodology: {
        type: 'string',
        description: 'How the creator evaluates and selects investments (1-3 sentences, based only on what they express in transcripts).',
      },
      favoured_stocks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ticker: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
              description: 'Stock symbol as cited by the creator (e.g. "AAPL"). Set to null if creator named the company but did not cite the ticker symbol.',
            },
            name: { type: 'string' },
            rationale: { type: 'string' },
            conviction: { type: 'string', enum: ['high', 'medium', 'low'] },
          },
          required: ['ticker', 'name', 'rationale', 'conviction'],
        },
      },
      sector_focus: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            sector: { type: 'string' },
            stance: { type: 'string', enum: ['bullish', 'neutral', 'cautious'] },
            rationale: { type: 'string' },
          },
          required: ['sector', 'stance', 'rationale'],
        },
      },
      preferred_index_funds: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            ticker: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
              description: 'Fund ticker as cited by the creator. Null if not cited.',
            },
            rationale: { type: 'string' },
          },
          required: ['name', 'ticker', 'rationale'],
        },
      },
      confidence: {
        type: 'integer',
        minimum: 0,
        maximum: 100,
        description: 'How explicitly the creator discussed these positions (0 = vague inferences, 100 = stated explicit positions).',
      },
      source_video_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'Video IDs from chunk metadata that most influenced this extraction.',
      },
    },
    required: ['methodology', 'favoured_stocks', 'sector_focus', 'preferred_index_funds', 'confidence', 'source_video_ids'],
  },
}
```

### SQL Migration Snippet

```sql
-- Source: CONTEXT.md D-13, D-14
-- Run in Supabase SQL Editor before deploying Phase 11 code
ALTER TABLE creator_strategies
  ADD COLUMN IF NOT EXISTS profile_stable JSONB,
  ADD COLUMN IF NOT EXISTS profile_latest JSONB,
  ALTER COLUMN allocation DROP NOT NULL;
```

### System Prompt (compliant with CLAUDE.md)

```typescript
// Source: CONTEXT.md D-05 + AI-SPEC Section 4b prompt engineering rules
const SYSTEM_PROMPT = `You are analysing transcript excerpts from a finance content creator \
to identify what they express about their investment approach. \
Extract what the creator discusses: the companies and funds they cover, the sectors they focus on, \
and how they describe evaluating investments. \
Only include information the creator explicitly covers in the provided transcripts. \
Set ticker to null if the creator named a company but did not cite its stock symbol. \
Set conviction based only on the creator's language: words like "biggest holding", \
"very bullish", or "core position" indicate high conviction; passing mentions indicate low. \
Do not use the words "recommend", "advise", or "suggest". \
Describe only what the creator expresses.`
```

### Subscriber Count Formatting

```typescript
// Source: CONTEXT.md D-21
function formatSubscriberCount(count: number | null): string {
  if (count === null) return ''
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M subscribers`
  if (count >= 1_000) return `${(count / 1_000).toFixed(0)}K subscribers`
  return `${count} subscribers`
}
```

---

## Runtime State Inventory

> This phase renames `listVideosLast12Months` to `listVideosLast4Months` and changes the schema. Checking all runtime categories.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `creator_strategies` table: existing rows have `allocation` populated, `profile_stable`/`profile_latest` absent | SQL migration adds columns + drops NOT NULL; old rows untouched (D-14). No backfill. |
| Stored data (Pinecone) | Vectors older than 4 months exist in Pinecone namespaces per creator | No action — excluded via date filter only (D-12). No deletion. |
| Live service config | None — no external service config references the function name `listVideosLast12Months` | None |
| OS-registered state | None | None |
| Secrets/env vars | `YOUTUBE_API_KEY`, `PINECONE_API_KEY`, `PINECONE_INDEX_NAME`, `ANTHROPIC_API_KEY` — all unchanged | None — key names not changing |
| Build artifacts | `transcript-pipeline.ts` imports `listVideosLast12Months` by name — this import breaks when function is renamed | Code edit: update import in `transcript-pipeline.ts` line 34 and the call at line 139 |

**Nothing found requiring data migration beyond the SQL column additions.**

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `extract_allocation` — category % split (Index Funds/Stocks/Cash) | `extract_creator_profile` — stocks, methodology, sectors, funds | Phase 11 | Old `allocation` column kept nullable; `AllocationMap` type still in codebase but unused by new path |
| `listVideosLast12Months` — 12-month window | `listVideosLast4Months` — 4-month window | Phase 11 | Fewer videos per refresh; faster pipeline; older Pinecone vectors excluded via filter |
| Single Claude extraction call per refresh | Two sequential calls (stable + latest) | Phase 11 | `max_tokens` bumped 1024 → 2048 per call |
| URL-only creator add flow | Search bar primary + URL as collapsible fallback | Phase 11 | Phase 9 requirements absorbed into Phase 11 |

**Deprecated/outdated:**
- `QUERY_TEXTS` in current `extractor.ts`: allocation-focused queries replaced by new profile-focused query texts (D-10)
- `extract_allocation` tool definition: retired; replaced by `extract_creator_profile`
- `listVideosLast12Months`: removed (dead code after rename)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `anyOf: [{type:'string'},{type:'null'}]` works in Anthropic tool `input_schema` for nullable fields | Standard Stack / Code Examples | Low risk — this is the documented JSON Schema pattern; only risk is older SDK version rejecting it. SDK is `^0.95.0` which is current. |
| A2 | YouTube `search.list` response: channel ID is at `item.snippet.channelId` (not `item.id.channelId`) | Pattern 4 / Code Examples | Medium risk — if wrong, `channelIds` array will be empty and batch call will return nothing. Verify against actual response in implementation. |
| A3 | Pinecone SDK `^7.2.0` supports string `$gte` comparison for ISO date metadata | Pattern 1 | Medium risk — if Pinecone rejects string comparison, fall back to Unix timestamp (multiply ISO parse by 1). Confirmed ISO string storage format; filter syntax not tested in this session. |
| A4 | `googleapis ^144.0.0` `yt.search.list` accepts `type: ['channel']` as array (not `type: 'channel'` as string) | Pattern 4 | Low risk — googleapis TypeScript types enforce the correct shape; TS compiler will catch mismatch. |

---

## Open Questions

1. **Pinecone filter syntax — string vs numeric**
   - What we know: `published_at` is stored as ISO string (confirmed). Pinecone `$gte` works on strings lexicographically; ISO 8601 strings sort correctly lexicographically.
   - What's unclear: Whether Pinecone SDK v7.2.0 on the serverless index used by this project accepts `$gte` string comparison or requires numeric Unix timestamps.
   - Recommendation: Implement with ISO string filter first (simpler). If extraction returns 0 chunks unexpectedly, add a fallback test using `new Date(isoString).getTime()` as a numeric value.

2. **Contradiction check with null allocation**
   - What we know: `contradiction.ts` is not modified (D-15). It receives `prevAllocation` from the prior `creator_strategies` row.
   - What's unclear: If the prior row has `allocation = null` (a Phase 11 row), `runContradictionCheck(null, null)` is called. The current function must handle this gracefully.
   - Recommendation: Read `contradiction.ts` before implementing extractor rewrite. If it crashes on null/null input, add a null-guard. Since D-15 locks out modification, the guard must be minimal.

3. **`search.list` response item shape for channel-type searches**
   - What we know: `type: ['channel']` narrows results to channels. Snippets include `channelId`, `channelTitle`, `thumbnails`.
   - What's unclear: Exact field path (`item.id` vs `item.snippet.channelId`) — they may differ between search types.
   - Recommendation: Log first real API response during implementation; adjust field access before finalising.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@anthropic-ai/sdk` | `extractor.ts` rewrite | ✓ | `^0.95.0` | — |
| `@pinecone-database/pinecone` | Pinecone date filter queries | ✓ | `^7.2.0` | — |
| `googleapis` | `searchChannels()`, `listVideosLast4Months()` | ✓ | `^144.0.0` | — |
| `YOUTUBE_API_KEY` | YouTube API calls | ✓ (assumed set in .env.local) | — | Build fails at runtime without it |
| `PINECONE_API_KEY` | Pinecone queries | ✓ (assumed set) | — | — |
| `ANTHROPIC_API_KEY` | Claude calls | ✓ (assumed set) | — | — |
| `SUPABASE_SERVICE_ROLE_KEY` | `createServiceClient()` for DB writes | ✓ (in use since Phase 4) | — | — |
| `promptfoo` | Eval suite (AI-SPEC) | ✗ | — | Skip eval suite; run manual zod checks instead |

**Missing dependencies with no fallback:** None that block core implementation.

**Missing dependencies with fallback:** `promptfoo` — eval suite optional for Phase 11 execution; manual schema checks are sufficient.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | No test framework detected in `pulse/` [VERIFIED: package.json scan — no jest, vitest, playwright scripts] |
| Config file | None — Wave 0 gap |
| Quick run command | N/A until framework installed |
| Full suite command | N/A until framework installed |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CI-01 | `listVideosLast4Months` cutoff is 4 months, not 12 | unit | `npx vitest run tests/youtube-client.test.ts` | ❌ Wave 0 |
| CI-02 | Two-call extraction produces both `profile_stable` and `profile_latest` | unit (mocked Pinecone + Claude) | `npx vitest run tests/extractor.test.ts` | ❌ Wave 0 |
| CI-02 | Zero 30-day chunks → `profile_latest = null`, no Claude call | unit | same file | ❌ Wave 0 |
| CI-03 | `extract_creator_profile` schema: `ticker` nullable, all required fields present | unit (schema validation) | `npx vitest run tests/extractor-schema.test.ts` | ❌ Wave 0 |
| CI-03 | System prompt contains none of: "recommend", "advise", "suggest" | unit (string scan) | same file | ❌ Wave 0 |
| SRCH-01 | `searchChannels()` returns ≤5 results with correct shape | unit (mocked googleapis) | `npx vitest run tests/youtube-client.test.ts` | ❌ Wave 0 |
| SRCH-02 | Subscriber count formatted correctly (1.2M, 500K, etc.) | unit | `npx vitest run tests/search-result-formatting.test.ts` | ❌ Wave 0 |
| SRCH-03 | URL input visible when disclosure toggle open | manual smoke test | — | manual-only |

### Sampling Rate

- **Per task commit:** `npx vitest run` (once test infra exists)
- **Per wave merge:** Full vitest suite
- **Phase gate:** Suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `pulse/tests/extractor.test.ts` — covers CI-02 (two-call pattern, null latest profile)
- [ ] `pulse/tests/youtube-client.test.ts` — covers CI-01, SRCH-01
- [ ] `pulse/tests/extractor-schema.test.ts` — covers CI-03 (schema compliance, no-advice language)
- [ ] `pulse/tests/search-result-formatting.test.ts` — covers SRCH-02 formatting
- [ ] `vitest` install: `npm install -D vitest` in `pulse/` — no test runner currently in package.json
- [ ] `vitest.config.ts` — config file for Next.js environment compatibility

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No — server actions inherit existing Supabase session auth | Existing `createClient().auth.getUser()` pattern |
| V3 Session Management | No | Existing session handling unchanged |
| V4 Access Control | Yes — `trackSearchedCreator` inserts into `creators` table | Service-role client required (same as `addCustomCreator`); RLS bypass intentional and scoped |
| V5 Input Validation | Yes — `searchChannels(query)` receives user input | Sanitise/trim query string before passing to YouTube API; YouTube SDK handles encoding |
| V6 Cryptography | No | N/A |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Advice-language in system prompt / tool output | Information Disclosure (regulatory) | String scan in eval suite; SYSTEM_PROMPT constant reviewed in every PR touching extractor.ts |
| Unconstrained YouTube search quota burn | Denial of Service | Fire-on-submit-only (D-19); server action validates query non-empty before API call |
| Ticker hallucination feeding downstream buy decisions | Tampering | Explicit null instruction in system prompt + tool schema description; eval test case for null ticker discipline |
| `trackSearchedCreator` inserting arbitrary channel IDs | Spoofing | `channelId` validated as YouTube UC-format ID before insert (add regex: `/^UC[A-Za-z0-9_-]{22}$/`); `channelUrl` constructed server-side from channelId (not user-supplied) |

---

## Project Constraints (from CLAUDE.md)

| Directive | Applies to Phase 11 | How Addressed |
|-----------|-------------------|---------------|
| No "advice", "recommend", "suggest" in user-facing output | Yes — system prompt + tool output | SYSTEM_PROMPT constant explicitly omits these words; AI-SPEC eval tests for them |
| `decimal.js` for all £ arithmetic | No | Phase 11 has no monetary arithmetic |
| RAG pattern — never send full transcript dump to Claude | Yes | `retrieveChunks()` returns top-20 unique chunks via Pinecone; `buildContextString()` unchanged |
| Manual-first — no background jobs | Yes | Extraction still user-triggered (Refresh button); no cron or background polling added |
| ISA limit uses UK tax year (6 Apr – 5 Apr) | No | Phase 11 has no ISA/budget calculations |

---

## Sources

### Primary (HIGH confidence)

- `pulse/src/lib/strategy/extractor.ts` — current extraction pipeline; verified tool schema, query texts, DB write pattern
- `pulse/src/lib/pipeline/transcript-pipeline.ts` — confirmed `published_at` stored as ISO string (line 216); confirmed `listVideosLast12Months` import location (line 34, call at line 139)
- `pulse/src/lib/youtube/client.ts` — verified `listVideosLast12Months` implementation; `getYouTubeClient` singleton pattern
- `pulse/src/app/dashboard/creators-tab.tsx` — verified `useActionState` pattern; existing `customAction` shape for reuse
- `pulse/src/app/dashboard/creator-actions.ts` — verified `addCustomCreator` pattern; service-role client usage
- `.planning/phases/11-creator-intelligence-extraction/11-CONTEXT.md` — all locked decisions
- `.planning/phases/11-creator-intelligence-extraction/11-AI-SPEC.md` — framework selection, tool schema, eval strategy, guardrails
- `pulse/package.json` — verified all installed package versions

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` — CI-01 through CI-04, SRCH-01 through SRCH-03
- `.planning/ROADMAP.md` — Phase 11 success criteria
- `CLAUDE.md` — project constraints, tech stack
- `STATE.md` — accumulated context, key decisions

### Tertiary (LOW confidence — assumed)

- YouTube Data API v3 response shape for `search.list` channel-type results (A2) — [ASSUMED]
- Pinecone SDK `^7.2.0` string `$gte` filter behaviour (A3) — [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json
- Architecture: HIGH — all integration points confirmed in source code
- Pinecone filter syntax: MEDIUM — format confirmed (ISO string); `$gte` behaviour assumed correct
- YouTube API response shape: MEDIUM — known from training; verify on first real call
- Pitfalls: HIGH — derived from AI-SPEC + existing codebase patterns

**Research date:** 2026-05-19
**Valid until:** 2026-06-18 (stable stack; 30-day window reasonable)
