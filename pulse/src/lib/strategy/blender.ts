/**
 * StrategyBlender — Phase 4 (BLEND-02, BLEND-03).
 *
 * blendStrategies(input): BlendedStrategy
 *   Formula (REQUIREMENTS.md BLEND-02):
 *     unified[cat] = Σ(allocation_i[cat] × weight_i[cat]) / Σ(weight_i[cat])
 *
 *   Open Question 3 resolution:
 *     When creator has no allocation for a category, exclude their weight from
 *     BOTH numerator AND denominator for that category. This avoids diluting
 *     the allocation toward 0 for categories the creator never discussed.
 *
 *   Edge cases:
 *     - Creator with latestStrategy=null: excluded entirely.
 *     - Creator with weight=0 for a category: skip (contribute nothing).
 *     - denominator=0 for a category: omit category from unified output.
 *
 * Pure function — no I/O.
 * Note: output is plain number (not Decimal). Phase 5 PlanGenerator wraps in
 * new Decimal() on use. Do not pre-convert here (RESEARCH Anti-patterns).
 */
import type { AllocationMap, AssetCategory, UserCreator, UserCreatorCategoryWeight, CreatorStrategy } from '@/types'

// The 8 standard asset categories (matches AssetCategory type and DB CHECK constraint)
const CATEGORIES: AssetCategory[] = [
  'Tech',
  'Dividends',
  'Bonds',
  'Commodities',
  'Cash',
  'Emerging Markets',
  'Small Cap',
  'REITs',
]

export interface BlendedStrategy {
  /** Weighted average allocation across all tracked creators with strategies */
  unified: AllocationMap
  /** Per-creator influence as a percentage (0–100). Sums to 100 when all have strategies. */
  influence: Record<string, number>  // creatorId → influence %
}

export interface BlendInput {
  creators: Array<{
    userCreator: UserCreator          // has trustWeight + optional categoryWeights[]
    latestStrategy: CreatorStrategy | null
  }>
}

/**
 * Resolve the effective weight for a given (userCreator, category) pair.
 * Per-category override takes precedence over global trust weight.
 */
function resolveWeight(
  userCreator: UserCreator,
  category: AssetCategory,
): number {
  const override = userCreator.categoryWeights?.find((w: UserCreatorCategoryWeight) => w.category === category)
  return override !== undefined ? override.weight : userCreator.trustWeight
}

export function blendStrategies(input: BlendInput): BlendedStrategy {
  const unified: AllocationMap = {}

  // --- Compute unified allocation per category ---
  for (const cat of CATEGORIES) {
    let numerator = 0
    let denominator = 0

    for (const { userCreator, latestStrategy } of input.creators) {
      // Exclude creators with no strategy snapshot
      if (!latestStrategy) continue

      const weight = resolveWeight(userCreator, cat)

      // Exclude zero-weight creators
      if (weight === 0) continue

      const allocationPct = latestStrategy.allocation[cat]

      // Open Question 3 resolution: if creator has no allocation for this category,
      // exclude their weight from BOTH numerator AND denominator.
      // Do NOT default to 0 — that would dilute the allocation for uncovered categories.
      if (allocationPct === undefined) continue

      numerator += allocationPct * weight
      denominator += weight
    }

    // Guard: denominator=0 means no weighted creators cover this category → omit
    if (denominator > 0) {
      unified[cat] = numerator / denominator
    }
  }

  // --- Compute per-creator influence % (BLEND-03) ---
  // Influence = sum of effective weights across all categories / total weight sum × 100
  const rawScores: Record<string, number> = {}
  let totalScore = 0

  for (const { userCreator, latestStrategy } of input.creators) {
    if (!latestStrategy) continue

    let score = 0
    for (const cat of CATEGORIES) {
      score += resolveWeight(userCreator, cat)
    }
    rawScores[userCreator.creatorId] = score
    totalScore += score
  }

  const influence: Record<string, number> = {}
  for (const [creatorId, score] of Object.entries(rawScores)) {
    influence[creatorId] = totalScore > 0 ? (score / totalScore) * 100 : 0
  }

  return { unified, influence }
}
