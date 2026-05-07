/**
 * Contradiction checker for creator strategy extraction — Phase 4 (STRAT-04).
 * Full implementation in plan 04-03. This stub satisfies the extractor.ts import.
 *
 * runContradictionCheck(prev, next):
 *   Compares two AllocationMap snapshots. Returns hasContradiction=true if any
 *   category shifts by more than 15 percentage points vs. the prior extraction.
 *   Returns hasContradiction=false if prev is null (first extraction).
 */
import type { AllocationMap } from '@/types'

export interface ContradictionResult {
  hasContradiction: boolean
  note: string | null
}

/**
 * Detect significant allocation shifts between two strategy snapshots.
 * Threshold: >15 percentage points change in any single category.
 * If prevAllocation is null (first extraction), always returns hasContradiction=false.
 */
export function runContradictionCheck(
  prevAllocation: AllocationMap | null,
  nextAllocation: AllocationMap,
): ContradictionResult {
  if (prevAllocation === null) {
    return { hasContradiction: false, note: null }
  }

  const THRESHOLD = 15
  const allCategories = new Set([
    ...Object.keys(prevAllocation),
    ...Object.keys(nextAllocation),
  ])

  const shifts: string[] = []

  for (const cat of allCategories) {
    const prev = (prevAllocation as Record<string, number>)[cat] ?? 0
    const next = (nextAllocation as Record<string, number>)[cat] ?? 0
    const delta = Math.abs(next - prev)
    if (delta > THRESHOLD) {
      const sign = next > prev ? '+' : '-'
      shifts.push(`${cat}: ${prev}% → ${next}% (${sign}${delta}%)`)
    }
  }

  if (shifts.length === 0) {
    return { hasContradiction: false, note: null }
  }

  return {
    hasContradiction: true,
    note: `Significant allocation shifts detected: ${shifts.join(', ')}`,
  }
}
