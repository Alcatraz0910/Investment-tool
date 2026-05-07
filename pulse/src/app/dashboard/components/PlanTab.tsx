'use client'
/**
 * PlanTab — Phase 6 restyle (UI-02, UI-04, UI-SPEC).
 *
 * Phase 6 changes:
 * - Heading: "Your Action Plan" (UI-SPEC copywriting contract)
 * - ISA warning banner at top (if monthlyBudget > isaRemaining) — UI-SPEC placement
 * - budget state lifted here (Open Question 1 resolution) so RoadmapView can observe it
 * - Glassmorphism card wrapper for the calculator section
 * - RoadmapView slot reserved below BuyListTable (Plan 06-03 adds it)
 */
import { useState } from 'react'
import { ContributionCalculator } from './ContributionCalculator'
import type { HoldingWithFillTicker } from '@/lib/plan/generator'
import type { BlendedStrategy } from '@/lib/strategy/blender'

interface Props {
  portfolio: HoldingWithFillTicker[]
  strategy: BlendedStrategy | null
  isaRemaining: number
  initialBudget: number
}

export function PlanTab({ portfolio, strategy, isaRemaining, initialBudget }: Props) {
  const [budget, setBudget] = useState(initialBudget)

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">Your Action Plan</h2>

      {/* ISA over-limit warning — top banner, before calculator (UI-SPEC) */}
      {budget > isaRemaining && isaRemaining > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-sm text-red-400">
            Your monthly budget exceeds your remaining ISA allowance (£{isaRemaining.toFixed(2)} left). Only £{isaRemaining.toFixed(2)} will be used.
          </p>
        </div>
      )}

      {/* Contribution Calculator + Buy List */}
      <ContributionCalculator
        portfolio={portfolio}
        strategy={strategy}
        isaRemaining={isaRemaining}
        budget={budget}
        onBudgetChange={setBudget}
      />

      {/* Roadmap View slot — Plan 06-03 will add <RoadmapView> here */}
    </div>
  )
}
