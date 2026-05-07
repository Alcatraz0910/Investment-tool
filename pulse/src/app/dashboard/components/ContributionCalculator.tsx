'use client'
/**
 * ContributionCalculator — Phase 5 Plan Generator (D-09, D-10, D-11, D-12).
 *
 * Slider + numeric input above BuyListTable.
 * generatePlan called via useMemo — pure client-side recompute, no network call (D-12).
 * Initialises from monthly_budget prop (or 500 fallback — D-11).
 */
import { useState, useMemo } from 'react'
import { generatePlan } from '@/lib/plan/generator'
import type { HoldingWithFillTicker } from '@/lib/plan/generator'
import type { BlendedStrategy } from '@/lib/strategy/blender'
import { BuyListTable } from './BuyListTable'

interface Props {
  portfolio: HoldingWithFillTicker[]
  strategy: BlendedStrategy | null
  isaRemaining: number
  initialBudget: number    // from users.monthly_budget or 500 fallback (D-11)
}

export function ContributionCalculator({ portfolio, strategy, isaRemaining, initialBudget }: Props) {
  const [budget, setBudget] = useState(initialBudget)

  // D-12: client-side only, no network call
  const plan = useMemo(
    () => generatePlan(portfolio, budget, strategy, isaRemaining),
    [portfolio, budget, strategy, isaRemaining],
  )

  return (
    <div>
      {/* D-09: slider above Buy List table */}
      {/* D-10: free-drag slider + numeric input, no snapping, integer values, £200–£1000 */}
      <div className="flex items-center gap-4 mb-6">
        <label className="text-sm text-zinc-400 shrink-0">Monthly budget</label>
        <input
          type="range"
          min={200}
          max={1000}
          step={1}
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
          className="flex-1 accent-indigo-500"
          aria-label="Monthly contribution budget"
        />
        <input
          type="number"
          min={200}
          max={1000}
          step={1}
          value={budget}
          onChange={(e) => {
            const v = Math.min(1000, Math.max(200, parseInt(e.target.value) || 200))
            setBudget(v)
          }}
          className="w-20 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-white text-right"
          aria-label="Monthly contribution amount in pounds"
        />
        <span className="text-sm text-zinc-400">£</span>
      </div>
      <BuyListTable result={plan} />
    </div>
  )
}
