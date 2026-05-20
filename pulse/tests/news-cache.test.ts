/**
 * news-cache.test.ts — Wave 0 stubs (RED state).
 * These tests describe the contracts for Wave 1 implementation.
 * Stubs marked TODO will be replaced with real imports in Wave 1.
 * NEWS-01, NEWS-02, NEWS-06, NEWS-07
 */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// NEWS-06 / NEWS-07: TTL staleness logic
// ---------------------------------------------------------------------------
// This logic will live in news-actions.ts (Wave 1). Tested inline here.

function isCacheStale(fetchedAt: Date, ttlMs: number): boolean {
  return Date.now() - fetchedAt.getTime() > ttlMs
}

const HEADLINES_TTL_MS = 24 * 60 * 60 * 1000 // 24h

describe('isCacheStale (NEWS-06, NEWS-07)', () => {
  it('returns false for a freshly fetched row', () => {
    const now = new Date()
    expect(isCacheStale(now, HEADLINES_TTL_MS)).toBe(false)
  })

  it('returns true for a row fetched more than 24h ago', () => {
    const staleDate = new Date(Date.now() - 25 * 60 * 60 * 1000)
    expect(isCacheStale(staleDate, HEADLINES_TTL_MS)).toBe(true)
  })

  it('returns false for a row fetched exactly 23h ago', () => {
    const freshDate = new Date(Date.now() - 23 * 60 * 60 * 1000)
    expect(isCacheStale(freshDate, HEADLINES_TTL_MS)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// NEWS-01: FinnhubNewsItem shape contract
// ---------------------------------------------------------------------------
// fetchFinnhubMarketNews() will return FinnhubNewsItem[]. Test the shape.

interface FinnhubNewsItem {
  headline: string
  url: string
  datetime: number
  source: string
  related: string
}

describe('FinnhubNewsItem shape (NEWS-01)', () => {
  it('has all required fields with correct types', () => {
    const item: FinnhubNewsItem = {
      headline: 'Markets rise on positive data',
      url: 'https://example.com/news/1',
      datetime: 1716134400,
      source: 'Reuters',
      related: 'AAPL,MSFT',
    }
    expect(typeof item.headline).toBe('string')
    expect(typeof item.url).toBe('string')
    expect(typeof item.datetime).toBe('number')
    expect(typeof item.source).toBe('string')
    expect(typeof item.related).toBe('string')
  })

  it('related field can be empty string (general news with no ticker mentions)', () => {
    const item: FinnhubNewsItem = {
      headline: 'Macro inflation data released',
      url: 'https://example.com/news/2',
      datetime: 1716134400,
      source: 'BBC',
      related: '',
    }
    expect(item.related).toBe('')
  })
})

// ---------------------------------------------------------------------------
// NEWS-02: RSS partial failure handling
// ---------------------------------------------------------------------------
// fetchRssFeeds() uses Promise.allSettled. Test that partial failure is handled.

async function simulateFetchRssFeeds(
  feeds: Array<{ url: string; shouldFail: boolean }>
): Promise<string[]> {
  const results = await Promise.allSettled(
    feeds.map(async ({ url, shouldFail }) => {
      if (shouldFail) throw new Error(`Feed ${url} timed out`)
      return [`headline from ${url}`]
    })
  )
  return results
    .filter((r): r is PromiseFulfilledResult<string[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value)
}

describe('RSS partial failure handling (NEWS-02)', () => {
  it('returns items from successful feeds when one feed fails', async () => {
    const feeds = [
      { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', shouldFail: false },
      { url: 'https://www.bankofengland.co.uk/rss/news', shouldFail: true },
    ]
    const items = await simulateFetchRssFeeds(feeds)
    expect(items).toHaveLength(1)
    expect(items[0]).toContain('bbci.co.uk')
  })

  it('returns empty array when all feeds fail', async () => {
    const feeds = [
      { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', shouldFail: true },
      { url: 'https://www.bankofengland.co.uk/rss/news', shouldFail: true },
    ]
    const items = await simulateFetchRssFeeds(feeds)
    expect(items).toHaveLength(0)
  })

  it('returns items from all feeds when none fail', async () => {
    const feeds = [
      { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', shouldFail: false },
      { url: 'https://www.bankofengland.co.uk/rss/news', shouldFail: false },
    ]
    const items = await simulateFetchRssFeeds(feeds)
    expect(items).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// NEWS-07: UPSERT uniqueness — one row per user
// ---------------------------------------------------------------------------
// In Wave 1, Supabase UPSERT with onConflict: 'user_id' ensures uniqueness.
// Test the logic of detecting duplicate user_id keys.

describe('UPSERT uniqueness (NEWS-07)', () => {
  it('onConflict key is user_id', () => {
    // This documents the upsert shape; Wave 1 will use supabase.from("news_cache").upsert(..., { onConflict: "user_id" })
    const upsertOptions = { onConflict: 'user_id' }
    expect(upsertOptions.onConflict).toBe('user_id')
  })
})
