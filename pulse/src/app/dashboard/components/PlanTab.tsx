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
import { Decimal } from 'decimal.js'
import { ContributionCalculator } from './ContributionCalculator'
import { RoadmapView } from './RoadmapView'
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

  // Use decimal.js for £ totals to avoid IEEE 754 float errors (CLAUDE.md mandate)
  const totalValue = portfolio
    .reduce((sum, h) => sum.plus(new Decimal(h.currentValue)), new Decimal(0))
    .toNumber()
  const fillTickerCount = portfolio.filter(h => h.isFillTicker).length

  // Group holdings by category for display
  const byCategory = portfolio.reduce<Record<string, { total: number; hasStar: boolean }>>((acc, h) => {
    if (!acc[h.category]) acc[h.category] = { total: 0, hasStar: false }
    acc[h.category].total = new Decimal(acc[h.category].total)
      .plus(new Decimal(h.currentValue))
      .toNumber()
    if (h.isFillTicker) acc[h.category].hasStar = true
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">Your Action Plan</h2>

      {/* Portfolio snapshot — always shown so user can confirm holdings are loaded */}
      {portfolio.length > 0 && (
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">
              Portfolio — {portfolio.length} holding{portfolio.length !== 1 ? 's' : ''} · £{totalValue.toFixed(2)}
            </p>
            {fillTickerCount === 0 && (
              <span className="text-xs text-amber-400">No buy targets set — star (★) a holding per category in Portfolio tab</span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-1">
            {Object.entries(byCategory).map(([cat, { total, hasStar }]) => (
              <div key={cat} className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 flex items-center gap-1">
                  {hasStar ? <span className="text-accent">★</span> : <span className="text-zinc-600">☆</span>}
                  {cat}
                </span>
                <span className="text-zinc-300">£{total.toFixed(2)}</span>
              </div>
            ))}
          </div>
          {!strategy && (
            <p className="text-xs text-zinc-500 pt-1 border-t border-white/5">
              No creator strategy yet — go to Creators tab, track a creator and click Refresh to generate buy recommendations.
            </p>
          )}
        </div>
      )}

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

      {/* Roadmap View — below Buy List, per D-06 */}
      <RoadmapView
        holdings={portfolio}
        blend={strategy}
        monthlyBudget={budget}
      />
    </div>
  )
}
