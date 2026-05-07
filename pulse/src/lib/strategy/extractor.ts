/**
 * Strategy extractor — Phase 4 (STRAT-01, STRAT-02, STRAT-03).
 *
 * extractCreatorStrategy(creatorId, userId):
 *   1. Update refresh_jobs step to "Extracting strategy..." (D-03)
 *   2. Embed 3 query strings via OpenAI
 *   3. Query Pinecone top-20 unique chunks across all 3 queries (D-06)
 *   4. Build context string from chunk text metadata (Pitfall 1 fix)
 *   5. Call Claude claude-sonnet-4-6 with tool_use: extract_allocation (D-04, D-05)
 *   6. Load prior strategy row for contradiction check
 *   7. INSERT new creator_strategies row (STRAT-02: always INSERT, never UPDATE)
 *
 * Design: server-only; called from refresh route after runRefreshPipeline returns (D-01/D-02).
 * Failure propagates to caller (route wraps in try/catch for D-02 non-blocking behaviour).
 */
import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import type { AllocationMap, AssetCategory } from '@/types'
import { getAnthropic } from '@/lib/anthropic/client'
import { embedChunks } from '@/lib/openai/client'
import { getPineconeNamespace } from '@/lib/pinecone/client'
import { createServiceClient } from '@/lib/supabase/service'
import { runContradictionCheck } from './contradiction'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL = 'claude-sonnet-4-6'

/**
 * Three sub-queries for better Pinecone recall across different ways creators
 * describe their allocation philosophy (RESEARCH Pattern 3 / D-06).
 */
const QUERY_TEXTS = [
  'asset allocation portfolio percentage breakdown',
  'investment strategy how I invest my money sectors',
  'portfolio approach growth dividends bonds cash weighting',
]

/**
 * System prompt — must not contain "advice", "recommend", or "suggest" (CLAUDE.md).
 * Framed as analysis/observation, not guidance.
 */
const SYSTEM_PROMPT = `You are analysing transcripts from a finance content creator to identify \
their asset allocation philosophy. Extract the percentage of a portfolio they imply or state \
should be in each asset class. Only include categories the creator explicitly covers. \
Omit categories not discussed. Do not use the words "advice" or "recommend" — describe only \
what the creator expresses in the transcripts provided.`

/**
 * Tool schema for forced structured output (D-05 / RESEARCH Pattern 2).
 * tool_choice: { type: 'tool', name: 'extract_allocation' } guarantees a ToolUseBlock.
 */
const TOOL_DEF: Anthropic.Tool = {
  name: 'extract_allocation',
  description:
    "Record the asset allocation strategy inferred from the creator's transcripts. " +
    'Only include categories the creator explicitly covers. Omit categories not discussed.',
  input_schema: {
    type: 'object' as const,
    properties: {
      allocations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: ['Index Funds', 'Stocks', 'Cash'],
            },
            allocation_pct: {
              type: 'number',
              description: 'Percentage of portfolio (0–100). Values need not sum to exactly 100.',
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
        description: 'YouTube video IDs (from chunk metadata video_id field) that most influenced this extraction.',
      },
    },
    required: ['allocations', 'confidence', 'source_video_ids'],
  },
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface ChunkMatch {
  score: number
  metadata: Record<string, unknown>
}

/**
 * Embed 3 query strings, query Pinecone per query, deduplicate by vector ID,
 * return top 20 unique chunks sorted by score descending.
 * Reads 'text' from Pinecone metadata (added in Phase 4 Wave 0 pipeline fix).
 */
async function retrieveChunks(creatorId: string): Promise<ChunkMatch[]> {
  const ns = getPineconeNamespace(creatorId)
  const vectors = await embedChunks(QUERY_TEXTS)

  const allMatches = new Map<string, ChunkMatch>()

  for (const vector of vectors) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (ns as any).query({
      vector,
      topK: 20,
      includeMetadata: true,
    })
    for (const match of result.matches ?? []) {
      const existing = allMatches.get(match.id)
      if (!existing || match.score > existing.score) {
        allMatches.set(match.id, {
          score: match.score,
          metadata: match.metadata ?? {},
        })
      }
    }
  }

  return [...allMatches.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
}

/**
 * Build context string from chunk metadata for Claude's user message.
 * Reads m.text (the chunk text stored in Pinecone metadata by the fixed pipeline).
 */
function buildContextString(chunks: ChunkMatch[]): string {
  return chunks
    .map((c, i) => {
      const m = c.metadata
      return [
        `[Chunk ${i + 1}]`,
        `Video: ${m.title ?? 'Unknown'} (${m.published_at ?? ''})`,
        `Video ID: ${m.video_id ?? ''}`,
        `Text: ${m.text ?? ''}`,
      ].join('\n')
    })
    .join('\n\n---\n\n')
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Extract a new strategy snapshot for the given creator using RAG + Claude.
 * Always INSERTs a new row in creator_strategies (STRAT-02: full version history).
 * Updates refresh_jobs step status to "Extracting strategy..." (D-03).
 * Throws on any failure — caller (refresh route) wraps in try/catch for D-02.
 */
export async function extractCreatorStrategy(
  creatorId: string,
  userId: string,
): Promise<void> {
  const svc: AnySupabase = createServiceClient()

  // D-03: update step status to "Extracting strategy..."
  await svc.from('refresh_jobs').upsert(
    {
      user_id: userId,
      creator_id: creatorId,
      step: 'Extracting strategy...',
      status: 'running',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,creator_id' },
  )

  // Step 1: retrieve relevant chunks via RAG (D-06: 3 sub-queries, top 20 unique)
  const chunks = await retrieveChunks(creatorId)
  if (chunks.length === 0) {
    throw new Error(`No Pinecone chunks found for creator ${creatorId}. Run Refresh to embed transcripts first.`)
  }

  const contextString = buildContextString(chunks)

  // Step 2: call Claude with forced tool_use (D-04, D-05)
  const anthropic = getAnthropic()
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: contextString }],
    tools: [TOOL_DEF],
    tool_choice: { type: 'tool', name: 'extract_allocation' },
  })

  // Forced tool_choice guarantees a ToolUseBlock — error if absent
  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  )
  if (!toolUse) {
    throw new Error('Claude did not return a tool_use block — unexpected response format')
  }

  const input = toolUse.input as {
    allocations: Array<{ category: string; allocation_pct: number }>
    confidence: number
    source_video_ids: string[]
  }

  // Step 3: map allocations array to AllocationMap (omit categories Claude didn't include)
  const allocation: AllocationMap = {}
  for (const a of input.allocations) {
    const cat = a.category as AssetCategory
    allocation[cat] = a.allocation_pct
  }

  // Step 4: load prior strategy for contradiction check (STRAT-04 uses this in contradiction.ts)
  const { data: prevRows } = await svc
    .from('creator_strategies')
    .select('allocation')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false })
    .limit(1)

  const prevAllocation: AllocationMap | null = prevRows?.[0]?.allocation ?? null

  const contradiction = runContradictionCheck(prevAllocation, allocation)

  // Step 5: INSERT new strategy row (STRAT-02: always INSERT, never UPDATE)
  const { error: insertErr } = await svc.from('creator_strategies').insert({
    creator_id: creatorId,
    allocation,
    confidence: input.confidence,
    source_video_ids: input.source_video_ids,
    has_contradiction: contradiction.hasContradiction,
    contradiction_note: contradiction.note,
    extracted_at: new Date().toISOString(),
  })

  if (insertErr) {
    throw new Error(`Failed to save strategy: ${insertErr.message}`)
  }
}
