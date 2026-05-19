/**
 * Tests for extractCreatorStrategy() — STRAT-01, STRAT-02, STRAT-03.
 * All external I/O mocked: no real API calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports that use them
// ---------------------------------------------------------------------------

const mockInsert = vi.fn().mockResolvedValue({ error: null })
const mockUpsert = vi.fn().mockResolvedValue({ error: null })

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === 'creator_strategies') {
        return {
          insert: mockInsert,
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () =>
                  Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }
      }
      // refresh_jobs upsert
      return {
        upsert: mockUpsert,
      }
    },
  }),
}))

vi.mock('@/lib/openai/client', () => ({
  embedChunks: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
}))

const mockPineconeQuery = vi.fn().mockResolvedValue({
  matches: [
    {
      id: 'vid1-chunk-0',
      score: 0.9,
      metadata: {
        creator_id: 'creator-uuid',
        video_id: 'vid1',
        title: 'My Portfolio 2024',
        published_at: '2024-01-01',
        text: 'I put 60% in tech stocks and 20% in dividends.',
      },
    },
  ],
})

vi.mock('@/lib/pinecone/client', () => ({
  getPineconeNamespace: () => ({
    query: mockPineconeQuery,
  }),
}))

const mockMessagesCreate = vi.fn().mockResolvedValue({
  content: [
    {
      type: 'tool_use',
      name: 'extract_creator_profile',
      input: {
        methodology: 'Focus on growth stocks and index funds',
        favoured_stocks: [{ ticker: 'AAPL', name: 'Apple Inc.', rationale: 'Strong fundamentals', conviction: 'high' }],
        sector_focus: [{ sector: 'Technology', stance: 'bullish', rationale: 'Long-term growth' }],
        preferred_index_funds: [{ name: 'Vanguard S&P 500', ticker: 'VOO', rationale: 'Low cost index exposure' }],
        confidence: 75,
        source_video_ids: ['vid1'],
      },
    },
  ],
})

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: mockMessagesCreate,
    },
  })),
}))

vi.mock('@/lib/anthropic/client', () => ({
  getAnthropic: () => ({
    messages: {
      create: mockMessagesCreate,
    },
  }),
}))

// Stub server-only so it doesn't throw in test environment
vi.mock('server-only', () => ({}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

import { extractCreatorStrategy } from './extractor'

const CREATOR_ID = 'creator-uuid-1234'
const USER_ID = 'user-uuid-5678'

beforeEach(() => {
  vi.clearAllMocks()
  mockInsert.mockResolvedValue({ error: null })
  mockPineconeQuery.mockResolvedValue({
    matches: [
      {
        id: 'vid1-chunk-0',
        score: 0.9,
        metadata: {
          creator_id: 'creator-uuid',
          video_id: 'vid1',
          title: 'My Portfolio 2024',
          published_at: '2024-01-01',
          text: 'I put 60% in tech stocks and 20% in dividends.',
        },
      },
    ],
  })
})

describe('extractCreatorStrategy (STRAT-01, STRAT-02, STRAT-03)', () => {
  it('STRAT-01: runs without throwing given valid mocks', async () => {
    await expect(extractCreatorStrategy(CREATOR_ID, USER_ID)).resolves.toBeUndefined()
  })

  it('STRAT-01: calls Claude messages.create with tool_choice forced to extract_creator_profile', async () => {
    await extractCreatorStrategy(CREATOR_ID, USER_ID)
    expect(mockMessagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        tool_choice: { type: 'tool', name: 'extract_creator_profile' },
      }),
    )
  })

  it('STRAT-01: calls Claude with model claude-sonnet-4-6', async () => {
    await extractCreatorStrategy(CREATOR_ID, USER_ID)
    expect(mockMessagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-sonnet-4-6' }),
    )
  })

  it('STRAT-01: throws if Claude returns no tool_use block', async () => {
    mockMessagesCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: 'oops' }] })
    await expect(extractCreatorStrategy(CREATOR_ID, USER_ID)).rejects.toThrow(
      'tool_use block',
    )
  })

  it('STRAT-02: calls supabase insert (not update) — new row each time', async () => {
    await extractCreatorStrategy(CREATOR_ID, USER_ID)
    expect(mockInsert).toHaveBeenCalledTimes(1)
  })

  it('STRAT-02: insert payload includes creator_id', async () => {
    await extractCreatorStrategy(CREATOR_ID, USER_ID)
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ creator_id: CREATOR_ID }),
    )
  })

  it('STRAT-03: insert payload includes confidence score', async () => {
    await extractCreatorStrategy(CREATOR_ID, USER_ID)
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ confidence: 75 }),
    )
  })

  it('STRAT-03: insert payload includes source_video_ids array', async () => {
    await extractCreatorStrategy(CREATOR_ID, USER_ID)
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ source_video_ids: ['vid1'] }),
    )
  })

  it('STRAT-01: throws if no Pinecone chunks found', async () => {
    mockPineconeQuery.mockResolvedValueOnce({ matches: [] })
    await expect(extractCreatorStrategy(CREATOR_ID, USER_ID)).rejects.toThrow(
      'No Pinecone chunks found',
    )
  })
})
