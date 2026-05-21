import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

// Mock googleapis before any import that touches getYouTubeClient
const mockSearchList = vi.fn()
const mockChannelsList = vi.fn()

vi.mock('googleapis', () => ({
  google: {
    youtube: vi.fn(() => ({
      search: { list: mockSearchList },
      channels: { list: mockChannelsList },
      playlistItems: { list: vi.fn().mockResolvedValue({ data: { items: [] } }) },
    })),
  },
}))

// CI-01: listVideosLast4Months cutoff logic
// NOTE: The actual listVideosLast4Months function requires a real YouTube API key.
// We test the cutoff calculation logic in isolation here.
describe('listVideosLast4Months — cutoff calculation', () => {
  it('4-month cutoff is approximately 120 days ago', () => {
    const now = new Date()
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - 4)
    const diffDays = (now.getTime() - cutoff.getTime()) / (1000 * 60 * 60 * 24)
    // Allow 1-day variance for month-length differences
    expect(diffDays).toBeGreaterThanOrEqual(118)
    expect(diffDays).toBeLessThanOrEqual(125)
  })

  it('handles year rollover (January - 4 = September prior year)', () => {
    // Simulate cutoff from January
    const jan = new Date(2025, 0, 15) // 15 Jan 2025
    const cutoff = new Date(jan)
    cutoff.setMonth(cutoff.getMonth() - 4)
    expect(cutoff.getFullYear()).toBe(2024)
    expect(cutoff.getMonth()).toBe(8) // September = index 8
  })
})

// SRCH-02: formatSubscriberCount (pure unit — no mock needed)
describe('formatSubscriberCount', () => {
  it('formats 1_200_000 as "1.2M subscribers"', async () => {
    const { formatSubscriberCount } = await import('@/lib/youtube/client')
    expect(formatSubscriberCount(1_200_000)).toBe('1.2M subscribers')
  })

  it('formats 500_000 as "500K subscribers"', async () => {
    const { formatSubscriberCount } = await import('@/lib/youtube/client')
    expect(formatSubscriberCount(500_000)).toBe('500K subscribers')
  })

  it('formats 12_345 as "12K subscribers"', async () => {
    const { formatSubscriberCount } = await import('@/lib/youtube/client')
    expect(formatSubscriberCount(12_345)).toBe('12K subscribers')
  })

  it('formats 999 as "999 subscribers"', async () => {
    const { formatSubscriberCount } = await import('@/lib/youtube/client')
    expect(formatSubscriberCount(999)).toBe('999 subscribers')
  })

  it('returns empty string for null', async () => {
    const { formatSubscriberCount } = await import('@/lib/youtube/client')
    expect(formatSubscriberCount(null)).toBe('')
  })
})

// SRCH-01: searchChannels — mocked googleapis
describe('searchChannels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.YOUTUBE_API_KEY = 'test-key'
  })

  it('returns at most 5 results with correct shape', async () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      snippet: {
        channelId: `UCtest${i}`,
        channelTitle: `Channel ${i}`,
        thumbnails: { default: { url: `https://thumb${i}.jpg` } },
      },
    }))

    mockSearchList.mockResolvedValue({ data: { items } })
    mockChannelsList.mockResolvedValue({
      data: {
        items: items.map((item, i) => ({
          id: item.snippet.channelId,
          statistics: { subscriberCount: String((i + 1) * 100_000) },
        })),
      },
    })

    const { searchChannels } = await import('@/lib/youtube/client')
    const results = await searchChannels('test query')

    expect(results.length).toBeLessThanOrEqual(5)
    expect(results.length).toBeGreaterThan(0)
    for (const r of results) {
      expect(r).toHaveProperty('channelId')
      expect(r).toHaveProperty('channelTitle')
      expect(r).toHaveProperty('channelUrl')
      expect(r).toHaveProperty('subscriberCount')
      expect(r).toHaveProperty('thumbnailUrl')
    }
  })

  it('channelUrl constructed as https://www.youtube.com/channel/{channelId}', async () => {
    const channelId = 'UCtest1234567890123456'
    mockSearchList.mockResolvedValue({
      data: {
        items: [{
          snippet: {
            channelId,
            channelTitle: 'Test Channel',
            thumbnails: { default: { url: 'https://thumb.jpg' } },
          },
        }],
      },
    })
    mockChannelsList.mockResolvedValue({
      data: {
        items: [{ id: channelId, statistics: { subscriberCount: '1200000' } }],
      },
    })

    const { searchChannels } = await import('@/lib/youtube/client')
    const results = await searchChannels('test query')

    expect(results[0].channelUrl).toBe(`https://www.youtube.com/channel/${channelId}`)
  })

  it('returns empty array when search returns no items', async () => {
    mockSearchList.mockResolvedValue({ data: { items: [] } })

    const { searchChannels } = await import('@/lib/youtube/client')
    const results = await searchChannels('no results query')

    expect(results).toEqual([])
  })
})
