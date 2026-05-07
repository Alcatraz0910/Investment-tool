'use client'
/**
 * ContributionCalculator — Phase 6 restyle (UI-04).
 *
 * Phase 6 changes from Phase 5:
 * - budget state lifted to PlanTab (controlled component — accepts budget + onBudgetChange)
 * - Glassmorphism card wrapper
 * - Slider accent color via `accent-accent` (Electric Indigo)
 * - Number input glassmorphism styled
 *
 * PRESERVED from Phase 5:
 * - useMemo(generatePlan) — pure client-side recompute, no network call (D-12)
 * - Range: £200–£1000, step: 1, integer values
 */
import { useMemo } from 'react'
import { generatePlan } from '@/lib/plan/generator'
import type { HoldingWithFillTicker } from '@/lib/plan/generator'
import type { BlendedStrategy } from '@/lib/strategy/blender'
import { BuyListTable } from './BuyListTable'

interface Props {
  portfolio: HoldingWithFillTicker[]
  strategy: BlendedStrategy | null
  isaRemaining: number
  budget: number          // lifted state from PlanTab (Open Question 1)
  onBudgetChange: (v: number) => void
}

export function ContributionCalculator({ portfolio, strategy, isaRemaining, budget, onBudgetChange }: Props) {
  // D-12: client-side only, no network call — UNCHANGED from Phase 5
  const plan = useMemo(
    () => generatePlan(portfolio, budget, strategy, isaRemaining),
    [portfolio, budget, strategy, isaRemaining],
  )

  return (
    <div className="space-y-4">
      {/* Slider section — glassmorphism card */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6">
        <div className="flex items-center gap-4">
          <label className="text-sm text-zinc-400 shrink-0">Monthly budget</label>
          <input
            type="range"
            min={200}
            max={1000}
            step={1}
            value={budget}
            onChange={(e) => onBudgetChange(Number(e.target.value))}
            className="flex-1 accent-accent"
            aria-label="Monthly contribution budget"
          />
          <input
            type="number"
            min={200}
            max={1000}
            step={1}
            value={budget}
            onChange={(e) => {
              // Allow free typing — clamp only on blur to avoid jarring mid-type snapping
              const raw = parseInt(e.target.value, 10)
              if (!isNaN(raw)) onBudgetChange(raw)
            }}
            onBlur={(e) => {
              const clamped = Math.min(1000, Math.max(200, parseInt(e.target.value, 10) || 200))
              onBudgetChange(clamped)
            }}
            className="w-20 bg-surface border border-border rounded-lg px-2 py-1 text-sm text-white text-right focus:outline-none focus:ring-2 focus:ring-accent"
            aria-label="Monthly contribution amount in pounds"
          />
          <span className="text-sm text-zinc-400">£</span>
        </div>
      </div>

      {/* Buy List */}
      <BuyListTable result={plan} />
    </div>
  )
}
