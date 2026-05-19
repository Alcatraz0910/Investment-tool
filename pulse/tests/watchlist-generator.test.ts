import { describe, it, expect } from 'vitest'
import { Decimal } from 'decimal.js'

// buildWatchLists and calcShareQuantity are created in Wave 1 (12-02-PLAN.md)
// import { buildWatchLists, calcShareQuantity } from '@/lib/watchlist/generator'

describe('buildWatchLists', () => {
  it.todo('returns empty array when creators array is empty')
  it.todo('returns items from profile_stable.favoured_stocks when ticker is non-null')
  it.todo('returns items from profile_stable.preferred_index_funds when ticker is non-null')
  it.todo('includes items from profile_latest.favoured_stocks when profile_latest is non-null')
  it.todo('filters out favoured_stocks entries where ticker is null')
  it.todo('sets hasProfile=false when profileStable is null')
  it.todo('sorts items: high conviction before medium before low')
})

describe('calcShareQuantity', () => {
  it.todo('returns quantity=0 and remainder=budget when price is 0')
  it.todo('returns quantity=0 and remainder=budget when price is negative')
  it.todo('floors to whole shares — e.g. £500 / £47.23 = 10 shares')
  it.todo('calculates remainder correctly after floor division')
  it.todo('does not use native JS division — uses Decimal.div().floor()')
})
