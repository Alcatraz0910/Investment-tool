# Phase 4: Strategy Extraction & Blending - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the strategy extraction and blending pipeline: after a creator Refresh completes, automatically call Claude (via RAG on Pinecone chunks) to extract a versioned, confidence-scored asset allocation strategy, detect contradictions with the prior version, and display the result on the creator card. Also build the per-creator trust weight UI (global slider + expandable per-category) and the `StrategyBlender.ts` module that produces a unified weighted target allocation from all tracked creators.

Phase ends when STRAT-01 through STRAT-04 and BLEND-01 through BLEND-03 pass and all 5 success criteria are met.

**Out of scope for Phase 4:**
- Buy List / PlanGenerator (Phase 5)
- ISA allowance capping logic (Phase 5)
- Contribution Calculator slider (Phase 5)
- Premium glassmorphism UI system (Phase 6)
- Roadmap View trajectory charts (Phase 6)
- Background jobs or automated polling (v1 is manual-only)

</domain>

<decisions>
## Implementation Decisions

### Extraction Trigger
- **D-01:** Strategy extraction runs **automatically at the end of the Refresh pipeline** — no separate button. One Refresh click triggers: fetch → embed → extract strategy. Consistent with ROADMAP wording: "After a creator Refresh, a new strategy snapshot is generated."
- **D-02:** Extraction failure is **non-blocking**. If transcript pipeline succeeds but Claude extraction fails, the Refresh is still marked successful. A non-blocking warning is shown: "Transcripts refreshed. Strategy extraction failed — try again later." This avoids a YouTube/Pinecone success being reported as failure.
- **D-03:** Extraction progress is shown by **extending the existing Phase 3 step-status line** below the Refresh button. Add "Extracting strategy..." as a final step, consistent with the "Fetching videos... 12/12" / "Embedding chunks... 8/12 videos" pattern already approved in Phase 3 (03-CONTEXT.md D-02).

### Claude Model & RAG Configuration
- **D-04:** Use **`claude-sonnet-4-6`** for strategy extraction. Finance YouTubers use plain language; the extraction task doesn't require Opus-level reasoning. Sonnet-4-6 is the primary model in CLAUDE.md.
- **D-05:** Enforce structured output via **tool_use / function calling**. Define a tool schema for the strategy output — Claude is forced to return valid JSON matching the schema. No JSON.parse fragility from message-body extraction.
- **D-06:** Retrieve **top 20 Pinecone chunks** per extraction call (~10,000 tokens of context). Uses `getPineconeNamespace(creatorId)` already defined in `pulse/src/lib/pinecone/client.ts`. Query text should represent the creator's investment philosophy / asset allocation stance.
- **D-07:** No Anthropic SDK is currently installed. Phase 4 must add `@anthropic-ai/sdk` to `pulse/package.json`. Create a singleton client at `pulse/src/lib/anthropic/client.ts` (server-only), following the same singleton pattern as `lib/openai/client.ts` and `lib/pinecone/client.ts`.

### Trust Weight UI
- **D-08:** Show a **global trust weight slider (0–100%) by default**, with a "Customize per category" toggle that reveals 8 per-category sliders. Reduces clutter for the common case while fulfilling BLEND-01. The global weight maps to `user_creators.trust_weight`; per-category overrides to `user_creator_category_weights`.
- **D-09:** Trust weight controls live **inline on the creator card in the Creators tab** — the same expanded section already established in Phase 3. Contextually coherent: set trust while viewing the creator's strategy.
- **D-10:** Weight changes **auto-save on slider release** (debounced on mouseup/touchend). No explicit Save button. Confirm with a brief green tick. Consistent with modern slider UX.

### Contradiction Detection & Display
- **D-11:** When a new strategy extraction shows a category shift >15% vs the most recent prior version, display an **amber badge + expandable diff** on the creator card:
  ```
  ⚠ Strategy shift detected
  Tech:      40% → 65%  (+25%) ⚠
  Dividends: 30% → 15%  (-15%) ⚠
  Bonds:     20% → 10%  (-10%)
  ```
  Only categories with >15% shift are flagged with ⚠. Others are shown for context.
- **D-12:** The contradiction flag **auto-clears on the next successful extraction** where all category diffs are ≤15%. No user dismissal required.

### Claude's Discretion
- Exact system prompt wording for strategy extraction (must not use "advice", "recommend", "suggest" per CLAUDE.md).
- Pinecone query text used to retrieve relevant chunks (suggested: multiple queries covering "asset allocation", "investment strategy", "portfolio approach" to maximise coverage).
- Confidence score calculation method (Claude self-rates 0–100% in the tool_use response based on how explicitly the creator stated allocations).
- How to handle categories the creator never mentions (suggest: omit the category from the allocation JSONB rather than defaulting to 0%).
- `creator_strategies` column `source_video_ids` format: array of video IDs (UUIDs from `transcripts` table) cited in the extraction.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Requirements
- `.planning/ROADMAP.md` §Phase 4 — Plans (5 tasks), success criteria (5 criteria), tech choices
- `.planning/REQUIREMENTS.md` §Strategy Extraction (STRAT-01–04) and §Creator Trust & Blending (BLEND-01–03)
- `.planning/PROJECT.md` — Tech stack, key decisions, out-of-scope items

### Critical Constraints
- `CLAUDE.md` §Critical Constraints — no "advice/recommend/suggest" language, RAG pattern (never send full transcripts to Claude), `decimal.js` for £, manual-first v1

### Schema
- `.planning/phases/01-foundation/schema.sql` — Full DB schema. Key tables:
  - Table 3 `user_creators`: `trust_weight NUMERIC(5,2)` global default (0–100)
  - Table 3a `user_creator_category_weights`: per-category weight overrides; FK → `user_creators.id`; `category` CHECK constraint matches `AssetCategory` enum
  - Table 7 `creator_strategies`: `creator_id`, `allocation JSONB`, `confidence_score`, `source_video_ids UUID[]`, `extracted_at`, `version INT`; RLS: user can SELECT if they track the creator
  - Table 8 `buy_lists`: `unified_allocation JSONB` snapshot of blended strategy used for each plan

### Prior Phase Decisions
- `.planning/phases/03-transcript-pipeline/03-CONTEXT.md` — D-02 (step-status format: "Fetching videos... 12/12", "Embedding chunks..."), D-01 (API Route pattern with `maxDuration=300`), D-12 (service role for DB writes bypassing RLS)
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-03 (no CLI migrations), D-04 (JSONB allocation format)

### Existing Code (read before planning)
- `pulse/src/lib/pinecone/client.ts` — `getPineconeNamespace(creatorId)` already returns a namespace-scoped Index handle; Phase 4 RAG queries call `.query()` on this
- `pulse/src/lib/openai/client.ts` — Singleton pattern to follow for new `lib/anthropic/client.ts`
- `pulse/src/lib/pipeline/transcript-pipeline.ts` — Phase 4 extraction is appended here or called from it after embed step completes
- `pulse/src/types/index.ts` — `AssetCategory` (8 categories), `UserCreator`, `UserCreatorCategoryWeight` types already defined; Phase 4 adds `CreatorStrategy` and `BlendedStrategy` types
- `pulse/src/app/dashboard/page.tsx` — dashboard entry; Creators tab extended by Phase 4 strategy card UI

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getPineconeNamespace(creatorId)` in `pulse/src/lib/pinecone/client.ts` — call `.query({ vector, topK: 20, includeMetadata: true })` for RAG retrieval; namespace already scoped to creator
- `AssetCategory` type in `pulse/src/types/index.ts` — enforces the 8 standard category names across extraction output, weight sliders, and blender
- `UserCreatorCategoryWeight` interface — already typed; Phase 4 implements the DB writes and UI for it
- Existing step-status pattern in Phase 3 refresh button — extend with "Extracting strategy..." step (D-03)
- `pulse/src/lib/supabase/service.ts` — service role client for writes to `creator_strategies` (same pattern as transcript pipeline writes)

### Established Patterns
- **Singleton server-only clients:** `lib/openai/client.ts`, `lib/pinecone/client.ts` — follow this exact pattern for `lib/anthropic/client.ts`
- **API Route for long-running ops:** Phase 3 uses `POST /api/refresh/[creatorId]` with `maxDuration=300` — strategy extraction appends to this route or is a new route called from it
- **Dark zinc theme:** `bg-zinc-900 / bg-zinc-800 border border-zinc-700 rounded-xl` — apply to strategy card, weight sliders, contradiction diff panel
- **Server actions for mutations:** Co-located `actions.ts` — use for saving trust weight changes (auto-save on slider release, D-10)
- **`decimal.js` for £:** Not directly relevant to extraction, but `StrategyBlender.ts` output feeds Phase 5 which requires it

### Integration Points
- `transcript-pipeline.ts` → Phase 4 extraction step appended at the end (or called from the refresh API Route after pipeline completes)
- `creator_strategies` table — Phase 4 owns all INSERT operations (service role); Phase 5 reads latest version for blending
- `user_creator_category_weights` table — Phase 4 owns all CRUD; Phase 5 reads for blending
- `StrategyBlender.ts` output (`BlendedStrategy`) — consumed by Phase 5 `PlanGenerator.ts`; must be importable as a pure TypeScript module

</code_context>

<specifics>
## Specific Ideas

- **Contradiction diff layout approved:** Amber badge "⚠ Strategy shift detected" + expandable table showing `Category: old% → new% (±delta%)` with ⚠ icon only on rows exceeding 15%.
- **Step-status extension:** "Extracting strategy..." appended to existing Phase 3 status line format.
- **Auto-save confirmation:** Brief green tick on slider release (no toast library needed — inline state transition).
- **Global → per-category weight toggle:** "Customize per category" collapsible — default collapsed to keep the card clean.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 4-Strategy-Extraction-Blending*
*Context gathered: 2026-05-07*
