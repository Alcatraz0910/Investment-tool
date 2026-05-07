'use client'
/**
 * PlanTab — Phase 5 Plan Generator.
 *
 * Client wrapper that mounts ContributionCalculator with server-fetched props.
 * Title + ContributionCalculator (which renders BuyListTable internally).
 */
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
  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Monthly Buy List</h2>
      <ContributionCalculator
        portfolio={portfolio}
        strategy={strategy}
        isaRemaining={isaRemaining}
        initialBudget={initialBudget}
      />
    </div>
  )
}
