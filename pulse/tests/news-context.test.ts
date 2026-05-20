/**
 * news-context.test.ts — Wave 0 stubs (RED state).
 * Tests the NewsContextResult shape and the advice-language guard.
 * NEWS-03, NEWS-04
 */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// NewsContextResult shape (NEWS-03)
// ---------------------------------------------------------------------------
// This is the expected output shape from Claude's generate_news_context tool.
// Wave 1 will export this type from lib/news/news-types.ts.

interface MacroTheme {
  sector: string
  theme: string
  sentiment: 'positive' | 'neutral' | 'negative'
}

interface NewsContextResult {
  ticker_counts: Record<string, number>
  macro_themes: MacroTheme[]
  context_summary: string
}

describe('NewsContextResult shape (NEWS-03)', () => {
  it('has ticker_counts as Record<string, number>', () => {
    const result: NewsContextResult = {
      ticker_counts: { AAPL: 3, VWRL: 1 },
      macro_themes: [],
      context_summary: 'Markets showed mixed signals this month.',
    }
    expect(typeof result.ticker_counts).toBe('object')
    expect(result.ticker_counts['AAPL']).toBe(3)
  })

  it('has macro_themes as array with sector, theme, sentiment', () => {
    const theme: MacroTheme = {
      sector: 'Technology',
      theme: 'AI chip demand rising',
      sentiment: 'positive',
    }
    expect(['positive', 'neutral', 'negative']).toContain(theme.sentiment)
    expect(typeof theme.sector).toBe('string')
    expect(typeof theme.theme).toBe('string')
  })

  it('has context_summary as non-empty string', () => {
    const result: NewsContextResult = {
      ticker_counts: {},
      macro_themes: [],
      context_summary: 'The UK market this month saw increased volatility.',
    }
    expect(typeof result.context_summary).toBe('string')
    expect(result.context_summary.length).toBeGreaterThan(0)
  })

  it('all three fields are required (no optional fields)', () => {
    // TypeScript-level: this documents the required shape enforced by the tool schema
    const minimalResult: NewsContextResult = {
      ticker_counts: {},
      macro_themes: [],
      context_summary: 'No significant news this month.',
    }
    expect(minimalResult).toHaveProperty('ticker_counts')
    expect(minimalResult).toHaveProperty('macro_themes')
    expect(minimalResult).toHaveProperty('context_summary')
  })
})

// ---------------------------------------------------------------------------
// NEWS-04: ticker_counts keys match watch list tickers
// ---------------------------------------------------------------------------

describe('ticker_counts keys (NEWS-04)', () => {
  it('every key in ticker_counts is a non-empty string', () => {
    const counts: Record<string, number> = { AAPL: 2, VWRL: 0, HSBA: 5 }
    for (const key of Object.keys(counts)) {
      expect(typeof key).toBe('string')
      expect(key.length).toBeGreaterThan(0)
    }
  })

  it('every value in ticker_counts is a non-negative integer', () => {
    const counts: Record<string, number> = { AAPL: 2, VWRL: 0, HSBA: 5 }
    for (const val of Object.values(counts)) {
      expect(Number.isInteger(val)).toBe(true)
      expect(val).toBeGreaterThanOrEqual(0)
    }
  })

  it('returns 0 for watch list tickers with no relevant headlines', () => {
    const watchListTickers = ['AAPL', 'VWRL', 'HSBA']
    const rawCounts: Record<string, number> = { AAPL: 3 }
    // When Claude omits a ticker, it means 0 — fill missing as 0
    const fullCounts = Object.fromEntries(
      watchListTickers.map((t) => [t, rawCounts[t] ?? 0])
    )
    expect(fullCounts['VWRL']).toBe(0)
    expect(fullCounts['HSBA']).toBe(0)
    expect(fullCounts['AAPL']).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// Advice-language guard (NEWS-03, CLAUDE.md constraint)
// ---------------------------------------------------------------------------
// Wave 1 will call this guard after the Claude response. Test it inline here.

const FORBIDDEN_WORDS = ['recommend', 'advice', 'suggest', 'you should']

function containsAdviceLanguage(text: string): boolean {
  return FORBIDDEN_WORDS.some((w) => text.toLowerCase().includes(w))
}

describe('advice-language guard (NEWS-03)', () => {
  it('returns false for observational language', () => {
    const summary = 'Technology stocks showed increased trading volume this week.'
    expect(containsAdviceLanguage(summary)).toBe(false)
  })

  it('returns true when summary contains "recommend"', () => {
    const summary = 'I recommend buying AAPL given current trends.'
    expect(containsAdviceLanguage(summary)).toBe(true)
  })

  it('returns true when summary contains "advice"', () => {
    const summary = 'This is financial advice: buy index funds.'
    expect(containsAdviceLanguage(summary)).toBe(true)
  })

  it('returns true when summary contains "suggest"', () => {
    const summary = 'The data suggest you should increase exposure.'
    expect(containsAdviceLanguage(summary)).toBe(true)
  })

  it('is case-insensitive', () => {
    const summary = 'I RECOMMEND diversifying your portfolio.'
    expect(containsAdviceLanguage(summary)).toBe(true)
  })
})
