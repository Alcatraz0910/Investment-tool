/**
 * Tests for blendStrategies() — covers BLEND-02, BLEND-03.
 * Pure function: no mocks needed.
 * Wave 0: stubs only. Wave 1 (plan 04-03) fills in implementations.
 */
import { describe, it } from 'vitest'

describe('blendStrategies (BLEND-02)', () => {
  it.todo('single creator with 100% trust weight: unified = creator allocation exactly')
  it.todo('two creators equal weight: unified = simple average of their allocations')
  it.todo('two creators unequal weight: unified = weighted average per formula from REQUIREMENTS.md')
  it.todo('creator with trustWeight=0 excluded from numerator and denominator')
  it.todo('creator with latestStrategy=null excluded entirely from blend')
  it.todo('category absent from creator allocation: weight excluded from denominator for that category (D-Open-Q3)')
  it.todo('all weights=0 for a category: category absent from unified output (no divide-by-zero)')
})

describe('blendStrategies influence (BLEND-03)', () => {
  it.todo('influence values are all numbers between 0 and 100')
  it.todo('influence values sum to 100 (within floating point tolerance) when all creators have strategies')
  it.todo('creator with latestStrategy=null has 0 influence')
  it.todo('creator with trustWeight=0 on all categories has 0 influence')
})
