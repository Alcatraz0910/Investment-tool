/**
 * Unit tests for refreshHoldingPrices and fetchTickerPrices server actions.
 * Mocks yahoo-finance2 (YahooFinance class) and Supabase createClient.
 * Follows the vi.hoisted() pattern from import-actions.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mock refs — must be declared before vi.mock calls
// ---------------------------------------------------------------------------

const { mockQuote, mockCreateClient } = vi.hoisted(() => {
  const mockQuote = vi.fn()
  const mockCreateClient = vi.fn()
  return { mockQuote, mockCreateClient }
})

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({})),
}))

// Mock yahoo-finance2: the default export is a class; mock it so that
// `new YahooFinance()` returns an object with a `quote` spy.
// Must use a real function (not arrow) so `new` works.
vi.mock('yahoo-finance2', () => {
  function MockYahooFinance(this: { quote: typeof mockQuote }) {
    this.quote = mockQuote
  }
  return {
    default: MockYahooFinance,
  }
})

// ---------------------------------------------------------------------------
// Import after mocks are set up
// ---------------------------------------------------------------------------

import { refreshHoldingPrices, fetchTickerPrices } from '../actions'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a Supabase client mock.
 * SELECT chain: .from().select().eq() → { data, error }
 * UPDATE chain: .from().update().eq().eq() → { error }
 */
function makeSupabaseMock({
  user = { id: 'user-1' } as { id: string } | null,
  holdingRows = [{ id: '1', ticker: 'VWRL' }] as Array<{ id: string; ticker: string }>,
  selectError = null as { message?: string; code?: string } | null,
  updateError = null as { message?: string; code?: string } | null,
} = {}) {
  // UPDATE chain: .update({}).eq(...).eq(...) resolves to { error }
  const innerEq = vi.fn().mockResolvedValue({ error: updateError })
  const outerEq = vi.fn().mockReturnValue({ eq: innerEq })
  const updateFn = vi.fn().mockReturnValue({ eq: outerEq })

  // SELECT chain: .select('id, ticker').eq('user_id', ...) resolves to { data, error }
  const selectEq = vi.fn().mockResolvedValue({ data: holdingRows, error: selectError })
  const selectFn = vi.fn().mockReturnValue({ eq: selectEq })

  const fromFn = vi.fn().mockReturnValue({
    select: selectFn,
    update: updateFn,
  })

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: fromFn,
  }
}

// ---------------------------------------------------------------------------
// Tests: refreshHoldingPrices
// ---------------------------------------------------------------------------

describe('refreshHoldingPrices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error when user is not authenticated', async () => {
    mockCreateClient.mockResolvedValueOnce(makeSupabaseMock({ user: null }))

    const result = await refreshHoldingPrices()

    expect(result.error).toBeTruthy()
    expect(result.error).toBe('Something went wrong. Please try again.')
  })

  it('returns empty results when no holdings exist', async () => {
    mockCreateClient.mockResolvedValueOnce(makeSupabaseMock({ holdingRows: [] }))

    const result = await refreshHoldingPrices()

    expect(result.results).toEqual([])
    expect(result.error).toBeUndefined()
  })

  it('returns null price for ticker that throws from yahooFinance', async () => {
    mockCreateClient.mockResolvedValueOnce(
      makeSupabaseMock({ holdingRows: [{ id: '1', ticker: 'FAKE' }] })
    )
    mockQuote.mockRejectedValueOnce(new Error('network error'))

    const result = await refreshHoldingPrices()

    expect(result.results).toBeDefined()
    expect(result.results![0]).toMatchObject({
      ticker: 'FAKE',
      price: null,
      error: 'not found',
    })
  })

  it('divides price by 100 when currency is GBp', async () => {
    mockCreateClient.mockResolvedValueOnce(
      makeSupabaseMock({ holdingRows: [{ id: '1', ticker: 'LLOY' }] })
    )
    mockQuote.mockResolvedValueOnce({
      regularMarketPrice: 4522,
      currency: 'GBp',
    })

    const result = await refreshHoldingPrices()

    expect(result.results).toBeDefined()
    const lloyResult = result.results!.find(r => r.ticker === 'LLOY')
    expect(lloyResult).toBeDefined()
    expect(lloyResult!.price).toBeCloseTo(45.22)
  })

  it('returns schema error message when update fails with code 42703', async () => {
    mockCreateClient.mockResolvedValueOnce(
      makeSupabaseMock({
        holdingRows: [{ id: '1', ticker: 'VWRL' }],
        updateError: { code: '42703', message: 'column not found' },
      })
    )
    mockQuote.mockResolvedValueOnce({
      regularMarketPrice: 114.22,
      currency: 'GBP',
    })

    const result = await refreshHoldingPrices()

    expect(result.error).toBeDefined()
    expect(result.error).toContain('Phase 8 migration')
  })

  it('skips invalid ticker format with price: null', async () => {
    mockCreateClient.mockResolvedValueOnce(
      makeSupabaseMock({ holdingRows: [{ id: '1', ticker: 'invalid ticker!' }] })
    )

    const result = await refreshHoldingPrices()

    expect(result.results).toBeDefined()
    expect(result.results![0]).toMatchObject({
      ticker: 'invalid ticker!',
      price: null,
      error: 'invalid ticker',
    })
    // yahoo-finance2 must NOT be called for invalid tickers
    expect(mockQuote).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Tests: fetchTickerPrices
// ---------------------------------------------------------------------------

describe('fetchTickerPrices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error when user is not authenticated', async () => {
    mockCreateClient.mockResolvedValueOnce(makeSupabaseMock({ user: null }))

    const result = await fetchTickerPrices(['VWRL'])

    expect(result.error).toBeTruthy()
    expect(result.error).toBe('Something went wrong. Please try again.')
  })

  it('returns error when tickers.length > 50', async () => {
    mockCreateClient.mockResolvedValueOnce(makeSupabaseMock())
    const tickers = Array.from({ length: 51 }, (_, i) => `T${i}`)

    const result = await fetchTickerPrices(tickers)

    expect(result.error).toBeTruthy()
    expect(mockQuote).not.toHaveBeenCalled()
  })

  it('returns prices map with fetched price', async () => {
    mockCreateClient.mockResolvedValueOnce(makeSupabaseMock())
    mockQuote.mockResolvedValueOnce({
      regularMarketPrice: 114.22,
      currency: 'GBP',
    })

    const result = await fetchTickerPrices(['VWRL'])

    expect(result.prices).toBeDefined()
    expect(result.prices!['VWRL']).toBeCloseTo(114.22)
  })

  it('returns null for tickers that fail', async () => {
    mockCreateClient.mockResolvedValueOnce(makeSupabaseMock())
    mockQuote.mockRejectedValueOnce(new Error('not found'))

    const result = await fetchTickerPrices(['FAIL'])

    expect(result.prices).toBeDefined()
    expect(result.prices!['FAIL']).toBeNull()
  })

  it('divides GBp price by 100', async () => {
    mockCreateClient.mockResolvedValueOnce(makeSupabaseMock())
    mockQuote.mockResolvedValueOnce({
      regularMarketPrice: 4522,
      currency: 'GBp',
    })

    const result = await fetchTickerPrices(['LLOY'])

    expect(result.prices).toBeDefined()
    expect(result.prices!['LLOY']).toBeCloseTo(45.22)
  })
})
