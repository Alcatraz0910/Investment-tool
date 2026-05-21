# Phase 11: Creator Intelligence Extraction — Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 11 rebuilds the creator data pipeline end-to-end. It delivers:

1. **New extraction schema** — Claude extracts richer creator profiles: favoured stocks (tickers + conviction + rationale), investment methodology, sector/industry focus, preferred index funds. The old category-% allocation model is retired.
2. **Two-layer AI extraction** — Every refresh produces two profiles: a stable summary (last 4 months) and a latest-signals snapshot (last 30 days). Stored separately; latest signals carry higher weight downstream.
3. **4-month scrape window** — Pipeline fetches videos from the last 4 months only (was 12 months). Old Pinecone vectors are kept but excluded via metadata date filter at query time.
4. **Creator search** — Users can discover creators by name via YouTube search (no URL required). Search bar replaces URL entry as the primary add-creator flow.

Phase ends when:
- A refresh produces both `profile_stable` and `profile_latest` JSONB rows in `creator_strategies`
- Creator search returns results inline and "Track" correctly adds the creator
- Transcript scrape window is 4 months
- Existing URL-based add flow still works as fallback

**Out of scope for Phase 11:**
- Watch list / buy list changes (Phase 12)
- News integration (Phase 13)
- Consensus/sentiment/contradiction redesign (Phase 14)
- Visual redesign (Phase 15)
- Contradiction check redesign (deferred to Phase 14 — existing `contradiction.ts` stays as-is; new rows just won't have `allocation` set)

</domain>

<decisions>
## Implementation Decisions

### Extraction Schema (new tool definition)

- **D-01:** The `extract_allocation` tool is replaced by a new `extract_creator_profile` tool. The old category-% allocation model (`Index Funds/Stocks/Cash`) is retired. The new schema:
  ```json
  {
    "methodology": "string — how the creator evaluates and selects investments (freeform, 1-3 sentences)",
    "favoured_stocks": [
      { "ticker": "AAPL", "name": "Apple Inc.", "rationale": "string", "conviction": "high|medium|low" }
    ],
    "sector_focus": [
      { "sector": "Technology", "stance": "bullish|neutral|cautious", "rationale": "string" }
    ],
    "preferred_index_funds": [
      { "name": "Vanguard FTSE All-World", "ticker": "VWRL", "rationale": "string" }
    ],
    "confidence": 0-100,
    "source_video_ids": ["string"]
  }
  ```
- **D-02:** `favoured_stocks.ticker` — use the ticker as mentioned by the creator (e.g. "AAPL", "MSFT"). Do not infer or clean. `ticker` may be null if creator names a company but doesn't cite its ticker.
- **D-03:** `preferred_index_funds.ticker` is nullable — many creators name funds without citing tickers.
- **D-04:** Tool is still called with `tool_choice: { type: 'tool', name: 'extract_creator_profile' }` — forced structured output, same pattern as Phase 4.
- **D-05:** System prompt is rewritten for the new schema. Must not contain "advice", "recommend", or "suggest" (CLAUDE.md constraint). Framed as observation of what the creator discusses/expresses.

### Two-Layer Extraction

- **D-06:** Every creator refresh runs two separate Claude calls: one for the stable layer, one for the latest layer. Both use `extract_creator_profile` with the same tool schema.
- **D-07:** Stable layer = Pinecone query filtered to `published_at >= (now - 4 months)`. This is effectively all available data after the window change.
- **D-08:** Latest layer = Pinecone query filtered to `published_at >= (now - 30 days)`. Uses Pinecone metadata filter `{ published_at: { $gte: thirtyDaysAgo.toISOString() } }`.
- **D-09:** If the 30-day Pinecone query returns 0 chunks (creator hasn't posted recently), skip the latest extraction entirely. Set `profile_latest = null`. No empty Claude call.
- **D-10:** Pinecone query strings are updated to match the new profile schema:
  - `"stocks shares companies favourite investments holdings"`
  - `"sector industry technology growth value dividend focus"`
  - `"index funds ETF passive portfolio methodology how I invest"`

### Transcript Scrape Window

- **D-11:** `listVideosLast12Months` in `pulse/src/lib/youtube/client.ts` is replaced by `listVideosLast4Months`. Same implementation — change cutoff from `setFullYear(year - 1)` to `setMonth(month - 4)`. Old function name becomes dead code and is removed.
- **D-12:** Existing Pinecone vectors older than 4 months are **not deleted**. They are excluded from extraction queries via Pinecone metadata date filter. No Pinecone cleanup required in this phase.

### DB Schema

- **D-13:** Two new nullable JSONB columns added to `creator_strategies` table via SQL migration snippet (same delivery pattern as Phase 7/8 — user runs in Supabase SQL Editor):
  - `profile_stable JSONB NULL` — stable 4-month extraction result
  - `profile_latest JSONB NULL` — latest 30-day extraction result
- **D-14:** Existing `allocation JSONB` column is kept and made nullable (was previously always populated). Old rows remain untouched. New extractions leave `allocation = NULL` and populate `profile_stable` / `profile_latest` instead.
- **D-15:** No changes to `has_contradiction`, `contradiction_note`, or the contradiction check logic. These will be revisited in Phase 14.

### Creator Search

- **D-16:** New `searchChannels(query: string)` function added to `pulse/src/lib/youtube/client.ts`. Uses `youtube.search.list` with `type: 'channel'`, returns max 5 results: `{ channelId, channelTitle, channelUrl, subscriberCount, thumbnailUrl }`.
- **D-17:** Subscriber count requires a second `channels.list` call (search results don't include it). Batch all 5 result IDs into one `channels.list?part=statistics` call — 1 additional quota unit.
- **D-18:** New server action `trackSearchedCreator(channelId, channelTitle, thumbnailUrl)` in `creator-actions.ts`. Inserts directly into `creators` with `channel_id` already set (bypasses URL validation and the URL-resolution step in the pipeline). Then inserts `user_creators` row. Note: `channelUrl` is constructed server-side as `https://www.youtube.com/channel/${channelId}` — it is NOT a parameter (security: prevents user-supplied URL injection).
- **D-19:** In `CreatorsTab`, the existing URL input form is replaced as the primary entry with a search bar. Search fires on Enter or explicit button press only (500ms debounce on input, but doesn't auto-fire — matches ROADMAP.md quota decision for Phase 9). Results appear inline below the search bar as a compact list (max 5).
- **D-20:** The URL input field is preserved as a fallback below the search results area, collapsed under a "Add by URL instead" toggle/disclosure. `addCustomCreator` server action is unchanged.
- **D-21:** Each search result card shows: channel thumbnail (40×40px), channel name, formatted subscriber count (e.g. "1.2M subscribers"), and a "Track" button. If the channel is already tracked, "Track" is replaced with "Tracking ✓" (disabled).

### Claude's Discretion

- Exact Pinecone filter syntax for date comparison (string vs timestamp — test both; use whichever Pinecone accepts)
- Ordering of stable vs latest extraction call (stable first recommended — cheaper to fail fast if stable returns nothing)
- Error handling when `profile_stable` extraction fails — surface in `refresh_jobs.step` as current pattern

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Constraints
- `CLAUDE.md` — no "advice/recommend/suggest" language; decimal.js mandate; RAG pattern (never full transcript dump); manual-refresh-only model
- `.planning/PROJECT.md` — project goals, constraints, key decisions table
- `.planning/REQUIREMENTS.md` — CI-01 through CI-04 (Phase 11 requirements); SRCH-01 through SRCH-03 (creator search, now part of Phase 11)

### Roadmap & Phase Goals
- `.planning/ROADMAP.md` §Phase 11 — success criteria, phase boundary

### Existing Pipeline Code
- `pulse/src/lib/pipeline/transcript-pipeline.ts` — full refresh orchestrator; `runRefreshPipeline` drives the chain. The 4-month window change (`listVideosLast12Months` → `listVideosLast4Months`) modifies this file's import.
- `pulse/src/lib/youtube/client.ts` — `listVideosLast12Months` (to be renamed/replaced), `resolveChannelId`, `getYouTubeClient`. New `searchChannels` and `listVideosLast4Months` functions added here.
- `pulse/src/lib/strategy/extractor.ts` — full extraction logic to be rewritten. New tool schema, new system prompt, two-call pattern replaces single call. This file is the primary implementation target.
- `pulse/src/lib/strategy/contradiction.ts` — do NOT modify in Phase 11. Will be revisited in Phase 14.

### Existing Creator UI Code
- `pulse/src/app/dashboard/creators-tab.tsx` — creator tab component; search bar replaces URL form as primary add flow. `useActionState` + `addCustomCreator` pattern reused for `trackSearchedCreator`.
- `pulse/src/app/dashboard/creator-actions.ts` — `addCustomCreator`, `trackCreator`, `untrackCreator`. New `trackSearchedCreator` added here.

### Prior Phase Decisions
- `.planning/phases/08-live-price-data/08-CONTEXT.md` — SQL migration delivery pattern (user runs snippet in Supabase SQL Editor); service-role Supabase client pattern
- `.planning/phases/04-strategy-extraction-blending/04-CONTEXT.md` — original extraction decisions (D-04 forced tool_use, D-05 tool schema, D-06 3-query RAG pattern) — these are the decisions being superseded

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `extractor.ts` `retrieveChunks()` — existing Pinecone 3-query retrieval; reuse structure but add `filter` parameter for date range and update query texts (D-10)
- `extractor.ts` `buildContextString()` — unchanged; still builds the Claude user message from chunk metadata
- `creator-actions.ts` `addCustomCreator` — `useActionState` + `FormData` pattern; `trackSearchedCreator` follows same shape but simpler (no URL validation)
- `creators-tab.tsx` `[customState, customAction, customPending]` pattern — reuse for search state management
- Framer Motion `AnimatePresence` — already used in tab; use for search result list enter/exit animation

### Established Patterns
- **Forced tool_use**: `tool_choice: { type: 'tool', name: 'extract_creator_profile' }` — guarantees structured output, prevents Claude prose response
- **Service-role client**: All pipeline DB writes use `createServiceClient()` (RLS bypass)
- **`refresh_jobs` step tracking**: `setStep()` in `transcript-pipeline.ts` — update step labels for the new two-call flow (e.g. "Extracting stable profile…", "Extracting latest signals…")
- **Sequential video fetch**: No `Promise.all` on transcript fetches (RESEARCH Anti-Pattern T-03-04-05)
- **Pinecone namespace per creator**: `getPineconeNamespace(creatorId)` — unchanged

### Integration Points
- `creator_strategies` table — new `profile_stable` and `profile_latest` JSONB columns via SQL migration; `allocation` made nullable
- `pulse/src/lib/youtube/client.ts` — add `listVideosLast4Months` and `searchChannels` functions
- `pulse/src/lib/strategy/extractor.ts` — full rewrite: new tool schema, new query texts, two extraction calls, new DB write pattern
- `pulse/src/app/dashboard/creators-tab.tsx` — search bar UI replaces URL input as primary; URL input preserved as collapsed fallback
- `pulse/src/app/dashboard/creator-actions.ts` — new `trackSearchedCreator` server action

</code_context>

<specifics>
## Specific Ideas

- Pinecone date filter syntax: `filter: { published_at: { $gte: new Date(Date.now() - 4 * 30 * 24 * 60 * 60 * 1000).toISOString() } }` — test this in the filter param of `ns.query()`
- `searchChannels` quota note: `search.list` costs 100 units/call; `channels.list` for subscriber counts costs 1 unit. Total per search: ~101 units. Must never auto-fire on keypress — only on Enter or button press.
- `listVideosLast4Months` cutoff: `const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 4)` — handles month rollover correctly (JS Date handles year boundary)
- SQL migration snippet for review by user before running:
  ```sql
  ALTER TABLE creator_strategies
    ADD COLUMN IF NOT EXISTS profile_stable JSONB,
    ADD COLUMN IF NOT EXISTS profile_latest JSONB,
    ALTER COLUMN allocation DROP NOT NULL;
  ```

</specifics>

<deferred>
## Deferred Ideas

- **Contradiction check redesign** — the current `contradiction.ts` compares `AllocationMap` % deltas. With the new schema (no %s), it needs rethinking. Deferred to Phase 14 (Creator Signals + Housekeeping).
- **Creator profile display** — how `profile_stable` and `profile_latest` are rendered on the creator card is Phase 12 scope (Watch List + Per-Creator Budget).
- **Backfill old creator strategies** — re-running extraction on existing tracked creators after the schema change. This is a user-triggered action (click Refresh per creator) not an automated migration.

</deferred>

---

*Phase: 11-Creator Intelligence Extraction*
*Context gathered: 2026-05-18*
