/**
 * Tests for runContradictionCheck() — Phase 14 redesign (D-06).
 * Pure function: no mocks needed.
 */
import { describe, it, expect } from 'vitest'
import { runContradictionCheck } from './contradiction'
import type { CreatorProfile } from './extractor'

function makeProfile(overrides: Partial<CreatorProfile> = {}): CreatorProfile {
  return {
    methodology: 'test',
    favoured_stocks: [],
    sector_focus: [],
    preferred_index_funds: [],
    confidence: 80,
    source_video_ids: [],
    ...overrides,
  }
}

describe('runContradictionCheck (Phase 14)', () => {
  it('returns hasContradiction=false when latest is null (D-07)', () => {
    const stable = makeProfile()
    const result = runContradictionCheck(stable, null)
    expect(result.hasContradiction).toBe(false)
    expect(result.reason).toBeNull()
  })

  it('returns hasContradiction=false when no high-conviction tickers are missing and no sector flips', () => {
    const stable = makeProfile({
      favoured_stocks: [{ ticker: 'AAPL', name: 'Apple', rationale: '', conviction: 'high' }],
      sector_focus: [{ sector: 'Tech', stance: 'bullish', rationale: '' }],
    })
    const latest = makeProfile({
      favoured_stocks: [{ ticker: 'AAPL', name: 'Apple', rationale: '', conviction: 'high' }],
      sector_focus: [{ sector: 'Tech', stance: 'bullish', rationale: '' }],
    })
    const result = runContradictionCheck(stable, latest)
    expect(result.hasContradiction).toBe(false)
    expect(result.reason).toBeNull()
  })

  it('flags high-conviction stable ticker absent from latest favoured_stocks', () => {
    const stable = makeProfile({
      favoured_stocks: [{ ticker: 'AAPL', name: 'Apple', rationale: '', conviction: 'high' }],
    })
    const latest = makeProfile({
      favoured_stocks: [{ ticker: 'MSFT', name: 'Microsoft', rationale: '', conviction: 'high' }],
    })
    const result = runContradictionCheck(stable, latest)
    expect(result.hasContradiction).toBe(true)
    expect(result.reason).toContain('AAPL')
  })

  it('does NOT flag medium/low conviction tickers absent from latest', () => {
    const stable = makeProfile({
      favoured_stocks: [
        { ticker: 'AAPL', name: 'Apple', rationale: '', conviction: 'medium' },
        { ticker: 'GOOG', name: 'Google', rationale: '', conviction: 'low' },
      ],
    })
    const latest = makeProfile({ favoured_stocks: [] })
    const result = runContradictionCheck(stable, latest)
    expect(result.hasContradiction).toBe(false)
  })

  it('flags sector stance flip bullish → cautious', () => {
    const stable = makeProfile({
      sector_focus: [{ sector: 'Energy', stance: 'bullish', rationale: '' }],
    })
    const latest = makeProfile({
      sector_focus: [{ sector: 'Energy', stance: 'cautious', rationale: '' }],
    })
    const result = runContradictionCheck(stable, latest)
    expect(result.hasContradiction).toBe(true)
    expect(result.reason).toContain('Energy')
  })

  it('flags sector stance flip cautious → bullish', () => {
    const stable = makeProfile({
      sector_focus: [{ sector: 'Tech', stance: 'cautious', rationale: '' }],
    })
    const latest = makeProfile({
      sector_focus: [{ sector: 'Tech', stance: 'bullish', rationale: '' }],
    })
    const result = runContradictionCheck(stable, latest)
    expect(result.hasContradiction).toBe(true)
  })

  it('does NOT flag neutral stance changes', () => {
    const stable = makeProfile({
      sector_focus: [{ sector: 'Tech', stance: 'bullish', rationale: '' }],
    })
    const latest = makeProfile({
      sector_focus: [{ sector: 'Tech', stance: 'neutral', rationale: '' }],
    })
    const result = runContradictionCheck(stable, latest)
    expect(result.hasContradiction).toBe(false)
  })

  it('sector name match is case-insensitive (D-11)', () => {
    const stable = makeProfile({
      sector_focus: [{ sector: 'Technology', stance: 'bullish', rationale: '' }],
    })
    const latest = makeProfile({
      sector_focus: [{ sector: 'technology', stance: 'cautious', rationale: '' }],
    })
    const result = runContradictionCheck(stable, latest)
    expect(result.hasContradiction).toBe(true)
  })

  it('unmatched sector in latest is ignored', () => {
    const stable = makeProfile({
      sector_focus: [{ sector: 'Energy', stance: 'bullish', rationale: '' }],
    })
    const latest = makeProfile({
      sector_focus: [{ sector: 'Healthcare', stance: 'cautious', rationale: '' }],
    })
    const result = runContradictionCheck(stable, latest)
    expect(result.hasContradiction).toBe(false)
  })

  it('reason string joins multiple issues with semicolon', () => {
    const stable = makeProfile({
      favoured_stocks: [{ ticker: 'AAPL', name: 'Apple', rationale: '', conviction: 'high' }],
      sector_focus: [{ sector: 'Tech', stance: 'bullish', rationale: '' }],
    })
    const latest = makeProfile({
      favoured_stocks: [],
      sector_focus: [{ sector: 'Tech', stance: 'cautious', rationale: '' }],
    })
    const result = runContradictionCheck(stable, latest)
    expect(result.hasContradiction).toBe(true)
    expect(result.reason).toContain(';')
  })
})
