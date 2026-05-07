/**
 * Tests for runContradictionCheck() — STRAT-04.
 * Pure function: no mocks needed.
 */
import { describe, it, expect } from 'vitest'
import { runContradictionCheck } from './contradiction'
import type { AllocationMap } from '@/types'

describe('runContradictionCheck (STRAT-04)', () => {
  it('returns hasContradiction=false when prev is null (first extraction)', () => {
    const next: AllocationMap = { 'Index Funds': 60, Stocks: 20 }
    const result = runContradictionCheck(null, next)
    expect(result.hasContradiction).toBe(false)
    expect(result.note).toBeNull()
    expect(result.shifts).toHaveLength(0)
  })

  it('returns hasContradiction=false when all category deltas are ≤15%', () => {
    const prev: AllocationMap = { 'Index Funds': 40, Stocks: 30 }
    const next: AllocationMap = { 'Index Funds': 50, Stocks: 25 }  // deltas: +10, -5
    const result = runContradictionCheck(prev, next)
    expect(result.hasContradiction).toBe(false)
  })

  it('returns hasContradiction=true when a category delta exceeds 15%', () => {
    const prev: AllocationMap = { 'Index Funds': 40, Stocks: 30 }
    const next: AllocationMap = { 'Index Funds': 66, Stocks: 30 }  // Index Funds delta = +26
    const result = runContradictionCheck(prev, next)
    expect(result.hasContradiction).toBe(true)
  })

  it('flags Index Funds: 40 → 66 as contradiction (delta=26)', () => {
    const prev: AllocationMap = { 'Index Funds': 40 }
    const next: AllocationMap = { 'Index Funds': 66 }
    const result = runContradictionCheck(prev, next)
    expect(result.shifts).toHaveLength(1)
    expect(result.shifts[0]).toMatchObject({ category: 'Index Funds', from: 40, to: 66, delta: 26 })
  })

  it('does not flag Index Funds: 40 → 55 as contradiction (delta=15, at boundary — not exceeds)', () => {
    const prev: AllocationMap = { 'Index Funds': 40 }
    const next: AllocationMap = { 'Index Funds': 55 }
    const result = runContradictionCheck(prev, next)
    expect(result.hasContradiction).toBe(false)
  })

  it('flags category in next but not prev: treats prev as 0', () => {
    const prev: AllocationMap = {}
    const next: AllocationMap = { 'Index Funds': 60 }  // delta = 60, exceeds 15
    const result = runContradictionCheck(prev, next)
    expect(result.hasContradiction).toBe(true)
    expect(result.shifts[0]).toMatchObject({ category: 'Index Funds', from: 0, to: 60 })
  })

  it('flags category in prev but not next: treats next as 0', () => {
    const prev: AllocationMap = { 'Index Funds': 60 }
    const next: AllocationMap = {}  // delta = -60, exceeds 15
    const result = runContradictionCheck(prev, next)
    expect(result.hasContradiction).toBe(true)
    expect(result.shifts[0]).toMatchObject({ category: 'Index Funds', from: 60, to: 0, delta: -60 })
  })

  it('note string lists flagged categories in "cat: from% → to% (±delta%)" format', () => {
    const prev: AllocationMap = { 'Index Funds': 40 }
    const next: AllocationMap = { 'Index Funds': 66 }
    const result = runContradictionCheck(prev, next)
    expect(result.note).toContain('Index Funds: 40% → 66% (+26%)')
  })

  it('shifts array contains all flagged category objects', () => {
    const prev: AllocationMap = { 'Index Funds': 40, Stocks: 30 }
    const next: AllocationMap = { 'Index Funds': 66, Stocks: 5 }  // both exceed 15
    const result = runContradictionCheck(prev, next)
    expect(result.shifts).toHaveLength(2)
  })
})
