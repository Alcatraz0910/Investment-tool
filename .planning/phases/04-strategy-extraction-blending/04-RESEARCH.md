# Phase 4: Strategy Extraction & Blending - Research

**Researched:** 2026-05-07
**Domain:** Anthropic SDK tool_use, RAG pipeline, strategy versioning, weighted blending, Next.js 15 server actions
**Confidence:** HIGH

---

## Summary

Phase 4 adds Claude-powered extraction and user-controlled blending on top of the Phase 3
transcript pipeline. The extraction step hooks into `runRefreshPipeline` after the embed loop
(Step 6) completes, calls Claude via `@anthropic-ai/sdk` tool_use to produce a structured
`AllocationMap`, writes a new `creator_strategies` row (service role, bypasses RLS), and runs a
contradiction check against the previous row. The trust weight UI uses inline server actions in
`dashboard/page.tsx`-adjacent components, auto-saving on `onMouseUp` / `onTouchEnd`. The
`StrategyBlender.ts` module is a pure TypeScript function with no I/O — it receives loaded data
from the caller and returns a `BlendedStrategy`.

**Primary recommendation:** Keep extraction as a standalone `extractStrategy(creatorId)` function
called from the refresh route after `runRefreshPipeline` returns (not inlined in the pipeline
function). This respects D-02 (non-blocking failure) without complicating pipeline error handling.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Auto-extract at end of Refresh pipeline (no separate button).
- **D-02:** Non-blocking failure — if extraction fails, Refresh is still marked successful; show "Strategy extraction failed — try again later" warning.
- **D-03:** Extend Phase 3 step-status with "Extracting strategy..." as final step.
- **D-04:** `claude-sonnet-4-6` model.
- **D-05:** tool_use / function calling for structured JSON output.
- **D-06:** Top 20 Pinecone chunks; use `getPineconeNamespace(creatorId)`.
- **D-07:** Install `@anthropic-ai/sdk`; create `lib/anthropic/client.ts` singleton (server-only).
- **D-08:** Global trust weight slider + "Customize per category" toggle → 8 per-category sliders.
- **D-09:** Trust weight controls inline on creator card.
- **D-10:** Auto-save on slider release; green tick confirmation.
- **D-11:** Amber badge + expandable diff for >15% allocation shifts.
- **D-12:** Contradiction auto-clears on next successful extraction where all diffs ≤15%.

### Claude's Discretion

- Exact system prompt wording (must avoid "advice", "recommend", "suggest").
- Pinecone query text (multiple sub-queries recommended for coverage).
- Confidence score calculation method (Claude self-rates 0–100 in tool response).
- Categories not mentioned by creator: omit from allocation JSONB (do not default to 0%).
- `source_video_ids` format: array of YouTube video IDs from Pinecone metadata.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STRAT-01 | Claude extracts implied asset allocation via RAG → structured `AllocationMap` | Tool_use pattern verified; Pinecone query call verified from existing client |
| STRAT-02 | Each extraction versioned — every refresh creates new snapshot, full history preserved | Schema confirmed: each INSERT creates new row (no UPDATE); latest = `ORDER BY created_at DESC LIMIT 1` |
| STRAT-03 | Strategy output includes confidence score (0–100%) and source video IDs | Modelled in `CreatorStrategy` type; tool schema must request both fields |
| STRAT-04 | Contradiction vs prior version flagged on strategy card | Algorithm defined; `has_contradiction` / `contradiction_note` columns exist in schema |
| BLEND-01 | Per-category trust weight UI (Confidence Slider per creator per category) | `user_creator_category_weights` table exists with correct CHECK; server action pattern identified |
| BLEND-02 | PlanGenerator blends strategies using category weights → unified target allocation | `StrategyBlender.ts` pure function design documented; formula from REQUIREMENTS.md |
| BLEND-03 | Dashboard Blend Summary: per-creator influence % | Derived from blender output; no new schema needed |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Strategy extraction (Claude call) | API / Backend | — | Server-only: API key never reaches browser; long-running (30–60 s) |
| Pinecone RAG query | API / Backend | — | Server-only: Pinecone API key must stay server-side |
| `creator_strategies` INSERT | API / Backend | — | Service role write bypasses RLS; service client is server-only |
| Contradiction detection | API / Backend | — | Pure logic co-located with extraction |
| `StrategyBlender.ts` computation | API / Backend | — | Pure TS module; called from API route or server component |
| Trust weight slider UI | Browser / Client | Frontend Server (SSR) | Interactive slider is client component; save is server action |
| Blend Summary display | Frontend Server (SSR) | — | Read-only data display; server component fetch is sufficient |
| Strategy card contradiction badge | Frontend Server (SSR) | — | Reads `has_contradiction` flag; static until next refresh |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | `^0.95.0` | Claude API client (tool_use, messages) | Official Anthropic SDK; only official client for Claude API [VERIFIED: npm registry] |
| `@pinecone-database/pinecone` | `^7.2.0` | Vector query for RAG | Already installed (Phase 3) [VERIFIED: pulse/package.json] |
| `decimal.js` | `^10.6.0` | `StrategyBlender.ts` percentage arithmetic | Project-wide constraint from CLAUDE.md [VERIFIED: pulse/package.json] |

### Already Installed (no action needed)

| Library | Purpose |
|---------|---------|
| `@supabase/supabase-js` | `creator_strategies` INSERT, weight reads |
| `openai` | Embedding queries (RAG vector generation) |
| `framer-motion` | Trust weight slider animations, contradiction diff expand/collapse |

**Installation required for Phase 4:**
```bash
cd pulse && npm install @anthropic-ai/sdk
```

**Version verified:** `@anthropic-ai/sdk@0.95.0` is current as of 2026-05-07. [VERIFIED: npm registry]

---

## Architecture Patterns

### System Architecture Diagram

```
POST /api/refresh/[creatorId]
        │
        ├── runRefreshPipeline() ─────────────────────────────────────┐
        │    Steps 1-8 (Phase 3 pipeline)                              │
        │    setStep(..., "Extracting strategy...")  ◄── new Step 9   │
        └──────────────────────────────────────────────────────────────┘
                │
                ▼ (non-blocking: wrapped in try/catch in route handler)
        extractCreatorStrategy(creatorId, userId)
                │
        ┌───────▼───────────────────────────────────┐
        │  1. Embed query text (OpenAI)              │
        │  2. Query Pinecone top-20 chunks           │
        │     getPineconeNamespace(creatorId).query  │
        │  3. Build context string from metadata     │
        │  4. Call Claude claude-sonnet-4-6           │
        │     tool_use: extract_allocation           │
        │  5. Parse ToolUseBlock.input               │
        └───────────────────────────────────────────┘
                │
                ▼
        loadPreviousStrategy(creatorId) ← Supabase SELECT
                │
                ▼
        runContradictionCheck(prev, next) → has_contradiction, note
                │
                ▼
        INSERT creator_strategies (service role)
                │
                ▼ (refresh route)
        return 200 with extraction status in response body


Browser (Creator Card)
        │
        ├── Read: creator_strategies latest row (server component)
        ├── Display: AllocationMap, confidence, contradiction badge
        │
        ├── TrustWeightSlider (client component)
        │    onMouseUp/onTouchEnd → Server Action: saveWeight(userCreatorId, category, value)
        │    Optimistic: setOptimisticWeight(value); on confirm show green tick
        │
        └── StrategyBlender.ts (called from server component / API route)
             inputs: CreatorStrategy[], UserCreator[] (with weights)
             output: BlendedStrategy { unified: AllocationMap, influence: Record<string, number> }
```

### Recommended Project Structure

```
pulse/src/
├── lib/
│   ├── anthropic/
│   │   └── client.ts              # Anthropic singleton (D-07)
│   ├── strategy/
│   │   ├── extractor.ts           # extractCreatorStrategy() — RAG + Claude call
│   │   ├── contradiction.ts       # runContradictionCheck() — pure function
│   │   └── blender.ts             # StrategyBlender (BLEND-02/03)
│   └── pipeline/
│       └── transcript-pipeline.ts # Extend: add setStep "Extracting strategy..."
├── app/
│   ├── api/
│   │   └── refresh/[creatorId]/
│   │       └── route.ts           # Extend: call extractCreatorStrategy after pipeline
│   └── dashboard/
│       ├── components/
│       │   ├── TrustWeightSlider.tsx  # Client component (D-08/09/10)
│       │   └── ContradictionDiff.tsx  # Amber badge + diff table (D-11)
│       └── actions.ts             # saveWeight() server action
└── types/
    └── index.ts                   # Add BlendedStrategy type
```

### Pattern 1: Anthropic Singleton (lib/anthropic/client.ts)

**What:** Server-only singleton following the exact pattern of `lib/openai/client.ts`.
**When to use:** Any server-side code calling Claude API.

```typescript
// Source: Context7 /anthropics/anthropic-sdk-typescript + lib/openai/client.ts pattern
import 'server-only'
import Anthropic from '@anthropic-ai/sdk'

let cached: Anthropic | null = null

export function getAnthropic(): Anthropic {
  if (cached) return cached
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. ' +
      'Add it to .env.local. ' +
      'Get one from https://console.anthropic.com/settings/keys'
    )
  }
  cached = new Anthropic({ apiKey: key })
  return cached
}
```

### Pattern 2: tool_use for Structured Strategy Output

**What:** Force Claude to return a known JSON structure by defining a single tool and setting
`tool_choice: { type: 'tool', name: 'extract_allocation' }`. This guarantees the response is
a `ToolUseBlock` — no JSON.parse fragility from message text.

**Key insight from SDK docs:** Use `tool_choice: { type: 'tool', name: '...' }` to force a
specific tool call. Use `tool_choice: { type: 'any' }` if any tool is acceptable. [VERIFIED: Context7 /anthropics/anthropic-sdk-typescript]

```typescript
// Source: Context7 /anthropics/anthropic-sdk-typescript
import Anthropic from '@anthropic-ai/sdk'

const TOOL_DEF: Anthropic.Tool = {
  name: 'extract_allocation',
  description:
    'Record the asset allocation strategy inferred from the creator\'s transcripts. ' +
    'Only include categories the creator explicitly or strongly implies. ' +
    'Omit categories not discussed.',
  input_schema: {
    type: 'object',
    properties: {
      allocations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: ['Tech','Dividends','Bonds','Commodities','Cash','Emerging Markets','Small Cap','REITs'],
            },
            allocation_pct: {
              type: 'number',
              description: 'Percentage of portfolio (0–100). Values across all categories need not sum to exactly 100.',
            },
          },
          required: ['category', 'allocation_pct'],
        },
      },
      confidence: {
        type: 'integer',
        description: 'How explicitly the creator stated these allocations (0 = purely inferred, 100 = stated exact percentages).',
        minimum: 0,
        maximum: 100,
      },
      source_video_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'YouTube video IDs (from chunk metadata) that most influenced this extraction.',
      },
    },
    required: ['allocations', 'confidence', 'source_video_ids'],
  },
}

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  system: SYSTEM_PROMPT,  // see Prompt Design section
  messages: [{ role: 'user', content: contextString }],
  tools: [TOOL_DEF],
  tool_choice: { type: 'tool', name: 'extract_allocation' },
})

// Extract tool_use block — guaranteed to exist because tool_choice is forced
const toolUse = response.content.find(
  (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
)
if (!toolUse) throw new Error('Claude did not return tool_use block')

// toolUse.input is typed as Record<string, unknown> — cast to expected shape
const input = toolUse.input as {
  allocations: Array<{ category: string; allocation_pct: number }>
  confidence: number
  source_video_ids: string[]
}
```

### Pattern 3: RAG Query for Strategy Extraction

**What:** Embed multiple query strings, query Pinecone for top-20 across all queries, deduplicate
by vector ID, build context string from metadata.

**Why multiple sub-queries:** Finance creators discuss allocations across many video contexts —
a single "asset allocation" query may miss value-investor or sector-specific language. Three
queries with different framings maximise chunk coverage without multiplying token cost much.
[ASSUMED] — multiple sub-query strategy is a common RAG best practice; optimal query count
not verified experimentally for this domain.

```typescript
// Source: lib/pinecone/client.ts pattern + Pinecone SDK docs
import { embedChunks } from '@/lib/openai/client'
import { getPineconeNamespace } from '@/lib/pinecone/client'

const QUERY_TEXTS = [
  'asset allocation portfolio percentage breakdown',
  'investment strategy how I invest my money sectors',
  'portfolio approach growth dividends bonds cash weighting',
]

async function retrieveChunks(creatorId: string) {
  const ns = getPineconeNamespace(creatorId)
  const vectors = await embedChunks(QUERY_TEXTS)

  const allMatches = new Map<string, { score: number; metadata: Record<string, unknown> }>()

  for (const vector of vectors) {
    // Pinecone SDK v7: query returns { matches: [...] }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (ns as any).query({
      vector,
      topK: 20,
      includeMetadata: true,
    })
    for (const match of result.matches ?? []) {
      // Deduplicate by vector ID; keep highest score
      const existing = allMatches.get(match.id)
      if (!existing || match.score > existing.score) {
        allMatches.set(match.id, { score: match.score, metadata: match.metadata ?? {} })
      }
    }
  }

  // Sort by score descending, return top 20 unique chunks
  return [...allMatches.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
}

function buildContextString(
  chunks: Array<{ score: number; metadata: Record<string, unknown> }>
): string {
  return chunks
    .map((c, i) => {
      const m = c.metadata
      return [
        `[Chunk ${i + 1}]`,
        `Video: ${m.title ?? 'Unknown'} (${m.published_at ?? ''})`,
        `Video ID: ${m.video_id ?? ''}`,
        `Text: ${m.text ?? ''}`,  // 'text' field — confirm stored in Pinecone metadata
      ].join('\n')
    })
    .join('\n\n---\n\n')
}
```

**IMPORTANT PITFALL — Pinecone metadata does not include chunk text by default.**
The Phase 3 pipeline stores metadata fields: `creator_id`, `video_id`, `title`, `chunk_index`,
`published_at`. It does NOT store the chunk text in metadata. [VERIFIED: transcript-pipeline.ts line 278-284]

This means RAG queries return metadata without the actual text content. The extractor must
either: (a) fetch chunk text from Supabase `transcripts.raw_text` + re-chunk by index, or
(b) store `text` in Pinecone metadata at embed time.

**Recommended resolution (Claude's discretion):** Option (b) — store `text` field in Pinecone
metadata during Phase 4's embedding step. This requires updating the upsert records in
`transcript-pipeline.ts` to include `text: chunks[idx]` alongside existing metadata. This is a
small backward-compatible change (existing vectors lack `text`; a re-embed pass on trigger will
add it). [ASSUMED] — option (b) is simplest; no verified comparison with option (a).

### Pattern 4: Version Increment for creator_strategies

**What:** The schema has no `version` column. [VERIFIED: schema.sql Table 7]
The CONTEXT.md mentions `version INT` in the canonical refs section, but the actual schema
does NOT include a `version` column — only `extracted_at` and `created_at`.

**Implication:** Version ordering must use `created_at DESC` (or `extracted_at DESC`). The
planner should note this discrepancy. The ROADMAP may reference `version` from an earlier design
iteration. Either:
- Use `created_at` ordering (no schema change needed), or
- Add `version INT` via SQL Editor before Phase 4 starts (D-03: SQL Editor only, no CLI).

**Recommended approach:** Insert-always with `ORDER BY created_at DESC LIMIT 1` to get latest.
If `version` is desired for display, compute it in-app as the count of prior rows + 1.

```typescript
// Get most recent strategy for a creator
const { data: strategies } = await svc
  .from('creator_strategies')
  .select('*')
  .eq('creator_id', creatorId)
  .order('created_at', { ascending: false })
  .limit(2)  // fetch 2: [0] = current, [1] = previous for contradiction check

const current = strategies?.[0] ?? null
const previous = strategies?.[1] ?? null
```

### Pattern 5: Contradiction Detection Algorithm

**What:** Compare two `AllocationMap` objects. Flag categories where the absolute difference
exceeds 15 percentage points.

**Edge case handling:**
- Category in new but not old: treat old as 0 → delta = new value. If new > 15, flag.
- Category in old but not new: treat new as 0 → delta = old value. If old > 15, flag.
- Category absent from both: skip.

```typescript
// Pure function — no I/O
export interface ContradictionResult {
  hasContradiction: boolean
  note: string | null
  shifts: Array<{ category: string; from: number; to: number; delta: number }>
}

export function runContradictionCheck(
  prev: AllocationMap | null,
  next: AllocationMap,
): ContradictionResult {
  if (!prev) return { hasContradiction: false, note: null, shifts: [] }

  const allCategories = new Set([...Object.keys(prev), ...Object.keys(next)])
  const THRESHOLD = 15

  const shifts: ContradictionResult['shifts'] = []

  for (const cat of allCategories) {
    const from = (prev as Record<string, number>)[cat] ?? 0
    const to = (next as Record<string, number>)[cat] ?? 0
    const delta = to - from
    if (Math.abs(delta) > THRESHOLD) {
      shifts.push({ category: cat, from, to, delta })
    }
  }

  if (shifts.length === 0) {
    return { hasContradiction: false, note: null, shifts: [] }
  }

  const noteLines = shifts.map(
    (s) => `${s.category}: ${s.from}% → ${s.to}% (${s.delta > 0 ? '+' : ''}${s.delta}%)`
  )
  return {
    hasContradiction: true,
    note: noteLines.join('; '),
    shifts,
  }
}
```

### Pattern 6: StrategyBlender.ts

**What:** Pure TypeScript module. Takes loaded data, returns `BlendedStrategy`. No Supabase
calls — caller loads data, passes it in.

**Formula (from REQUIREMENTS.md BLEND-02):**
```
unified[category] = Σ(strategy_i[category] × weight_i[category]) / Σ(weight_i[category])
```

**Edge cases:**
- Creator with `trustWeight = 0` for a category: contributes 0 to numerator AND denominator → correctly excluded.
- Creator with no strategy yet (`latestStrategy = null`): exclude from blend entirely.
- Category not in creator's allocation: treat as 0 contribution to numerator (skip); if weight > 0, still add weight to denominator. [ASSUMED] — this interpretation means "the creator said nothing about this category, so they don't push it up or down." Alternative: exclude that creator's weight from denominator for missing categories. The planner should lock this interpretation.
- All weights for a category = 0: skip category from unified output (avoid divide-by-zero).

```typescript
// Source: REQUIREMENTS.md formula + project domain logic
import type { AllocationMap, AssetCategory, UserCreator, CreatorStrategy } from '@/types'

export interface BlendedStrategy {
  unified: AllocationMap
  influence: Record<string, number>  // creatorId → influence % (0–100)
}

export interface BlendInput {
  creators: Array<{
    userCreator: UserCreator          // has trustWeight + optional categoryWeights[]
    latestStrategy: CreatorStrategy | null
  }>
}

const CATEGORIES: AssetCategory[] = [
  'Tech','Dividends','Bonds','Commodities','Cash','Emerging Markets','Small Cap','REITs'
]

export function blendStrategies(input: BlendInput): BlendedStrategy {
  const unified: AllocationMap = {}
  const weightSumPerCategory: Partial<Record<AssetCategory, number>> = {}

  for (const cat of CATEGORIES) {
    let numerator = 0
    let denominator = 0

    for (const { userCreator, latestStrategy } of input.creators) {
      if (!latestStrategy) continue  // no strategy → exclude

      // Resolve weight for this category
      const perCatOverride = userCreator.categoryWeights?.find((w) => w.category === cat)
      const weight = perCatOverride ? perCatOverride.weight : userCreator.trustWeight

      if (weight === 0) continue  // excluded

      const allocationPct = latestStrategy.allocation[cat] ?? 0
      numerator += allocationPct * weight
      denominator += weight
    }

    if (denominator > 0) {
      unified[cat] = numerator / denominator
      weightSumPerCategory[cat] = denominator
    }
  }

  // Compute per-creator influence across all categories
  // Influence = sum of (weight_i[cat] × allocation_i[cat]) / total weighted contribution
  const influence: Record<string, number> = {}
  let totalInfluenceScore = 0
  const rawScores: Record<string, number> = {}

  for (const { userCreator, latestStrategy } of input.creators) {
    if (!latestStrategy) continue
    let score = 0
    for (const cat of CATEGORIES) {
      const perCatOverride = userCreator.categoryWeights?.find((w) => w.category === cat)
      const weight = perCatOverride ? perCatOverride.weight : userCreator.trustWeight
      score += weight
    }
    rawScores[userCreator.creatorId] = score
    totalInfluenceScore += score
  }

  for (const [creatorId, score] of Object.entries(rawScores)) {
    influence[creatorId] = totalInfluenceScore > 0 ? (score / totalInfluenceScore) * 100 : 0
  }

  return { unified, influence }
}
```

### Pattern 7: Trust Weight Auto-Save (Server Action + Optimistic UI)

**What:** Slider is a client component; save is a server action. On `onMouseUp`/`onTouchEnd`,
call the server action. Use `useOptimistic` (React 19 / Next.js 15) or simple local state for
the green tick.

**D-10 pattern — no toast library needed. Inline state transition:**

```typescript
// Client component (TrustWeightSlider.tsx)
'use client'
import { useState } from 'react'
import { saveCreatorWeight } from '../actions'  // server action

export function TrustWeightSlider({
  userCreatorId,
  category,
  initialWeight,
}: {
  userCreatorId: string
  category: string | null  // null = global slider
  initialWeight: number
}) {
  const [value, setValue] = useState(initialWeight)
  const [saved, setSaved] = useState(false)

  const handleRelease = async () => {
    await saveCreatorWeight({ userCreatorId, category, weight: value })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)  // tick disappears after 1.5s
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        onMouseUp={handleRelease}
        onTouchEnd={handleRelease}
        className="w-full accent-indigo-500"
      />
      <span className="text-sm text-zinc-400 w-8">{value}%</span>
      {saved && <span className="text-green-400 text-sm">✓</span>}
    </div>
  )
}
```

```typescript
// actions.ts (server action)
'use server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

export async function saveCreatorWeight({
  userCreatorId,
  category,
  weight,
}: {
  userCreatorId: string
  category: string | null
  weight: number
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const svc = createServiceClient()

  if (category === null) {
    // Global trust weight → user_creators.trust_weight
    await (svc as any)
      .from('user_creators')
      .update({ trust_weight: weight })
      .eq('id', userCreatorId)
  } else {
    // Per-category → user_creator_category_weights (upsert)
    await (svc as any)
      .from('user_creator_category_weights')
      .upsert(
        { user_creator_id: userCreatorId, category, weight, updated_at: new Date().toISOString() },
        { onConflict: 'user_creator_id,category' }
      )
  }
}
```

### Pattern 8: Extraction Integration Point in Refresh Route

The refresh route calls `runRefreshPipeline` (which handles all step-status updates internally).
Extraction is called **after** the pipeline returns, still inside the route handler. This
respects D-02 without requiring pipeline changes for error propagation:

```typescript
// pulse/src/app/api/refresh/[creatorId]/route.ts — extend existing POST handler
import { extractCreatorStrategy } from '@/lib/strategy/extractor'

// After: const result = await runRefreshPipeline(creatorId, user.id)
// Add:
try {
  await extractCreatorStrategy(creatorId, user.id)
  // extraction success — included in 200 response
} catch (extractionErr) {
  console.warn('[refresh] extraction failed (non-blocking):', extractionErr)
  // D-02: extraction failure does not fail the refresh
  // The 200 response body can include an extractionWarning field
}
```

The `setStep` call for "Extracting strategy..." must be called inside `extractCreatorStrategy`
(or the route before calling it) using the `svc` client with `(userId, creatorId)` — same
pattern as `transcript-pipeline.ts` lines 65-87.

### Anti-Patterns to Avoid

- **Inline extraction in `runRefreshPipeline`:** Breaks D-02 — any extraction exception would
  propagate as a pipeline error. Keep extraction separate and wrap in try/catch in the route.
- **Sending full `raw_text` to Claude:** Violates CLAUDE.md RAG constraint. Always query
  Pinecone first, pass only retrieved chunks.
- **Using `tool_choice: 'auto'`:** Claude may choose to respond in text if uncertain.
  Force `tool_choice: { type: 'tool', name: 'extract_allocation' }` to guarantee structured output.
- **Defaulting missing categories to 0 in AllocationMap:** CONTEXT.md D-discretion specifies
  omitting uncovered categories. Zero-filling would falsely imply the creator is 0% bonds.
- **Number arithmetic in StrategyBlender:** All blended percentages flow to PlanGenerator which
  uses `decimal.js`. Keeping blender output as plain `number` (not Decimal) is fine for Phase 4,
  since PlanGenerator wraps them in `new Decimal()` on read. Do NOT pre-convert in blender
  (Phase 5 is responsible for that boundary).
- **Single Pinecone query for RAG:** Too narrow. Use 3 sub-queries and deduplicate to maximise
  coverage of how a creator describes their strategy in different videos.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured JSON from LLM | Prompt engineering for JSON in text | `tool_use` with forced `tool_choice` | JSON in text is fragile; LLMs sometimes add prose before/after; tool_use is type-safe |
| Percentage arithmetic | Native JS float math | `decimal.js` (Phase 5 boundary) | 0.1 + 0.2 ≠ 0.3; critical for £ calculations downstream |
| Anthropic API client | Direct `fetch()` calls | `@anthropic-ai/sdk` | SDK handles auth, retries, streaming, type safety |
| Slider persistence | `localStorage` or cookies | Supabase server action | Data must survive device changes; must be per-user |

---

## Common Pitfalls

### Pitfall 1: Pinecone Metadata Missing Chunk Text
**What goes wrong:** RAG query returns chunk metadata without actual text. Context string built
from metadata only contains title + video ID — Claude cannot extract allocation without text.
**Why it happens:** Phase 3 pipeline stores 5 metadata fields but not `text`. [VERIFIED: transcript-pipeline.ts lines 278-284]
**How to avoid:** Before Phase 4 work, update Pinecone upsert records to include `text: chunks[idx]`.
Re-embed triggers will populate new vectors. Old vectors (Phase 3) will lack `text` and must
either be re-embedded or fetched from Supabase.
**Warning signs:** Claude returns `confidence: 0` or `allocations: []` despite transcripts existing.

### Pitfall 2: schema.sql Has No `version` Column in creator_strategies
**What goes wrong:** Plans reference `version INT` on `creator_strategies` per the CONTEXT.md
canonical refs description, but the actual schema does not have this column.
**Why it happens:** CONTEXT.md refers to a ROADMAP description, not the implemented schema.
[VERIFIED: schema.sql Table 7 — no `version` column present]
**How to avoid:** Use `created_at` or `extracted_at` for ordering. Decide before planning whether
to add `version` via SQL Editor (D-03) or compute it in-app.
**Warning signs:** TypeScript compilation error on `row.version`.

### Pitfall 3: ANTHROPIC_API_KEY Not in .env.local
**What goes wrong:** `getAnthropic()` throws at runtime; extraction fails; Refresh shows warning.
**How to avoid:** Document the new env var in `CONTRIBUTING.md` or `.env.example`. The singleton
throws a descriptive error (same pattern as OpenAI/Pinecone clients).
**Warning signs:** "ANTHROPIC_API_KEY is not set" in server logs.

### Pitfall 4: Contradiction Auto-Clear Logic
**What goes wrong:** `has_contradiction = TRUE` stays on latest row permanently even after clean
extractions.
**Why it happens:** Each extraction is a new INSERT — old rows are never updated. The flag on the
new row must be `FALSE` if diffs are ≤15%, which is the correct implementation. The "auto-clear"
(D-12) means the newest row has `has_contradiction = false`, so the strategy card badge
disappears — not that old rows are updated.
**How to avoid:** Strategy card reads `has_contradiction` from the latest row only (ORDER BY
created_at DESC LIMIT 1).

### Pitfall 5: Divide-by-Zero in StrategyBlender
**What goes wrong:** All tracked creators have weight=0 for a category → `denominator = 0` →
`NaN` in unified allocation.
**How to avoid:** Guard: `if (denominator > 0) { unified[cat] = numerator / denominator }`.
Omit the category from unified output entirely when no weighted creators cover it.

### Pitfall 6: Slider onMouseUp Fires Multiple Times
**What goes wrong:** Rapid drag + release fires onMouseUp multiple times → multiple server action
calls → race condition in Supabase upsert.
**How to avoid:** Upsert with `onConflict: 'user_creator_id,category'` is idempotent. The last
write wins. This is acceptable for v1.

### Pitfall 7: tool_choice Forcing and max_tokens
**What goes wrong:** If `max_tokens` is too low, Claude truncates mid-tool-use, returning a
malformed partial JSON block.
**How to avoid:** Set `max_tokens: 1024` minimum for extraction. The tool response schema is
small (20 chunks × short citation IDs + confidence integer + 8 category objects), so 1024 is
sufficient.

---

## Code Examples

### Full Extraction Flow (extractor.ts outline)

```typescript
// Source: Patterns 1-4 above, synthesised from verified SDK docs and existing codebase
import 'server-only'
import type { AllocationMap, AssetCategory } from '@/types'
import { getAnthropic } from '@/lib/anthropic/client'
import { embedChunks } from '@/lib/openai/client'
import { getPineconeNamespace } from '@/lib/pinecone/client'
import { createServiceClient } from '@/lib/supabase/service'
import { runContradictionCheck } from './contradiction'
import Anthropic from '@anthropic-ai/sdk'

const SYSTEM_PROMPT = `You are analysing transcripts from a finance content creator to identify
their asset allocation philosophy. Extract the percentage of a portfolio they imply or state
should be in each asset class. Only include categories the creator explicitly covers.
Do not use words like "advice" or "recommend" — describe only what the creator expresses.`

export async function extractCreatorStrategy(
  creatorId: string,
  userId: string,
): Promise<void> {
  const svc = createServiceClient() as any

  // Step 9a: update step status
  await svc.from('refresh_jobs').upsert(
    { user_id: userId, creator_id: creatorId, step: 'Extracting strategy...', status: 'running', updated_at: new Date().toISOString() },
    { onConflict: 'user_id,creator_id' }
  )

  // RAG retrieval
  const chunks = await retrieveChunks(creatorId)
  if (chunks.length === 0) throw new Error('No Pinecone chunks found for creator')

  const contextString = buildContextString(chunks)

  // Claude extraction
  const anthropic = getAnthropic()
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: contextString }],
    tools: [TOOL_DEF],
    tool_choice: { type: 'tool', name: 'extract_allocation' },
  })

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
  )
  if (!toolUse) throw new Error('No tool_use block in Claude response')

  const input = toolUse.input as {
    allocations: Array<{ category: string; allocation_pct: number }>
    confidence: number
    source_video_ids: string[]
  }

  // Map to AllocationMap
  const allocation: AllocationMap = {}
  for (const a of input.allocations) {
    allocation[a.category as AssetCategory] = a.allocation_pct
  }

  // Load previous strategy for contradiction check
  const { data: prevRows } = await svc
    .from('creator_strategies')
    .select('allocation, confidence, has_contradiction')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false })
    .limit(1)

  const prevAllocation: AllocationMap | null =
    prevRows?.[0]?.allocation ?? null

  const contradiction = runContradictionCheck(prevAllocation, allocation)

  // Insert new strategy row
  await svc.from('creator_strategies').insert({
    creator_id: creatorId,
    allocation,
    confidence: input.confidence,
    source_video_ids: input.source_video_ids,
    has_contradiction: contradiction.hasContradiction,
    contradiction_note: contradiction.note,
    extracted_at: new Date().toISOString(),
  })
}
```

### Supabase Query — Latest Strategy

```typescript
// Source: schema.sql Table 7 analysis + Supabase JS client docs
const { data } = await supabase
  .from('creator_strategies')
  .select('id, allocation, confidence, source_video_ids, has_contradiction, contradiction_note, extracted_at')
  .eq('creator_id', creatorId)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()
```

**RLS note:** `creator_strategies` has a SELECT policy for all authenticated users
(`USING (TRUE)`) — any logged-in user can read any creator's strategy. No per-user scoping
needed on reads. INSERTs require service role (no authenticated INSERT policy). [VERIFIED: schema.sql lines 243-248]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Parse JSON from message text | `tool_use` with forced `tool_choice: { type: 'tool' }` | Anthropic API 2024 | Eliminates JSON parsing errors; type-safe via SDK |
| Single embedding query for RAG | Multiple query embeddings + deduplication | 2024 best practice | Better recall for ambiguous/spread content |
| `ToolChoiceRequired` variant | No such variant — use `type: 'any'` or `type: 'tool'` | Current SDK v0.95.0 | `type: 'any'` = use any available tool; `type: 'tool'` = force specific tool [VERIFIED: Context7] |

**Deprecated/outdated:**
- `tool_choice: 'required'` string form: not a valid SDK type. Use `{ type: 'any' }` or `{ type: 'tool', name: '...' }` [VERIFIED: Context7 /anthropics/anthropic-sdk-typescript]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Three sub-queries for RAG maximise coverage without excessive cost | Pattern 3 | Could over-query (cost) or still miss; optimal count is empirical |
| A2 | Option (b) — store `text` in Pinecone metadata — is simpler than re-fetching from Supabase | Pitfall 1 | May require re-embedding Phase 3 vectors; alternative (a) works but adds a Supabase query per chunk |
| A3 | Creator with allocation missing for a category: use 0 in numerator but still count weight in denominator | Pattern 6 StrategyBlender | If wrong, blender under-counts missing-category weight, skewing unified allocation |
| A4 | `max_tokens: 1024` sufficient for tool_use response | Pitfall 7 | If creator has many categories or long video IDs, may truncate; increase to 2048 if issues arise |

---

## Open Questions (RESOLVED)

1. **Chunk text in Pinecone metadata** *(RESOLVED: Plan 04-01 task 3)*
   - What we know: Phase 3 does not store `text` in Pinecone metadata.
   - What's unclear: Does Phase 4 require a re-embed pass of all Phase 3 vectors, or can it launch with the `text` field for new embeddings only?
   - Resolution: Plan 04-01 task 3 adds `text: chunks[idx] ?? ''` to Pinecone upsert records in `transcript-pipeline.ts`. New embeds will include text. Creators need a manual Refresh to populate text-bearing vectors before extraction works correctly; this is documented in the plan.

2. **`version` column on `creator_strategies`** *(RESOLVED: use `created_at DESC` ordering)*
   - What we know: CONTEXT.md refers to `version INT` but schema.sql does not have it.
   - What's unclear: Was it intentionally omitted in Phase 1?
   - Resolution: No `version` column added. All plans use `ORDER BY created_at DESC` to get the latest strategy. Version number for display is computed in-app as count of prior rows + 1.

3. **StrategyBlender missing-category denominator behaviour** *(RESOLVED: exclude weight from denominator)*
   - What we know: Formula from REQUIREMENTS.md. Edge case not specified.
   - What's unclear: Should a creator's weight count toward denominator for a category if their allocation doesn't include that category?
   - Resolution: When a creator has no allocation for a category, their weight is excluded from BOTH numerator AND denominator for that category. Plan 04-03 blender.ts implements `if (allocationPct === undefined) continue` to skip contribution entirely, avoiding dilution of uncovered categories toward 0.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@anthropic-ai/sdk` | Strategy extraction | ✗ (not installed) | — | None — must install |
| `ANTHROPIC_API_KEY` env var | `getAnthropic()` singleton | Unknown | — | None — must obtain from Anthropic Console |
| `@pinecone-database/pinecone` | RAG queries | ✓ | `^7.2.0` | — |
| `openai` (for embedding) | RAG query embedding | ✓ | `^6.36.0` | — |
| Supabase (service role) | `creator_strategies` INSERT | ✓ | Existing | — |

**Missing dependencies with no fallback:**
- `@anthropic-ai/sdk` — must install: `cd pulse && npm install @anthropic-ai/sdk`
- `ANTHROPIC_API_KEY` — must be added to `.env.local` before Phase 4 extraction works

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected (no test config files in project) |
| Config file | None — Wave 0 must create jest/vitest config if tests are required |
| Quick run command | N/A until framework installed |
| Full suite command | N/A until framework installed |

**Note:** No `jest.config.*`, `vitest.config.*`, `pytest.ini`, or `test/` directory found.
The project has no existing test infrastructure. Given `nyquist_validation: true` in config.json,
Wave 0 of Phase 4 should decide on a test framework and create the config.

**Recommended:** `vitest` (already compatible with Next.js + TypeScript without Babel config).
Install: `npm install -D vitest @vitest/ui`.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STRAT-01 | Claude extracts AllocationMap from context string | unit (mock Anthropic SDK) | `vitest run src/lib/strategy/extractor.test.ts` | ❌ Wave 0 |
| STRAT-02 | Each extraction inserts a new row (not update) | integration (mock Supabase) | `vitest run src/lib/strategy/extractor.test.ts` | ❌ Wave 0 |
| STRAT-03 | Extraction output contains `confidence` + `sourceVideoIds` | unit (mock SDK) | `vitest run src/lib/strategy/extractor.test.ts` | ❌ Wave 0 |
| STRAT-04 | Contradiction flag set when category delta >15% | unit (pure function) | `vitest run src/lib/strategy/contradiction.test.ts` | ❌ Wave 0 |
| BLEND-01 | Slider saves weight to correct table (global vs per-cat) | integration (mock Supabase) | `vitest run src/app/dashboard/actions.test.ts` | ❌ Wave 0 |
| BLEND-02 | StrategyBlender weighted average formula correct | unit (pure function) | `vitest run src/lib/strategy/blender.test.ts` | ❌ Wave 0 |
| BLEND-03 | Blend Summary influence % sums to 100 | unit | `vitest run src/lib/strategy/blender.test.ts` | ❌ Wave 0 |

### Sampling Rate
- Per task commit: `vitest run` (all unit tests, < 10 s)
- Per wave merge: `vitest run` (full suite)
- Phase gate: Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` — framework config
- [ ] `src/lib/strategy/contradiction.test.ts` — covers STRAT-04
- [ ] `src/lib/strategy/blender.test.ts` — covers BLEND-02, BLEND-03
- [ ] `src/lib/strategy/extractor.test.ts` — covers STRAT-01, STRAT-02, STRAT-03 (mocked)
- [ ] `src/app/dashboard/actions.test.ts` — covers BLEND-01 (mocked)
- Framework install: `cd pulse && npm install -D vitest @vitest/ui`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth session check in route + server actions |
| V3 Session Management | yes | Supabase `createClient()` cookie-based session |
| V4 Access Control | yes | Ownership check in route (user_creators) + RLS on weights table |
| V5 Input Validation | yes | `tool_choice` forced schema validates LLM output; slider values 0–100 enforced by DB CHECK |
| V6 Cryptography | no | No new crypto; API keys in env vars (standard pattern) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User reads another user's weight sliders | Information Disclosure | RLS policy on `user_creator_category_weights` requires `user_creator.user_id = auth.uid()` [VERIFIED: schema.sql lines 121-138] |
| Forged creatorId in refresh route | Tampering | UUID format check + ownership check in route.ts [VERIFIED: route.ts lines 12-48] |
| Prompt injection via video transcript chunks | Tampering | System prompt is server-controlled; user cannot influence chunk content |
| ANTHROPIC_API_KEY leaked to client | Information Disclosure | `import 'server-only'` in `lib/anthropic/client.ts` — build fails if imported from client component |

---

## Project Constraints (from CLAUDE.md)

- **No advice language:** System prompt and all user-facing output must avoid "advice", "recommend", "suggest". Tool description and system prompt must be written accordingly.
- **RAG pattern mandatory:** Never pass `raw_text` to Claude. Always query Pinecone first.
- **decimal.js for £:** StrategyBlender output is `number`-typed (percentage, not £). No decimal.js needed in blender itself. PlanGenerator (Phase 5) wraps in Decimal on use.
- **Manual-first v1:** No background jobs. Extraction triggered by Refresh button only (D-01).
- **SQL Editor only (D-03):** If `version` column is added, it goes through SQL Editor. No `supabase db push` or `npx supabase migration`.

---

## Sources

### Primary (HIGH confidence)
- Context7 `/anthropics/anthropic-sdk-typescript` — tool_use pattern, ToolChoice variants, SDK installation
- `pulse/src/lib/pipeline/transcript-pipeline.ts` — step-status pattern, setStep function, Pinecone metadata fields stored
- `pulse/src/types/index.ts` — AllocationMap, CreatorStrategy, AssetCategory types
- `.planning/phases/01-foundation/schema.sql` — creator_strategies table structure (confirmed no `version` column)
- `pulse/src/lib/pinecone/client.ts` — getPineconeNamespace exact API
- `pulse/src/lib/openai/client.ts` — singleton pattern to replicate
- `pulse/src/lib/supabase/service.ts` — createServiceClient pattern
- npm registry — `@anthropic-ai/sdk@0.95.0` current version

### Secondary (MEDIUM confidence)
- Context7 `/anthropics/anthropic-sdk-typescript` examples — tool_choice `{ type: 'tool', name: '...' }` syntax verified against SDK type definitions

### Tertiary (LOW confidence — see Assumptions Log)
- Multi-query RAG strategy (3 sub-queries): common pattern, not project-specific benchmark
- StrategyBlender denominator behaviour for missing categories: interpretation, not specified in REQUIREMENTS.md

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — SDK version verified via npm; all dependencies confirmed in package.json
- Architecture: HIGH — based entirely on verified existing codebase patterns
- Pitfalls: HIGH for codebase-specific (Pinecone no text field verified); MEDIUM for general (multi-query RAG)
- Assumptions: 4 items logged — all low-risk

**Research date:** 2026-05-07
**Valid until:** 2026-06-06 (30 days — SDK minor versions may change, core patterns stable)
