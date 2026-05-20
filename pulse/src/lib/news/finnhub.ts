/**
 * finnhub.ts — Finnhub market-news REST fetch.
 * Server-only: FINNHUB_API_KEY must never reach the browser.
 * Uses general market-news endpoint (category=general) — not company-news.
 * Per D-13, RESEARCH.md Pattern 1, Pitfall 1.
 */
import 'server-only'
import type { FinnhubNewsItem } from '@/lib/news/news-types'

const FINNHUB_BASE = 'https://finnhub.io/api/v1'

/**
 * Fetch general market news from Finnhub.
 * Returns up to 50 items (Finnhub default for general category).
 * Throws if FINNHUB_API_KEY is not set or if the API returns a non-OK status.
 */
export async function fetchFinnhubMarketNews(): Promise<FinnhubNewsItem[]> {
  const token = process.env.FINNHUB_API_KEY
  if (!token) {
    throw new Error(
      'FINNHUB_API_KEY is not set. Obtain a free-tier key at https://finnhub.io and add it to .env.local.'
    )
  }

  const url = `${FINNHUB_BASE}/news?category=general&token=${token}`
  const res = await fetch(url, { cache: 'no-store' })

  if (!res.ok) {
    throw new Error(`Finnhub returned HTTP ${res.status} ${res.statusText}`)
  }

  const items = (await res.json()) as FinnhubNewsItem[]
  // Return only the first 50 items to keep Claude token budget predictable
  return items.slice(0, 50)
}
