/**
 * roadmap.ts — Phase 6 (UI-03, D-07/D-08).
 *
 * Pure function: compute monthly trajectory points for Roadmap View.
 *
 * Divergence strategy: plot the LARGEST allocation-gap category's cumulative
 * contribution value under current-mix vs target-mix regimes.
 *   currentPath[i]   = holdingsInGapCat + budget * currentMix% * i
 *   creatorVision[i] = holdingsInGapCat + budget * targetMix%  * i
 *
 * Both lines start at the same value (month 0). Divergence is visible when
 * currentMix% != targetMix% for the chosen category.
 *
 * Y-axis label: "£ in {category name}"
 *
 * All arithmetic uses Decimal; convert to number only at RoadmapPoint boundary.
 * CLAUDE.md: decimal.js mandatory for £ arithmetic.
 */
import { Decimal } from 'decimal.js'
import type { HoldingWithFillTicker } from '@/lib/plan/generator'
import type { BlendedStrategy } from '@/lib/strategy/blender'

export interface RoadmapPoint {
  month: string         // 'May 26', 'Jun 26', etc.
  currentPath: number   // £ in largest-gap category — current contribution regime
  creatorVision: number // £ in largest-gap category — target contribution regime
}

/**
 * Compute monthly trajectory from today through 5 April of the given tax year's end.
 *
 * @param holdings   User's current portfolio holdings (currentValue: Decimal)
 * @param blend      Blended strategy from blendStrategies()
 * @param monthlyBudgetGbp  Monthly contribution amount (plain number from slider)
 * @param taxYear    Current tax year string e.g. '2025-26'
 * @returns          Array of RoadmapPoint for each month (index 0 = today's month)
 */
export function computeRoadmap(
  holdings: HoldingWithFillTicker[],
  blend: BlendedStrategy | null,
  monthlyBudgetGbp: number,
  taxYear: string,
): RoadmapPoint[] {
  if (!blend || Object.keys(blend.unified).length === 0) return []

  const budget = new Decimal(monthlyBudgetGbp)

  // Compute total portfolio value
  const totalPortfolioValue = holdings.reduce(
    (sum, h) => sum.plus(h.currentValue),
    new Decimal(0),
  )

  // Compute per-category current values
  const categoryValues: Record<string, Decimal> = {}
  for (const h of holdings) {
    categoryValues[h.category] = (categoryValues[h.category] ?? new Decimal(0)).plus(h.currentValue)
  }

  // Compute current allocation mix (%) per category
  const currentMix: Record<string, Decimal> = {}
  if (totalPortfolioValue.gt(0)) {
    for (const [cat, val] of Object.entries(categoryValues)) {
      currentMix[cat] = val.div(totalPortfolioValue).mul(100)
    }
  }

  // Find largest-gap category: max(targetPct - currentPct) across blend.unified
  let gapCategory = ''
  let maxGap = new Decimal(-Infinity)

  for (const [cat, targetPct] of Object.entries(blend.unified)) {
    const currentPct = currentMix[cat] ?? new Decimal(0)
    const gap = new Decimal(targetPct ?? 0).minus(currentPct)
    if (gap.gt(maxGap)) {
      maxGap = gap
      gapCategory = cat
    }
  }

  // If no positive gap found, use the first category
  if (!gapCategory || maxGap.lte(0)) {
    gapCategory = Object.keys(blend.unified)[0]
  }

  const targetPctForCat = new Decimal(blend.unified[gapCategory] ?? 0).div(100)
  const currentPctForCat = (currentMix[gapCategory] ?? new Decimal(0)).div(100)
  const holdingsInGapCat = categoryValues[gapCategory] ?? new Decimal(0)

  // Compute months from today through 5 April of tax year end
  const [, endSuffix] = taxYear.split('-')
  const endYear = 2000 + parseInt(endSuffix, 10)
  const endDate = new Date(Date.UTC(endYear, 3, 5))  // 5 April (month index 3)
  const today = new Date()
  const monthCount = Math.max(0, monthsBetween(today, endDate))

  const points: RoadmapPoint[] = []

  for (let i = 0; i <= monthCount; i++) {
    const cumulative = budget.mul(i)
    const currentPath = holdingsInGapCat.plus(cumulative.mul(currentPctForCat))
    const creatorVision = holdingsInGapCat.plus(cumulative.mul(targetPctForCat))

    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + i, 1))
    points.push({
      month: date.toLocaleString('en-GB', { month: 'short', year: '2-digit' }),
      currentPath: currentPath.toDecimalPlaces(2).toNumber(),
      creatorVision: creatorVision.toDecimalPlaces(2).toNumber(),
    })
  }

  return points
}

/**
 * Returns the name of the largest-gap category for chart labelling.
 * Exported so RoadmapView can display it as the Y-axis label.
 */
export function getLargestGapCategory(
  holdings: HoldingWithFillTicker[],
  blend: BlendedStrategy,
): string {
  if (Object.keys(blend.unified).length === 0) return ''

  const totalPortfolioValue = holdings.reduce(
    (sum, h) => sum.plus(h.currentValue),
    new Decimal(0),
  )

  const categoryValues: Record<string, Decimal> = {}
  for (const h of holdings) {
    categoryValues[h.category] = (categoryValues[h.category] ?? new Decimal(0)).plus(h.currentValue)
  }

  const currentMix: Record<string, Decimal> = {}
  if (totalPortfolioValue.gt(0)) {
    for (const [cat, val] of Object.entries(categoryValues)) {
      currentMix[cat] = val.div(totalPortfolioValue).mul(100)
    }
  }

  let gapCategory = Object.keys(blend.unified)[0]
  let maxGap = new Decimal(-Infinity)

  for (const [cat, targetPct] of Object.entries(blend.unified)) {
    const currentPct = currentMix[cat] ?? new Decimal(0)
    const gap = new Decimal(targetPct ?? 0).minus(currentPct)
    if (gap.gt(maxGap)) {
      maxGap = gap
      gapCategory = cat
    }
  }

  return gapCategory
}

/**
 * Returns the number of whole months from date a to date b (b - a).
 * Uses UTC month arithmetic to avoid DST issues.
 */
function monthsBetween(a: Date, b: Date): number {
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12
       + (b.getUTCMonth() - a.getUTCMonth())
}
