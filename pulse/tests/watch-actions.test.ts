import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('next/headers', () => ({ cookies: vi.fn() }))

// fetchTickerPrices is already in actions.ts (Phase 8) — tests here verify
// the WatchListTab integration pattern (prices keyed by ticker, GBp→GBP done server-side)

describe('watch-actions — fetchTickerPrices integration', () => {
  it.todo('returns a Record<string, number> keyed by ticker')
  it.todo('prices are in £ (GBp already divided by 100 server-side)')
  it.todo('missing tickers return undefined (not null, not 0)')
})
