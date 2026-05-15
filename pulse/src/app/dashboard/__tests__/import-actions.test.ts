/**
 * Auth-guard and validation tests for importHoldings.
 * Full integration (Supabase round-trip) is validated manually via smoke test in Plan 07-04.
 *
 * Uses vitest (project standard) with vi.hoisted() pattern from actions.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mock refs
// ---------------------------------------------------------------------------

const { mockCreateClient } = vi.hoisted(() => {
  const mockCreateClient = vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
      }),
    },
  })
  return { mockCreateClient }
})

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

import { importHoldings } from '../actions'

describe('importHoldings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error when user is not authenticated', async () => {
    mockCreateClient.mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    })

    const result = await importHoldings(
      [{ ticker: 'AAPL', name: '', quantity: '10', value: '150.00', category: 'Stocks' }],
      'merge'
    )

    expect(result.error).toBe('Something went wrong. Please try again.')
  })

  it('returns error when validRows is empty', async () => {
    mockCreateClient.mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      },
    })

    const result = await importHoldings([], 'replace')

    expect(result.error).toBe('No valid rows to import.')
  })

  it('returns error when rows have empty tickers', async () => {
    mockCreateClient.mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      },
    })

    const result = await importHoldings(
      [{ ticker: '', name: '', quantity: '10', value: '100.00', category: 'Stocks' }],
      'replace'
    )

    expect(result.error).toBe('No valid rows to import.')
  })
})
