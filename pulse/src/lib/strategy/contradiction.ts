/**
 * Contradiction detection for creator strategy snapshots — Phase 4 (STRAT-04).
 *
 * runContradictionCheck(prev, next):
 *   - Compare two AllocationMap objects.
 *   - Flag categories where absolute delta exceeds THRESHOLD (15 percentage points).
 *   - If prev is null (first ever extraction): no contradiction.
 *   - Category in next but not prev: treat prev as 0.
 *   - Category in prev but not next: treat next as 0.
 *   - Category absent from both: skip.
 *
 * Pure function — no I/O, no side effects.
 * D-12: "auto-clear" is achieved by the newest INSERT row having has_contradiction=false
 * when all diffs are ≤15%. No old-row updates needed.
 */
import type { AllocationMap } from '@/types'

const THRESHOLD = 15  // percentage points — matches D-11 / STRAT-04

export interface ContradictionResult {
  hasContradiction: boolean
  note: string | null
  shifts: Array<{
    category: string
    from: number
    to: number
    delta: number   // signed: positive = increased, negative = decreased
  }>
}

/**
 * Compare prev and next AllocationMaps. Returns contradiction details.
 * Pass prev=null for the first extraction — always returns no contradiction.
 */
export function runContradictionCheck(
  prev: AllocationMap | null,
  next: AllocationMap,
): ContradictionResult {
  if (!prev) {
    return { hasContradiction: false, note: null, shifts: [] }
  }

  const allCategories = new Set([
    ...Object.keys(prev),
    ...Object.keys(next),
  ])

  const shifts: ContradictionResult['shifts'] = []

  for (const cat of allCategories) {
    const from = (prev as Record<string, number>)[cat] ?? 0
    const to = (next as Record<string, number>)[cat] ?? 0
    const delta = to - from

    if (Math.abs(delta) > THRESHOLD) {
      shifts.push({ category: cat, from, to, delta })
    }
  }

  if (shifts.length === 0) {
    return { hasContradiction: false, note: null, shifts: [] }
  }

  // Note format matches D-11 diff table: "Category: from% → to% (±delta%)"
  const noteLines = shifts.map(
    (s) =>
      `${s.category}: ${s.from}% → ${s.to}% (${s.delta > 0 ? '+' : ''}${s.delta}%)`,
  )

  return {
    hasContradiction: true,
    note: noteLines.join('; '),
    shifts,
  }
}
