/**
 * news-actions.ts — refreshNewsAndSummary() server action.
 * Orchestrates: Finnhub fetch → RSS fetch → Claude cross-reference → Supabase UPSERT.
 * D-07: forced tool use (tool_choice: { type: 'tool', name: 'generate_news_context' })
 * D-08: one row per user, UPSERT on conflict user_id
 * D-11: partial RSS failure continues with available data
 * D-12: full Finnhub failure aborts and returns error
 * Returns data: NewsContextResult on success so the client can setNewsContext() directly.
 */
'use server'

import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { getAnthropic } from '@/lib/anthropic/client'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { fetchFinnhubMarketNews } from '@/lib/news/finnhub'
import { fetchRssFeeds } from '@/lib/news/rss'
import type {
  FinnhubNewsItem,
  RssItem,
  NewsContextResult,
  NewsRefreshResult,
} from '@/lib/news/news-types'

// ---------------------------------------------------------------------------
// Claude tool definition (D-07, NEWS-03) — mirrors PROFILE_TOOL_DEF pattern
// ---------------------------------------------------------------------------

const NEWS_CONTEXT_TOOL: Anthropic.Tool = {
  name: 'generate_news_context',
  description:
    'Cross-reference news headlines against a watch list and produce a structured summary.',
  input_schema: {
    type: 'object' as const,
    properties: {
      ticker_counts: {
        type: 'object',
        description:
          'Map of ticker symbol → count of headlines that mention or relate to that ticker or its company.',
        additionalProperties: { type: 'integer' },
      },
      macro_themes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            sector: { type: 'string' },
            theme: { type: 'string' },
            sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
          },
          required: ['sector', 'theme', 'sentiment'],
        },
        description: 'Key macro themes from the headlines relevant to the tracked sectors.',
      },
      context_summary: {
        type: 'string',
        description:
          '3-4 sentences describing current market conditions relevant to the watch list. Observational language only.',
      },
    },
    required: ['ticker_counts', 'macro_themes', 'context_summary'],
  },
}

// D-07: system prompt — must not contain "advice", "recommend", or "suggest" (CLAUDE.md)
const NEWS_SYSTEM_PROMPT = `You are analysing recent financial news headlines to identify themes \
relevant to an investor's watch list. Cross-reference the headlines against the provided tickers \
and sectors. Count how many headlines are relevant to each ticker (by direct mention or company name). \
Identify macro themes affecting the tracked sectors. Write a 3-4 sentence context summary describing \
current market conditions relevant to the watch list. Use observational language only — describe what \
the news covers. Do not use the words "advice", "recommend", or "suggest".`

// ---------------------------------------------------------------------------
// Post-call advice-language guard (CLAUDE.md, Pitfall 5)
// ---------------------------------------------------------------------------

const FORBIDDEN_WORDS = ['recommend', 'advice', 'suggest', 'you should']

function assertNoAdviceLanguage(summary: string): void {
  const lower = summary.toLowerCase()
  const found = FORBIDDEN_WORDS.find((w) => lower.includes(w))
  if (found) {
    throw new Error(
      `context_summary contains forbidden advice language: "${found}". Regenerate.`
    )
  }
}

// ---------------------------------------------------------------------------
// Main exported server action
// ---------------------------------------------------------------------------

export async function refreshNewsAndSummary(
  watchListTickers: string[],
  creatorSectors: string[]
): Promise<NewsRefreshResult> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: 'Not authenticated' }

  // --- Step 1: Finnhub fetch (D-12: full failure aborts) ---
  let finnhubItems: FinnhubNewsItem[] = []
  try {
    finnhubItems = await fetchFinnhubMarketNews()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown Finnhub error'
    return { success: false, error: `Finnhub fetch failed: ${msg}` }
  }

  // --- Step 2: RSS fetch (D-11: partial failure continues) ---
  const { items: rssItems, failedFeeds } = await fetchRssFeeds()
  // If Finnhub returned nothing AND all RSS failed: abort (D-12 full failure)
  if (finnhubItems.length === 0 && rssItems.length === 0) {
    return { success: false, error: 'News refresh failed. No data available from any source.' }
  }

  // --- Step 3: Build Claude user prompt ---
  const headlines = [
    ...finnhubItems.map((item) => `[Finnhub] ${item.headline}`),
    ...rssItems.map((item) => `[${item.source}] ${item.title}`),
  ].slice(0, 50) // cap at 50 headlines to keep token budget predictable

  const userPrompt = [
    `Watch list tickers: ${watchListTickers.join(', ') || 'none'}`,
    `Tracked sectors: ${creatorSectors.join(', ') || 'none'}`,
    '',
    'Recent headlines:',
    ...headlines.map((h, i) => `${i + 1}. ${h}`),
  ].join('\n')

  // --- Step 4: Claude structured output (D-06, D-07) ---
  const anthropic = getAnthropic()
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: NEWS_SYSTEM_PROMPT,
    tool_choice: { type: 'tool', name: 'generate_news_context' },
    tools: [NEWS_CONTEXT_TOOL],
    messages: [{ role: 'user', content: userPrompt }],
  })

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
  )
  if (!toolBlock) {
    return { success: false, error: 'Claude did not return a tool_use block' }
  }

  const contextResult = toolBlock.input as NewsContextResult

  if (typeof contextResult.context_summary !== 'string') {
    return { success: false, error: 'Claude did not return a context_summary — try refreshing again' }
  }

  // Post-call guard: reject if advice language slipped through (CLAUDE.md, Pitfall 5)
  assertNoAdviceLanguage(contextResult.context_summary)

  // --- Step 5: Supabase UPSERT (D-08, D-10) ---
  // headlines stored as JSONB array; context stored as JSONB object
  const headlinesJson = [
    ...finnhubItems.map((item: FinnhubNewsItem) => ({ headline: item.headline, url: item.url, source: item.source })),
    ...rssItems.map((item: RssItem) => ({ headline: item.title, url: item.link, source: item.source })),
  ]

  const { error: upsertError } = await supabase
    .from('news_cache')
    .upsert(
      {
        user_id: user.id,
        headlines: headlinesJson,
        context: contextResult,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (upsertError) {
    return { success: false, error: `Cache save failed: ${upsertError.message}` }
  }

  // Revalidate the dashboard page so the RSC re-fetches the new cache row on next navigation
  revalidatePath('/dashboard')

  // Return contextResult so the client can update local state directly (no reload needed)
  if (failedFeeds.length > 0) {
    return { success: true, partial: true, failedFeeds, data: contextResult }
  }
  return { success: true, partial: false, data: contextResult }
}
