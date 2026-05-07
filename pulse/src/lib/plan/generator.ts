/**
 * generator.ts — ISA-capped Buy List generator (PLAN-01 … PLAN-04, ISA-02)
 *
 * Pure function — zero server-only imports.
 * All £ arithmetic uses Decimal (decimal.js). No native JS floats for money.
 *
 * CRITICAL: Must not import next/headers, @/lib/supabase/*, or any server module.
 */
import { Decimal } from 'decimal.js'
import type { AssetCategory } from '@/types'
import type { BlendedStrategy } from '@/lib/strategy/blender'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Subset of Holding required by the generator.
 * (Holding already has isFillTicker from 05-01 — this type is interchangeable.)
 */
export type HoldingWithFillTicker = {
  id: string
  userId: string
  ticker: string
  category: AssetCategory
  currentValue: Decimal
  isFillTicker: boolean
}

export interface BuyListItem {
  ticker: string
  category: AssetCategory
  amountGbp: Decimal
  allocationGapPct: number  // % of category gap before this purchase
  rationale: string         // informational only — MUST NOT contain "advice"/"recommend"/"suggest"
}

export interface GapRow {
  category: AssetCategory
  targetPct: number
  currentPct: number
  gapPct: number
  reason: 'no-holdings' | 'no-fill-ticker'
}

export type PlanResult =
  | { type: 'no-strategy' }
  | { type: 'no-fill-tickers'; gapRows: GapRow[] }
  | { type: 'buy-list'; items: BuyListItem[]; gapRows: GapRow[]; isaWarning: boolean; effectiveBudget: Decimal }

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

interface PendingItem {
  category: AssetCategory
  gap: Decimal
  fillTicker: string
}

// ---------------------------------------------------------------------------
// generatePlan
// ---------------------------------------------------------------------------

/**
 * Compute a monthly ISA buy list from current holdings and a blended strategy.
 *
 * @param holdings       Current portfolio positions with isFillTicker flags
 * @param budgetGbp      Desired monthly contribution in £ (plain number)
 * @param strategy       Blended creator strategy (or null if none)
 * @param isaRemaining   Remaining ISA allowance for current tax year in £
 * @returns              PlanResult discriminated union
 */
export function generatePlan(
  holdings: HoldingWithFillTicker[],
  budgetGbp: number,
  strategy: BlendedStrategy | null,
  isaRemaining: number,
): PlanResult {
  // --- 1. Guard: no strategy ---
  if (!strategy || Object.keys(strategy.unified).length === 0) {
    return { type: 'no-strategy' }
  }

  // --- 2. Decimal wrapping ---
  const budget = new Decimal(budgetGbp)
  const isaRem = new Decimal(isaRemaining)

  // --- 3. Effective budget (ISA-02) ---
  const effectiveBudget = Decimal.min(budget, isaRem)
  const isaWarning = budget.greaterThan(isaRem)

  // --- 4. Portfolio totals ---
  const portfolioTotal = holdings.reduce(
    (sum, h) => sum.plus(h.currentValue),
    new Decimal(0),
  )
  const totalAfter = portfolioTotal.plus(effectiveBudget)

  // --- 5. Process each category in strategy ---
  const gapRows: GapRow[] = []
  const pendingItems: PendingItem[] = []

  for (const [cat, targetPctRaw] of Object.entries(strategy.unified) as [AssetCategory, number][]) {
    if (!targetPctRaw || targetPctRaw <= 0) continue

    const targetPct = targetPctRaw
    const targetValue = totalAfter.mul(new Decimal(targetPct)).div(100)

    // Sum current holdings in this category
    const categoryHoldings = holdings.filter(h => h.category === cat)
    const currentValue = categoryHoldings.reduce(
      (sum, h) => sum.plus(h.currentValue),
      new Decimal(0),
    )

    const gap = targetValue.minus(currentValue)

    // Already at or above target — skip entirely
    if (gap.lessThanOrEqualTo(0)) continue

    // Compute percentages for GapRow
    const currentPct = totalAfter.isZero()
      ? 0
      : currentValue.div(totalAfter).mul(100).toDecimalPlaces(2).toNumber()
    const gapPct = gap.div(totalAfter).mul(100).toDecimalPlaces(2).toNumber()

    // Find fill ticker for this category
    const fillHolder = categoryHoldings.find(h => h.isFillTicker)

    if (!fillHolder) {
      const reason = categoryHoldings.length > 0 ? 'no-fill-ticker' : 'no-holdings'
      gapRows.push({ category: cat, targetPct, currentPct, gapPct, reason })
      continue
    }

    // Has a fill ticker — add to pending
    pendingItems.push({ category: cat, gap, fillTicker: fillHolder.ticker })
  }

  // --- 6. Determine result type ---

  // If no pending items but we have gap rows for no-fill-ticker reasons,
  // check whether every gap row is a no-fill-ticker (meaning tickers exist but none flagged)
  if (pendingItems.length === 0) {
    const allNoFillTicker = gapRows.length > 0 && gapRows.every(g => g.reason === 'no-fill-ticker')
    if (allNoFillTicker) {
      return { type: 'no-fill-tickers', gapRows }
    }
    // Empty items (all at target, or no-holdings gap rows only)
    return { type: 'buy-list', items: [], gapRows, isaWarning, effectiveBudget }
  }

  // --- 7. Proportional allocation across pending items ---
  const totalGap = pendingItems.reduce(
    (sum, p) => sum.plus(p.gap),
    new Decimal(0),
  )

  // Raw amounts proportional to gap size
  const rawAmounts = pendingItems.map(p =>
    effectiveBudget.mul(p.gap).div(totalGap),
  )

  // Round each to 2dp
  const roundedAmounts = rawAmounts.map(r =>
    r.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
  )

  // Last item absorbs rounding diff to guarantee exact sum
  const roundedSum = roundedAmounts.reduce((s, a) => s.plus(a), new Decimal(0))
  const diff = effectiveBudget.minus(roundedSum)
  roundedAmounts[roundedAmounts.length - 1] =
    roundedAmounts[roundedAmounts.length - 1].plus(diff)

  // --- 8. Build BuyListItem array ---
  const items: BuyListItem[] = pendingItems.map((p, i) => {
    const amountGbp = roundedAmounts[i]

    // allocationGapPct = gap / totalAfter * 100
    const allocationGapPct = p.gap
      .div(totalAfter)
      .mul(100)
      .toDecimalPlaces(2)
      .toNumber()

    // Category current value for rationale
    const catCurrentValue = holdings
      .filter(h => h.category === p.category)
      .reduce((sum, h) => sum.plus(h.currentValue), new Decimal(0))

    const currentCatPct = totalAfter.isZero()
      ? 0
      : catCurrentValue.div(totalAfter).mul(100).toDecimalPlaces(0).toNumber()

    const targetCatPct = (strategy.unified[p.category] ?? 0)

    // Informational rationale — no "advice", "recommend", or "suggest"
    const rationale =
      `${p.category} is ${currentCatPct.toFixed(0)}% of portfolio vs ` +
      `${targetCatPct.toFixed(0)}% target — adding to ${p.fillTicker} ` +
      `closes ${allocationGapPct.toFixed(1)}% of the gap.`

    return {
      ticker: p.fillTicker,
      category: p.category,
      amountGbp,
      allocationGapPct,
      rationale,
    }
  })

  return { type: 'buy-list', items, gapRows, isaWarning, effectiveBudget }
}
