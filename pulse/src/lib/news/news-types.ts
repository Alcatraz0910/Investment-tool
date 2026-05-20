/**
 * news-types.ts — Phase 13 shared types for the news intelligence layer.
 * Server-side only types (consumed by finnhub.ts, rss.ts, news-actions.ts).
 * D-13: new file in lib/news/ directory.
 */

/** Item from Finnhub market-news endpoint (category=general). */
export interface FinnhubNewsItem {
  headline: string
  url: string
  datetime: number   // Unix timestamp seconds
  source: string
  related: string    // comma-separated tickers; may be empty for general news
}

/** Normalised item from RSS feed (BBC Business, Bank of England). */
export interface RssItem {
  title: string
  link: string
  pubDate: string   // ISO or RFC 2822 string
  source: string    // injected by fetchRssFeeds: 'BBC Business' | 'Bank of England'
}

/** Macro theme entry from Claude generate_news_context tool output. */
export interface MacroTheme {
  sector: string
  theme: string
  sentiment: 'positive' | 'neutral' | 'negative'
}

/**
 * Structured output from Claude generate_news_context tool (D-07, D-09).
 * Stored as news_cache.context JSONB column.
 */
export interface NewsContextResult {
  ticker_counts: Record<string, number>  // ticker → number of relevant headlines
  macro_themes: MacroTheme[]             // sector-level macro themes
  context_summary: string                // 3-4 sentence observational summary
}

/**
 * Shape of the initialNewsContext prop passed from page.tsx to WatchListTab (D-01).
 * Derived from news_cache row on page load.
 * creatorSectors: sector names read from creator_strategies.profile_stable sector_focus —
 *   passed through to refreshNewsAndSummary so Claude receives sector hints (RESEARCH.md open Q3 resolution).
 */
export interface NewsCacheContext {
  contextSummary: string | null
  newsLastFetchedAt: Date | null
  tickerCounts: Record<string, number>
  macroThemes: MacroTheme[]
  creatorSectors: string[]
}

/**
 * Return type for refreshNewsAndSummary() server action.
 * data is present on success so the client can update local state directly
 * without a page reload (avoids window.location.reload() destroying React state).
 */
export type NewsRefreshResult =
  | { success: true; partial: false; data: NewsContextResult }
  | { success: true; partial: true; failedFeeds: string[]; data: NewsContextResult }
  | { success: false; error: string }
