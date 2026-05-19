/**
 * Strategy extractor — Phase 11 rewrite (CI-02, CI-03, CI-04).
 *
 * extractCreatorStrategy(creatorId, userId):
 *   1. Stable extraction: Pinecone filter published_at >= (now - 4 months) → Claude call
 *   2. Latest extraction: Pinecone filter published_at >= (now - 30 days) → Claude call
 *      (skipped if no 30-day chunks — D-09)
 *   3. Contradiction check against prior row's allocation (null-guarded for Phase 11 rows)
 *   4. INSERT new creator_strategies row with profile_stable, profile_latest, allocation=null
 *
 * Design: server-only; called from refresh route after runRefreshPipeline returns.
 * Failure propagates to caller (route wraps in try/catch for non-blocking behaviour).
 * contradiction.ts is NOT modified (D-15) — Phase 14 will redesign it.
 */
import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
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
 * D-10: Updated query texts for new profile schema — stocks, sectors, methodology, funds.
 */
export const QUERY_TEXTS = [
  'stocks shares companies favourite investments holdings',
  'sector industry technology growth value dividend focus',
  'index funds ETF passive portfolio methodology how I invest',
]

/**
 * D-05: System prompt — must not contain "advice", "recommend", or "suggest" (CLAUDE.md).
 * Framed as observation of what the creator expresses/discusses/covers.
 */
export const SYSTEM_PROMPT = `You are analysing transcript excerpts from a finance content creator \
to identify what they express about their investment approach. \
Extract what the creator discusses: the companies and funds they cover, the sectors they focus on, \
and how they describe evaluating investments. \
Only include information the creator explicitly covers in the provided transcripts. \
Set ticker to null if the creator named a company but did not cite its stock symbol. \
Set conviction based only on the creator's language: words like "biggest holding", \
"very bullish", or "core position" indicate high conviction; passing mentions indicate low. \
Use only observational language — describe what the creator expresses, covers, or discusses. \
Do not frame output as guidance or instructions to the reader.`

/**
 * D-01: New tool schema — extract_creator_profile replaces the old tool.
 * D-02: favoured_stocks.ticker nullable (anyOf) — do not infer from company name.
 * D-03: preferred_index_funds.ticker nullable (anyOf).
 * D-04: tool_choice forces structured output; name must match exactly.
 */
export const PROFILE_TOOL_DEF: Anthropic.Tool = {
  name: 'extract_creator_profile',
  description:
    'Record what this creator expresses about their investment approach based on the transcript excerpts provided.',
  input_schema: {
    type: 'object' as const,
    properties: {
      methodology: {
        type: 'string',
        description:
          'How the creator evaluates and selects investments (1-3 sentences, based only on what they express in transcripts).',
      },
      favoured_stocks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ticker: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
              description:
                'Stock symbol as cited by the creator (e.g. "AAPL"). Set to null if creator named the company but did not cite the ticker symbol.',
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
        description:
          'How explicitly the creator discussed these positions (0 = vague inferences, 100 = stated explicit positions).',
      },
      source_video_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'Video IDs from chunk metadata that most influenced this extraction.',
      },
    },
    required: [
      'methodology',
      'favoured_stocks',
      'sector_focus',
      'preferred_index_funds',
      'confidence',
      'source_video_ids',
    ],
  },
}

// ---------------------------------------------------------------------------
// TypeScript interfaces (AI-SPEC Section 4b)
// ---------------------------------------------------------------------------

interface FavouredStock {
  ticker: string | null
  name: string
  rationale: string
  conviction: 'high' | 'medium' | 'low'
}

interface SectorFocus {
  sector: string
  stance: 'bullish' | 'neutral' | 'cautious'
  rationale: string
}

interface PreferredIndexFund {
  name: string
  ticker: string | null
  rationale: string
}

export interface CreatorProfile {
  methodology: string
  favoured_stocks: FavouredStock[]
  sector_focus: SectorFocus[]
  preferred_index_funds: PreferredIndexFund[]
  confidence: number
  source_video_ids: string[]
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface ChunkMatch {
  score: number
  metadata: Record<string, unknown>
}

/**
 * Embed QUERY_TEXTS, query Pinecone per query with optional date filter,
 * deduplicate by vector ID, return top 20 unique chunks sorted by score descending.
 */
async function queryPinecone(
  creatorId: string,
  vectors: number[][],
  filter?: Record<string, unknown>,
): Promise<Map<string, ChunkMatch>> {
  const ns = getPineconeNamespace(creatorId)
  const allMatches = new Map<string, ChunkMatch>()

  for (const vector of vectors) {
    const PINECONE_TIMEOUT = 20_000
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const queryPromise = (ns as any).query({
      vector,
      topK: 20,
      includeMetadata: true,
      ...(filter ? { filter } : {}),
    })
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Pinecone query timed out after 20s')), PINECONE_TIMEOUT)
    )
    const result = await Promise.race([queryPromise, timeoutPromise])
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

  return allMatches
}

async function retrieveChunks(
  creatorId: string,
  filter?: Record<string, unknown>,
): Promise<ChunkMatch[]> {
  const vectors = await embedChunks(QUERY_TEXTS)

  let allMatches = await queryPinecone(creatorId, vectors, filter)

  // Fallback: if date filter returned nothing, retry without it so extraction
  // still works when Pinecone metadata filtering excludes all stored chunks.
  if (filter && allMatches.size === 0) {
    console.warn(`[extractor] date filter returned 0 chunks for ${creatorId}, retrying without filter`)
    allMatches = await queryPinecone(creatorId, vectors, undefined)
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
 * Two-call pattern (D-06): stable (4 months) then latest (30 days, conditional).
 * Always INSERTs a new row in creator_strategies (full version history).
 * Sets profile_stable = result, profile_latest = result | null, allocation = null (D-14).
 * Throws on any failure — caller (refresh route) wraps in try/catch.
 */
export async function extractCreatorStrategy(
  creatorId: string,
  userId: string,
): Promise<void> {
  const svc: AnySupabase = createServiceClient()
  const anthropic = getAnthropic()

  // --- Stable layer (4-month window, D-07) ---
  // Use .update() not .upsert() so started_at from runRefreshPipeline is never overwritten
  await svc.from('refresh_jobs')
    .update({ step: 'Extracting stable profile...', status: 'running', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('creator_id', creatorId)

  const stableFilter = {
    published_at: { $gte: new Date(Date.now() - 4 * 30 * 24 * 60 * 60 * 1000).toISOString() },
  }
  const stableChunks = await retrieveChunks(creatorId, stableFilter)

  // AI-SPEC guardrail: never call Claude with empty context (will hallucinate)
  if (stableChunks.length === 0) {
    throw new Error(
      `No Pinecone chunks found for creator ${creatorId} in the last 4 months. Run Refresh to embed transcripts first.`,
    )
  }

  await svc.from('refresh_jobs')
    .update({ step: 'Analysing stable profile with AI...', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('creator_id', creatorId)

  const stableContextString = buildContextString(stableChunks)
  const stableResponse = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: stableContextString }],
    tools: [PROFILE_TOOL_DEF],
    tool_choice: { type: 'tool', name: 'extract_creator_profile' },
  })

  const stableBlock = stableResponse.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
  )
  if (!stableBlock) {
    throw new Error('Claude did not return tool_use block for stable extraction')
  }
  const stableProfile = stableBlock.input as CreatorProfile

  // --- Latest layer (30-day window, D-08, D-09) ---
  // Use .update() not .upsert() so started_at from runRefreshPipeline is never overwritten
  await svc.from('refresh_jobs')
    .update({ step: 'Extracting latest signals...', status: 'running', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('creator_id', creatorId)

  const latestFilter = {
    published_at: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
  }
  const latestChunks = await retrieveChunks(creatorId, latestFilter)

  let latestProfile: CreatorProfile | null = null

  if (latestChunks.length > 0) {
    // D-09: skip latest call if no 30-day chunks — no empty Claude call
    await svc.from('refresh_jobs')
      .update({ step: 'Analysing latest signals with AI...', updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('creator_id', creatorId)

    const latestContextString = buildContextString(latestChunks)
    const latestResponse = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: latestContextString }],
      tools: [PROFILE_TOOL_DEF],
      tool_choice: { type: 'tool', name: 'extract_creator_profile' },
    })

    const latestBlock = latestResponse.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    )
    if (latestBlock) {
      latestProfile = latestBlock.input as CreatorProfile
    }
  }

  // --- Contradiction check (D-15: no changes to contradiction.ts) ---
  // Prior allocation may be null for Phase 11 rows — runContradictionCheck handles null gracefully.
  // If prevAllocation is null, contradiction check returns no contradiction (safe fallback).
  const { data: prevRows } = await svc
    .from('creator_strategies')
    .select('allocation')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false })
    .limit(1)

  const prevAllocation = prevRows?.[0]?.allocation ?? null
  // Phase 11: allocation is always null in new rows; contradiction check is deferred.
  // Always pass null as prev so contradiction.ts short-circuits before reading next.
  const contradiction = runContradictionCheck(null, {})

  // --- INSERT new strategy row (always INSERT, never UPDATE — full history) ---
  // D-14: allocation = null for Phase 11 rows; new data in profile_stable / profile_latest
  const { error: insertErr } = await svc.from('creator_strategies').insert({
    creator_id: creatorId,
    profile_stable: stableProfile,
    profile_latest: latestProfile,
    allocation: null,
    confidence: stableProfile.confidence,
    source_video_ids: stableProfile.source_video_ids,
    has_contradiction: contradiction.hasContradiction,
    contradiction_note: contradiction.note,
    extracted_at: new Date().toISOString(),
  })

  if (insertErr) {
    throw new Error(`Failed to save strategy: ${insertErr.message}`)
  }
}
