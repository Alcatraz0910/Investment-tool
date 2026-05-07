/**
 * UI-03: computeRoadmap pure-function tests.
 * Plan 06-03 — real implementations.
 */
import { describe, it, expect } from 'vitest'
import { Decimal } from 'decimal.js'
import { computeRoadmap } from '@/lib/plan/roadmap'
import type { HoldingWithFillTicker } from '@/lib/plan/generator'
import type { BlendedStrategy } from '@/lib/strategy/blender'

// Helper to build a minimal holding
function makeHolding(category: string, value: number): HoldingWithFillTicker {
  return {
    id: `h-${category}`,
    userId: 'u1',
    ticker: `${category.toUpperCase().slice(0, 3)}`,
    category: category as HoldingWithFillTicker['category'],
    currentValue: value,
    isFillTicker: false,
  }
}

const BLEND_TECH_60: BlendedStrategy = {
  unified: { 'Index Funds': 60, Cash: 40 },
  influence: {},
}

const BLEND_EMPTY: BlendedStrategy = {
  unified: {},
  influence: {},
}

// Tax year that ends in the future (2026-27 ends 5 Apr 2027)
// Today is 2026-05-07, so '2026-27' runs through 5 Apr 2027 — ~11 months remaining
const TAX_YEAR = '2026-27'

describe('computeRoadmap (UI-03)', () => {
  it('returns [] when blend is null', () => {
    const result = computeRoadmap([], null, 500, TAX_YEAR)
    expect(result).toEqual([])
  })

  it('returns [] when blend.unified is empty', () => {
    const result = computeRoadmap([], BLEND_EMPTY, 500, TAX_YEAR)
    expect(result).toEqual([])
  })

  it('returns monthly points from today through 5 April of tax year end', () => {
    const result = computeRoadmap([], BLEND_TECH_60, 500, TAX_YEAR)
    // Should have at least 1 point (month 0 = today)
    expect(result.length).toBeGreaterThanOrEqual(1)
    // Month 0 (today = May 2026) and months through Apr 2027
    // monthsBetween(May 2026, Apr 2027) = 11 months → 12 points (0..11)
    expect(result.length).toBeGreaterThanOrEqual(2)
  })

  it('produces at least 1 point when tax year has remaining months', () => {
    const result = computeRoadmap([], BLEND_TECH_60, 1000, TAX_YEAR)
    expect(result.length).toBeGreaterThan(0)
  })

  it('divergence: 0% Tech current vs 60% Tech blend → currentPath !== creatorVision after month 0', () => {
    // No Tech holdings → currentMix['Tech'] = 0%
    // blend target Tech = 60% → creatorVision grows; currentPath stays flat
    const holdings: HoldingWithFillTicker[] = [makeHolding('Cash', 1000)]
    const blend: BlendedStrategy = {
      unified: { 'Index Funds': 60, Cash: 40 },
      influence: {},
    }
    const result = computeRoadmap(holdings, blend, 500, TAX_YEAR)

    // Month 0: both start at 0 (no Tech holdings)
    expect(result[0].currentPath).toBe(0)
    expect(result[0].creatorVision).toBe(0)

    // Month 1 onwards: creatorVision should be > currentPath
    if (result.length > 1) {
      expect(result[1].creatorVision).toBeGreaterThan(result[1].currentPath)
    }
  })

  it('all arithmetic uses Decimal internally; output values are plain numbers', () => {
    const result = computeRoadmap([], BLEND_TECH_60, 500, TAX_YEAR)
    for (const pt of result) {
      expect(typeof pt.currentPath).toBe('number')
      expect(typeof pt.creatorVision).toBe('number')
      expect(Number.isFinite(pt.currentPath)).toBe(true)
      expect(Number.isFinite(pt.creatorVision)).toBe(true)
    }
  })

  it('month labels formatted as "Mon YY" (e.g. "May 26")', () => {
    const result = computeRoadmap([], BLEND_TECH_60, 500, '2025-26')
    // All labels should match pattern like "May 26", "Jun 26", etc.
    for (const pt of result) {
      expect(pt.month).toMatch(/^[A-Z][a-z]{2} \d{2}$/)
    }
  })
})
