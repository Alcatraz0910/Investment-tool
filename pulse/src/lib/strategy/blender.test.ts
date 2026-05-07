/**
 * Tests for blendStrategies() — BLEND-02, BLEND-03.
 * Pure function: no mocks needed.
 */
import { describe, it, expect } from 'vitest'
import { blendStrategies } from './blender'
import type { BlendInput } from './blender'
import type { UserCreator, CreatorStrategy } from '@/types'

function makeUserCreator(id: string, trustWeight: number): UserCreator {
  return {
    id: `uc-${id}`,
    userId: 'user-1',
    creatorId: id,
    trustWeight,
    lastRefreshedAt: null,
    createdAt: new Date(),
    categoryWeights: [],
  }
}

function makeStrategy(creatorId: string, allocation: Record<string, number>): CreatorStrategy {
  return {
    id: `strat-${creatorId}`,
    creatorId,
    allocation,
    confidence: 80,
    sourceVideoIds: [],
    hasContradiction: false,
    contradictionNote: null,
    extractedAt: new Date(),
    createdAt: new Date(),
  }
}

describe('blendStrategies (BLEND-02)', () => {
  it('single creator with 100% trust weight: unified equals creator allocation exactly', () => {
    const input: BlendInput = {
      creators: [
        {
          userCreator: makeUserCreator('c1', 100),
          latestStrategy: makeStrategy('c1', { 'Index Funds': 60, Stocks: 20 }),
        },
      ],
    }
    const result = blendStrategies(input)
    expect(result.unified['Index Funds']).toBeCloseTo(60)
    expect(result.unified.Stocks).toBeCloseTo(20)
  })

  it('two creators equal weight: unified is simple average of their allocations', () => {
    const input: BlendInput = {
      creators: [
        {
          userCreator: makeUserCreator('c1', 50),
          latestStrategy: makeStrategy('c1', { 'Index Funds': 60 }),
        },
        {
          userCreator: makeUserCreator('c2', 50),
          latestStrategy: makeStrategy('c2', { 'Index Funds': 40 }),
        },
      ],
    }
    const result = blendStrategies(input)
    // (60×50 + 40×50) / (50+50) = 5000/100 = 50
    expect(result.unified['Index Funds']).toBeCloseTo(50)
  })

  it('two creators unequal weight: unified is weighted average per REQUIREMENTS.md formula', () => {
    const input: BlendInput = {
      creators: [
        {
          userCreator: makeUserCreator('c1', 80),
          latestStrategy: makeStrategy('c1', { 'Index Funds': 60 }),
        },
        {
          userCreator: makeUserCreator('c2', 20),
          latestStrategy: makeStrategy('c2', { 'Index Funds': 20 }),
        },
      ],
    }
    const result = blendStrategies(input)
    // (60×80 + 20×20) / (80+20) = (4800+400)/100 = 52
    expect(result.unified['Index Funds']).toBeCloseTo(52)
  })

  it('creator with trustWeight=0 excluded from numerator and denominator', () => {
    const input: BlendInput = {
      creators: [
        {
          userCreator: makeUserCreator('c1', 100),
          latestStrategy: makeStrategy('c1', { 'Index Funds': 60 }),
        },
        {
          userCreator: makeUserCreator('c2', 0),
          latestStrategy: makeStrategy('c2', { 'Index Funds': 20 }),
        },
      ],
    }
    const result = blendStrategies(input)
    // c2 excluded (weight=0); result = 60×100/100 = 60
    expect(result.unified['Index Funds']).toBeCloseTo(60)
  })

  it('creator with latestStrategy=null excluded entirely from blend', () => {
    const input: BlendInput = {
      creators: [
        {
          userCreator: makeUserCreator('c1', 100),
          latestStrategy: makeStrategy('c1', { 'Index Funds': 60 }),
        },
        {
          userCreator: makeUserCreator('c2', 100),
          latestStrategy: null,
        },
      ],
    }
    const result = blendStrategies(input)
    expect(result.unified['Index Funds']).toBeCloseTo(60)
  })

  it('category absent from creator allocation: weight excluded from denominator (Open Q3)', () => {
    // c1 has Index Funds=60, c2 does NOT have Index Funds in allocation
    // Expected: Index Funds = 60×100/(100) = 60 (not 60×100/(100+100)=30)
    const input: BlendInput = {
      creators: [
        {
          userCreator: makeUserCreator('c1', 100),
          latestStrategy: makeStrategy('c1', { 'Index Funds': 60 }),
        },
        {
          userCreator: makeUserCreator('c2', 100),
          latestStrategy: makeStrategy('c2', { Stocks: 40 }),  // no Index Funds
        },
      ],
    }
    const result = blendStrategies(input)
    expect(result.unified['Index Funds']).toBeCloseTo(60)
  })

  it('all weights=0 for a category: category absent from unified output (no NaN)', () => {
    const input: BlendInput = {
      creators: [
        {
          userCreator: makeUserCreator('c1', 0),
          latestStrategy: makeStrategy('c1', { 'Index Funds': 60 }),
        },
      ],
    }
    const result = blendStrategies(input)
    expect(result.unified['Index Funds']).toBeUndefined()
    expect(Object.values(result.unified).every((v) => !Number.isNaN(v))).toBe(true)
  })
})

describe('blendStrategies influence (BLEND-03)', () => {
  it('influence values are numbers between 0 and 100', () => {
    const input: BlendInput = {
      creators: [
        {
          userCreator: makeUserCreator('c1', 60),
          latestStrategy: makeStrategy('c1', { 'Index Funds': 60 }),
        },
        {
          userCreator: makeUserCreator('c2', 40),
          latestStrategy: makeStrategy('c2', { 'Index Funds': 40 }),
        },
      ],
    }
    const result = blendStrategies(input)
    expect(result.influence['c1']).toBeGreaterThanOrEqual(0)
    expect(result.influence['c1']).toBeLessThanOrEqual(100)
    expect(result.influence['c2']).toBeGreaterThanOrEqual(0)
  })

  it('influence values sum to 100 (within floating point tolerance)', () => {
    const input: BlendInput = {
      creators: [
        {
          userCreator: makeUserCreator('c1', 60),
          latestStrategy: makeStrategy('c1', { 'Index Funds': 60 }),
        },
        {
          userCreator: makeUserCreator('c2', 40),
          latestStrategy: makeStrategy('c2', { 'Index Funds': 40 }),
        },
      ],
    }
    const result = blendStrategies(input)
    const sum = Object.values(result.influence).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(100, 5)
  })

  it('creator with latestStrategy=null has 0 influence', () => {
    const input: BlendInput = {
      creators: [
        {
          userCreator: makeUserCreator('c1', 100),
          latestStrategy: makeStrategy('c1', { 'Index Funds': 60 }),
        },
        {
          userCreator: makeUserCreator('c2', 100),
          latestStrategy: null,
        },
      ],
    }
    const result = blendStrategies(input)
    expect(result.influence['c2']).toBeUndefined()  // excluded from influence map entirely
  })

  it('creator with trustWeight=0 on all categories has 0 influence', () => {
    const input: BlendInput = {
      creators: [
        {
          userCreator: makeUserCreator('c1', 100),
          latestStrategy: makeStrategy('c1', { 'Index Funds': 60 }),
        },
        {
          userCreator: makeUserCreator('c2', 0),
          latestStrategy: makeStrategy('c2', { 'Index Funds': 40 }),
        },
      ],
    }
    const result = blendStrategies(input)
    expect(result.influence['c2']).toBeCloseTo(0)
  })
})
