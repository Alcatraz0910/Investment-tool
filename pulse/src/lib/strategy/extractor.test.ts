/**
 * Tests for extractCreatorStrategy() — covers STRAT-01, STRAT-02, STRAT-03.
 * Wave 0: stubs only. Wave 1 (plan 04-02) fills in implementations.
 *
 * Mocking approach:
 * - Mock @anthropic-ai/sdk: vi.mock('@anthropic-ai/sdk', ...) returning a fake ToolUseBlock
 * - Mock @/lib/pinecone/client: return fake chunk matches with text in metadata
 * - Mock @/lib/supabase/service: createServiceClient returns a fake Supabase client
 */
import { describe, it } from 'vitest'

describe('extractCreatorStrategy (STRAT-01, STRAT-02, STRAT-03)', () => {
  it.todo('STRAT-01: returns AllocationMap with categories from Claude tool_use response')
  it.todo('STRAT-01: throws if Claude returns no tool_use block')
  it.todo('STRAT-01: builds context string from Pinecone chunk text metadata')
  it.todo('STRAT-02: calls supabase.insert (not update) — each extraction creates a new row')
  it.todo('STRAT-03: extraction result includes confidence score 0-100')
  it.todo('STRAT-03: extraction result includes source_video_ids array')
  it.todo('STRAT-01: throws if no Pinecone chunks found for creator')
})
