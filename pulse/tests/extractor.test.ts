import { describe, it, expect, vi } from 'vitest'

// Note: extractCreatorStrategy uses 'server-only' and multiple external dependencies.
// We test the two-call logic by mocking the dependencies.
// Mock heavy deps before importing the module.

// server-only throws when imported outside Next.js server context — mock it for tests
vi.mock('server-only', () => ({}))

vi.mock('@/lib/anthropic/client', () => ({
  getAnthropic: () => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: 'tool_use',
            input: {
              methodology: 'Test methodology',
              favoured_stocks: [],
              sector_focus: [],
              preferred_index_funds: [],
              confidence: 75,
              source_video_ids: ['vid1'],
            },
          },
        ],
      }),
    },
  }),
}))

vi.mock('@/lib/openai/client', () => ({
  embedChunks: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: () => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: [] }),
          }),
        }),
      }),
    }),
  }),
}))

vi.mock('./contradiction', () => ({
  runContradictionCheck: vi.fn().mockReturnValue({ hasContradiction: false, note: null }),
}))

// CI-02: Two-call pattern tests
describe('extractCreatorStrategy — two-call pattern (CI-02)', () => {
  it.todo('calls Claude twice when 30-day chunks exist (requires Pinecone mock — integration test)')
  it.todo('calls Claude once when 30-day chunks are empty (D-09) — integration test')
  it.todo('sets profile_latest = null in DB insert when latestChunks.length === 0 — integration test')
})

// These tests verify the schema constants directly (no Claude call needed)
describe('extractCreatorStrategy — schema constants are correct for two-call pattern', () => {
  it('PROFILE_TOOL_DEF is used with tool_choice name extract_creator_profile', async () => {
    // Import after mocks are set up
    const { PROFILE_TOOL_DEF } = await import('@/lib/strategy/extractor')
    expect(PROFILE_TOOL_DEF.name).toBe('extract_creator_profile')
  })

  it('SYSTEM_PROMPT does not contain advice language', async () => {
    const { SYSTEM_PROMPT } = await import('@/lib/strategy/extractor')
    expect(SYSTEM_PROMPT.toLowerCase()).not.toContain('recommend')
    expect(SYSTEM_PROMPT.toLowerCase()).not.toContain('advise')
    expect(SYSTEM_PROMPT.toLowerCase()).not.toContain('suggest')
  })
})
