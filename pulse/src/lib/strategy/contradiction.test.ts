/**
 * Tests for runContradictionCheck() — STRAT-04.
 * Pure function: no mocks needed.
 */
import { describe, it, expect } from 'vitest'
import { runContradictionCheck } from './contradiction'
import type { AllocationMap } from '@/types'

describe('runContradictionCheck (STRAT-04)', () => {
  it('returns hasContradiction=false when prev is null (first extraction)', () => {
    const next: AllocationMap = { Tech: 60, Dividends: 20 }
    const result = runContradictionCheck(null, next)
    expect(result.hasContradiction).toBe(false)
    expect(result.note).toBeNull()
    expect(result.shifts).toHaveLength(0)
  })

  it('returns hasContradiction=false when all category deltas are ≤15%', () => {
    const prev: AllocationMap = { Tech: 40, Dividends: 30 }
    const next: AllocationMap = { Tech: 50, Dividends: 25 }  // deltas: +10, -5
    const result = runContradictionCheck(prev, next)
    expect(result.hasContradiction).toBe(false)
  })

  it('returns hasContradiction=true when a category delta exceeds 15%', () => {
    const prev: AllocationMap = { Tech: 40, Dividends: 30 }
    const next: AllocationMap = { Tech: 66, Dividends: 30 }  // Tech delta = +26
    const result = runContradictionCheck(prev, next)
    expect(result.hasContradiction).toBe(true)
  })

  it('flags Tech: 40 → 66 as contradiction (delta=26)', () => {
    const prev: AllocationMap = { Tech: 40 }
    const next: AllocationMap = { Tech: 66 }
    const result = runContradictionCheck(prev, next)
    expect(result.shifts).toHaveLength(1)
    expect(result.shifts[0]).toMatchObject({ category: 'Tech', from: 40, to: 66, delta: 26 })
  })

  it('does not flag Tech: 40 → 55 as contradiction (delta=15, at boundary — not exceeds)', () => {
    const prev: AllocationMap = { Tech: 40 }
    const next: AllocationMap = { Tech: 55 }
    const result = runContradictionCheck(prev, next)
    expect(result.hasContradiction).toBe(false)
  })

  it('flags category in next but not prev: treats prev as 0', () => {
    const prev: AllocationMap = {}
    const next: AllocationMap = { Tech: 60 }  // delta = 60, exceeds 15
    const result = runContradictionCheck(prev, next)
    expect(result.hasContradiction).toBe(true)
    expect(result.shifts[0]).toMatchObject({ category: 'Tech', from: 0, to: 60 })
  })

  it('flags category in prev but not next: treats next as 0', () => {
    const prev: AllocationMap = { Tech: 60 }
    const next: AllocationMap = {}  // delta = -60, exceeds 15
    const result = runContradictionCheck(prev, next)
    expect(result.hasContradiction).toBe(true)
    expect(result.shifts[0]).toMatchObject({ category: 'Tech', from: 60, to: 0, delta: -60 })
  })

  it('note string lists flagged categories in "cat: from% → to% (±delta%)" format', () => {
    const prev: AllocationMap = { Tech: 40 }
    const next: AllocationMap = { Tech: 66 }
    const result = runContradictionCheck(prev, next)
    expect(result.note).toContain('Tech: 40% → 66% (+26%)')
  })

  it('shifts array contains all flagged category objects', () => {
    const prev: AllocationMap = { Tech: 40, Dividends: 30 }
    const next: AllocationMap = { Tech: 66, Dividends: 5 }  // both exceed 15
    const result = runContradictionCheck(prev, next)
    expect(result.shifts).toHaveLength(2)
  })
})
