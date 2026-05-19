import { describe, it, expect } from 'vitest'
import { Decimal } from 'decimal.js'
import { buildWatchLists, calcShareQuantity } from '@/lib/watchlist/generator'
import type { CreatorWatchList } from '@/lib/watchlist/generator'

const makeCreator = (overrides: Partial<Parameters<typeof buildWatchLists>[0][0]> = {}) => ({
  creatorId: 'c1',
  creatorName: 'Test Creator',
  monthlyBudgetGbp: 500,
  profileStable: null,
  profileLatest: null,
  ...overrides,
})

const stableProfile = {
  methodology: 'Buy and hold',
  favoured_stocks: [
    { ticker: 'AAPL', name: 'Apple', rationale: 'Core holding', conviction: 'high' as const },
    { ticker: null, name: 'Unknown Co', rationale: 'Mentioned', conviction: 'low' as const },
  ],
  sector_focus: [],
  preferred_index_funds: [
    { ticker: 'VWRL', name: 'Vanguard All-World', rationale: 'Index core' },
  ],
  confidence: 80,
  source_video_ids: ['vid1'],
}

const latestProfile = {
  methodology: 'Recent focus',
  favoured_stocks: [
    { ticker: 'MSFT', name: 'Microsoft', rationale: 'New pick', conviction: 'medium' as const },
  ],
  sector_focus: [],
  preferred_index_funds: [],
  confidence: 70,
  source_video_ids: ['vid2'],
}

describe('buildWatchLists', () => {
  it('returns empty array when creators array is empty', () => {
    expect(buildWatchLists([])).toEqual([])
  })

  it('returns items from profile_stable.favoured_stocks when ticker is non-null', () => {
    const result = buildWatchLists([makeCreator({ profileStable: stableProfile })])
    const tickers = result[0].items.map((i) => i.ticker)
    expect(tickers).toContain('AAPL')
  })

  it('returns items from profile_stable.preferred_index_funds when ticker is non-null', () => {
    const result = buildWatchLists([makeCreator({ profileStable: stableProfile })])
    const tickers = result[0].items.map((i) => i.ticker)
    expect(tickers).toContain('VWRL')
  })

  it('includes items from profile_latest.favoured_stocks when profile_latest is non-null', () => {
    const result = buildWatchLists([
      makeCreator({ profileStable: stableProfile, profileLatest: latestProfile }),
    ])
    const tickers = result[0].items.map((i) => i.ticker)
    expect(tickers).toContain('MSFT')
  })

  it('deduplicates tickers across stable and latest — latest wins', () => {
    const overlapLatest = {
      ...latestProfile,
      favoured_stocks: [
        { ticker: 'AAPL', name: 'Apple', rationale: 'Latest mention', conviction: 'high' as const },
      ],
    }
    const result = buildWatchLists([
      makeCreator({ profileStable: stableProfile, profileLatest: overlapLatest }),
    ])
    const aaplItems = result[0].items.filter((i) => i.ticker === 'AAPL')
    expect(aaplItems).toHaveLength(1)
    expect(aaplItems[0].layer).toBe('latest')
  })

  it('filters out favoured_stocks entries where ticker is null', () => {
    const result = buildWatchLists([makeCreator({ profileStable: stableProfile })])
    const tickers = result[0].items.map((i) => i.ticker)
    expect(tickers).not.toContain(null)
    // 'Unknown Co' has ticker=null — should not appear
    expect(result[0].items.every((i) => i.ticker !== null)).toBe(true)
  })

  it('sets hasProfile=false when profileStable is null', () => {
    const result = buildWatchLists([makeCreator()])
    expect(result[0].hasProfile).toBe(false)
    expect(result[0].items).toEqual([])
  })

  it('sorts items: high conviction before medium before low', () => {
    const profileWithMixed = {
      ...stableProfile,
      favoured_stocks: [
        { ticker: 'LOW1', name: 'Low', rationale: '', conviction: 'low' as const },
        { ticker: 'HIGH1', name: 'High', rationale: '', conviction: 'high' as const },
        { ticker: 'MED1', name: 'Med', rationale: '', conviction: 'medium' as const },
      ],
      preferred_index_funds: [],
    }
    const result = buildWatchLists([makeCreator({ profileStable: profileWithMixed })])
    const convictions = result[0].items.map((i) => i.conviction)
    expect(convictions[0]).toBe('high')
    expect(convictions[1]).toBe('medium')
    expect(convictions[2]).toBe('low')
  })
})

describe('calcShareQuantity', () => {
  it('returns quantity=0 and remainder=budget when price is 0', () => {
    const budget = new Decimal(500)
    const result = calcShareQuantity(budget, new Decimal(0))
    expect(result.quantity.toNumber()).toBe(0)
    expect(result.remainder.toNumber()).toBe(500)
  })

  it('returns quantity=0 and remainder=budget when price is negative', () => {
    const budget = new Decimal(500)
    const result = calcShareQuantity(budget, new Decimal(-10))
    expect(result.quantity.toNumber()).toBe(0)
    expect(result.remainder.toNumber()).toBe(500)
  })

  it('floors to whole shares — e.g. £500 / £47.23 = 10 shares', () => {
    const result = calcShareQuantity(new Decimal(500), new Decimal(47.23))
    expect(result.quantity.toNumber()).toBe(10)
  })

  it('calculates remainder correctly after floor division', () => {
    // 10 * 47.23 = 472.30 → remainder = 500 - 472.30 = 27.70
    const result = calcShareQuantity(new Decimal(500), new Decimal(47.23))
    expect(result.spent.toNumber()).toBe(472.3)
    expect(result.remainder.toNumber()).toBe(27.7)
  })

  it('does not use native JS division — uses Decimal.div().floor()', () => {
    // Verify result uses Decimal instances
    const result = calcShareQuantity(new Decimal(500), new Decimal(47.23))
    expect(result.quantity).toBeInstanceOf(Decimal)
    expect(result.spent).toBeInstanceOf(Decimal)
    expect(result.remainder).toBeInstanceOf(Decimal)
  })
})
