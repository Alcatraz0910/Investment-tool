/**
 * Contradiction detection for creator strategy profiles — Phase 14 redesign (D-06).
 *
 * runContradictionCheck(stable, latest):
 *   - Accepts two CreatorProfile objects (the 4-month stable snapshot and the 30-day latest).
 *   - If latest is null: no data to compare — returns no contradiction (D-07).
 *   - Check (a): a ticker that was 'high' conviction in stable is absent from latest favoured_stocks.
 *   - Check (b): a sector's stance flipped bullish ↔ cautious between stable and latest.
 *   - Mixed/unchanged → no contradiction.
 *
 * Pure function — no I/O, no side effects.
 */
import type { CreatorProfile } from '@/lib/strategy/extractor'

export interface ContradictionResult {
  hasContradiction: boolean
  reason: string | null
}

/**
 * Compare stable and latest CreatorProfile snapshots for contradictions.
 * Returns { hasContradiction: false, reason: null } when latest is null (D-07).
 */
export function runContradictionCheck(
  stable: CreatorProfile,
  latest: CreatorProfile | null,
): ContradictionResult {
  if (!latest) return { hasContradiction: false, reason: null }

  const reasons: string[] = []

  // Check (a): high-conviction stable ticker absent from latest favoured_stocks
  const latestTickers = new Set(
    (latest.favoured_stocks ?? [])
      .map((s) => s.ticker?.toUpperCase())
      .filter((t): t is string => t !== null && t !== undefined),
  )
  for (const stock of (stable.favoured_stocks ?? [])) {
    if (
      stock.conviction === 'high' &&
      stock.ticker !== null &&
      !latestTickers.has(stock.ticker.toUpperCase())
    ) {
      reasons.push(`${stock.ticker} was high conviction but absent from recent picks`)
    }
  }

  // Check (b): sector stance flipped bullish ↔ cautious (D-11: case-insensitive name match)
  const latestSectorMap = new Map(
    (latest.sector_focus ?? []).map((s) => [s.sector.toLowerCase(), s.stance]),
  )
  for (const sf of (stable.sector_focus ?? [])) {
    const latestStance = latestSectorMap.get(sf.sector.toLowerCase())
    if (!latestStance) continue  // unmatched sector — ignored per D-11
    if (
      (sf.stance === 'bullish' && latestStance === 'cautious') ||
      (sf.stance === 'cautious' && latestStance === 'bullish')
    ) {
      reasons.push(`${sf.sector}: ${sf.stance} → ${latestStance}`)
    }
  }

  if (reasons.length === 0) return { hasContradiction: false, reason: null }
  return { hasContradiction: true, reason: reasons.join('; ') }
}
