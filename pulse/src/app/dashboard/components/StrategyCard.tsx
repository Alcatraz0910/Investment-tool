/**
 * StrategyCard — Phase 4 (STRAT-01/02/03/04).
 *
 * Displays the latest extracted strategy for a creator:
 * - Allocation breakdown by category (percentages)
 * - Confidence score
 * - Contradiction diff badge (D-11)
 *
 * UI copy: "Creator-derived strategy" — no advice/recommend/suggest (CLAUDE.md).
 * Server component: reads static strategy data passed from page.tsx.
 */
import type { CreatorStrategy } from '@/types'
import { ContradictionDiff } from './ContradictionDiff'

interface StrategyCardProps {
  strategy: CreatorStrategy | null
}

export function StrategyCard({ strategy }: StrategyCardProps) {
  if (!strategy) {
    return (
      <div className="mt-3 pt-3 border-t border-zinc-700/50">
        <p className="text-xs text-zinc-500 italic">
          No strategy extracted yet. Run a Refresh to extract creator-derived information.
        </p>
      </div>
    )
  }

  const categories = Object.entries(strategy.allocation).sort(
    ([, a], [, b]) => (b ?? 0) - (a ?? 0),
  )

  return (
    <div className="mt-3 pt-3 border-t border-zinc-700/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
          Creator-Derived Strategy
        </span>
        <span className="text-xs text-zinc-500">
          Confidence: {strategy.confidence}%
        </span>
      </div>

      {/* Allocation breakdown */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {categories.map(([cat, pct]) => (
          <span
            key={cat}
            className="inline-flex items-center gap-1 text-xs bg-zinc-700/60 text-zinc-300 rounded px-2 py-0.5"
          >
            {cat}
            <span className="text-white font-medium">{pct}%</span>
          </span>
        ))}
      </div>

      {/* Contradiction diff badge (D-11) */}
      {strategy.hasContradiction && (
        <ContradictionDiff contradictionNote={strategy.contradictionNote} />
      )}
    </div>
  )
}
