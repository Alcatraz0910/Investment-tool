/**
 * rss.ts — RSS feed fetch and parse via rss-parser.
 * Server-only: rss-parser uses Node.js streams; browser-incompatible.
 * Per D-13, RESEARCH.md Pattern 2, Pitfall 2, Pitfall 6.
 * Uses Promise.allSettled for graceful partial-failure handling (D-11).
 */
import 'server-only'
import Parser from 'rss-parser'
import type { RssItem } from '@/lib/news/news-types'

// 8s timeout per feed — BoE RSS can be slow (Pitfall 6)
const parser = new Parser({
  timeout: 8000,
  headers: { 'User-Agent': 'Pulse/1.0 (personal ISA planning tool)' },
})

/** Confirmed RSS feeds for UK macro context (RESEARCH.md RSS Feed URL Reference). */
const RSS_FEEDS: Array<{ url: string; source: string }> = [
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', source: 'BBC Business' },
  { url: 'https://www.bankofengland.co.uk/rss/news', source: 'Bank of England' },
  // Reuters UK: URL unconfirmed as of 2026 — omitted per RESEARCH.md open question 1.
  // ONS fallback: https://www.ons.gov.uk/feeds/rss/ons-rss-feed.xml — verify before adding.
]

export interface RssFetchResult {
  items: RssItem[]
  failedFeeds: string[]
}

/**
 * Fetch and parse all RSS feeds in parallel.
 * Uses Promise.allSettled: partial feed failure continues with available data (D-11).
 * Returns both the collected items and the list of feeds that failed (for error banner).
 */
export async function fetchRssFeeds(): Promise<RssFetchResult> {
  const results = await Promise.allSettled(
    RSS_FEEDS.map(async ({ url, source }) => {
      const feed = await parser.parseURL(url)
      return (feed.items ?? []).slice(0, 20).map((item): RssItem => ({
        title: item.title ?? '',
        link: item.link ?? '',
        pubDate: item.pubDate ?? new Date().toISOString(),
        source,
      }))
    })
  )

  const items: RssItem[] = []
  const failedFeeds: string[] = []

  results.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      items.push(...result.value)
    } else {
      failedFeeds.push(RSS_FEEDS[idx].source)
    }
  })

  return { items, failedFeeds }
}
