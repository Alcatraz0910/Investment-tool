import { describe, it, expect, vi, beforeEach } from 'vitest'

// Note: extractCreatorStrategy uses 'server-only' and multiple external dependencies.
// We test the two-call logic by mocking the dependencies.
// Mock heavy deps before importing the module.

// server-only throws when imported outside Next.js server context — mock it for tests
vi.mock('server-only', () => ({}))

// Hoist shared mock handles so they're accessible both in vi.mock factories and in tests
const { mockCreate, mockInsert, mockNsQuery, mockEmbedChunks, mockContradictionCheck } = vi.hoisted(() => {
  const mockCreate = vi.fn().mockResolvedValue({
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
  })
  const mockInsert = vi.fn().mockResolvedValue({ error: null })
  const mockNsQuery = vi.fn()
  const mockEmbedChunks = vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]])
  const mockContradictionCheck = vi.fn().mockReturnValue({ hasContradiction: false, reason: null })
  return { mockCreate, mockInsert, mockNsQuery, mockEmbedChunks, mockContradictionCheck }
})

vi.mock('@/lib/anthropic/client', () => ({
  getAnthropic: () => ({
    messages: {
      create: mockCreate,
    },
  }),
}))

vi.mock('@/lib/openai/client', () => ({
  embedChunks: mockEmbedChunks,
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === 'creator_strategies') {
        return { insert: mockInsert }
      }
      // refresh_jobs: .update(...).eq(...).eq(...) chain
      return {
        update: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: [] }),
            }),
          }),
        }),
      }
    },
  }),
}))

vi.mock('@/lib/strategy/contradiction', () => ({
  runContradictionCheck: mockContradictionCheck,
}))

vi.mock('@/lib/pinecone/client', () => ({
  getPineconeNamespace: vi.fn(() => ({ query: mockNsQuery })),
}))

// A single non-empty match to return when we want chunks present
const MATCH = {
  id: 'chunk-1',
  score: 0.9,
  metadata: { text: 'test content', creator_id: 'c1', video_id: 'v1' },
}

// CI-02: Two-call pattern tests
// Each test resets modules so the extractor's cached state is clean.
describe('extractCreatorStrategy — two-call pattern (CI-02)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.resetModules()
    // Restore mock implementations after resetAllMocks wipes them
    mockEmbedChunks.mockResolvedValue([[0.1, 0.2, 0.3]])
    mockContradictionCheck.mockReturnValue({ hasContradiction: false, reason: null })
    mockCreate.mockResolvedValue({
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
    })
    mockInsert.mockResolvedValue({ error: null })
  })

  it('calls Claude twice when 30-day chunks exist', async () => {
    // QUERY_TEXTS has 3 items → stable calls ns.query 3 times, latest calls it 3 more times.
    // All 6 calls return a non-empty match → both stable and latest have chunks.
    mockNsQuery.mockResolvedValue({ matches: [MATCH] })

    const { extractCreatorStrategy } = await import('@/lib/strategy/extractor')
    await extractCreatorStrategy('creator-1', 'user-1')

    expect(mockCreate).toHaveBeenCalledTimes(2)
  })

  it('calls Claude once when 30-day chunks are empty (D-09)', async () => {
    // embedChunks returns [[0.1,0.2,0.3]] — a single vector.
    // So queryPinecone loops exactly once per retrieveChunks call.
    //
    // Call sequence:
    //   stable queryPinecone: 1 ns.query call with filter → MATCH → stableChunks.length=1
    //   latest queryPinecone: 1 ns.query call with filter → [] → allMatches.size=0
    //     → fallback: 1 ns.query call without filter → [] → latestChunks.length=0
    //   → second Claude call skipped (D-09)
    //
    // Total: 3 calls. First 1 is MATCH, remaining 2 are [].
    mockNsQuery
      .mockResolvedValueOnce({ matches: [MATCH] }) // stable (1 vector)
      .mockResolvedValue({ matches: [] })           // latest filter + latest fallback

    const { extractCreatorStrategy } = await import('@/lib/strategy/extractor')
    await extractCreatorStrategy('creator-2', 'user-1')

    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it('sets profile_latest = null in DB insert when latestChunks.length === 0', async () => {
    // Same setup as D-09 test: stable returns chunks, latest returns nothing (with fallback)
    mockNsQuery
      .mockResolvedValueOnce({ matches: [MATCH] }) // stable (1 vector)
      .mockResolvedValue({ matches: [] })           // latest filter + latest fallback

    const { extractCreatorStrategy } = await import('@/lib/strategy/extractor')
    await extractCreatorStrategy('creator-3', 'user-1')

    expect(mockInsert).toHaveBeenCalledTimes(1)
    const insertArg = mockInsert.mock.calls[0][0]
    expect(insertArg.profile_latest).toBeNull()
  })
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
