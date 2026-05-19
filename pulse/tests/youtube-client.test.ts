import { describe, it, expect } from 'vitest'
import { formatSubscriberCount } from '@/lib/youtube/client'

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
  it('formats 1_200_000 as "1.2M subscribers"', () => {
    expect(formatSubscriberCount(1_200_000)).toBe('1.2M subscribers')
  })

  it('formats 500_000 as "500K subscribers"', () => {
    expect(formatSubscriberCount(500_000)).toBe('500K subscribers')
  })

  it('formats 12_345 as "12K subscribers"', () => {
    expect(formatSubscriberCount(12_345)).toBe('12K subscribers')
  })

  it('formats 999 as "999 subscribers"', () => {
    expect(formatSubscriberCount(999)).toBe('999 subscribers')
  })

  it('returns empty string for null', () => {
    expect(formatSubscriberCount(null)).toBe('')
  })
})

// SRCH-01: searchChannels integration shape test (integration — requires real API)
describe('searchChannels', () => {
  it.todo('returns at most 5 results with correct shape (requires real YOUTUBE_API_KEY — run manually)')
  it.todo('channelUrl constructed as https://www.youtube.com/channel/{channelId}')
  it.todo('returns empty array when search returns no items')
})
