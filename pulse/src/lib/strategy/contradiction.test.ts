/**
 * Tests for runContradictionCheck() — covers STRAT-04.
 * Pure function: no mocks needed.
 * Wave 0: stubs only. Wave 1 (plan 04-03) fills in implementations.
 */
import { describe, it } from 'vitest'

describe('runContradictionCheck (STRAT-04)', () => {
  it.todo('returns hasContradiction=false when prev is null (first extraction)')
  it.todo('returns hasContradiction=false when all category deltas are ≤15%')
  it.todo('returns hasContradiction=true when any category delta exceeds 15%')
  it.todo('flags Tech: 40 → 66 as contradiction (delta = 26)')
  it.todo('does not flag Tech: 40 → 55 as contradiction (delta = 15, boundary)')
  it.todo('flags category in new but not old: treats old as 0 (delta = new value)')
  it.todo('flags category in old but not new: treats new as 0 (delta = old value)')
  it.todo('note string lists flagged categories in "cat: from% → to% (±delta%)" format')
  it.todo('shifts array contains all flagged category objects')
})
