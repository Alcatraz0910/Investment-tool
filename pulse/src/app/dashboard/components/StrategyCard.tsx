/**
 * StrategyCard — Phase 6 restyle (UI-05, D-01/D-02, Open Question 3).
 *
 * Phase 6 changes from Phase 4:
 * - Glassmorphism card wrapper (D-02)
 * - lastRefreshedAt prop added (UI-05, Open Question 3 resolution)
 * - confidence label uses UI-SPEC copywriting: "Confidence: {N}%"
 * - contradiction badge text: "Strategy conflict detected" (UI-SPEC)
 * - category allocation chips use accent for text
 *
 * UI copy: "Creator-derived strategy" — no advice/recommend/suggest (CLAUDE.md).
 * Server component: reads static strategy data passed from page.tsx.
 */
import type { CreatorStrategy } from '@/types'
import { ContradictionDiff } from './ContradictionDiff'

interface StrategyCardProps {
  strategy: CreatorStrategy | null
  lastRefreshedAt?: string   // pre-formatted date string, e.g. "06/05/2026" or "Never"
}

export function StrategyCard({ strategy, lastRefreshedAt }: StrategyCardProps) {
  if (!strategy) {
    return (
      <div className="mt-3 pt-3 border-t border-white/10">
        <p className="text-xs text-zinc-500 italic">
          No strategy extracted yet. Run a Refresh to extract creator-derived information.
        </p>
        {lastRefreshedAt && (
          <p className="text-xs text-zinc-600 mt-1">Last refreshed {lastRefreshedAt}</p>
        )}
      </div>
    )
  }

  const categories = Object.entries(strategy.allocation).sort(
    ([, a], [, b]) => (b ?? 0) - (a ?? 0),
  )

  return (
    <div className="mt-3 pt-3 border-t border-white/10">
      {/* Header row: label + confidence + last refreshed */}
      <div className="flex items-start justify-between mb-2 gap-2">
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
          Creator-Derived Strategy
        </span>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <span className="text-xs text-zinc-400">
            Confidence: {strategy.confidence}%
          </span>
          {lastRefreshedAt && (
            <span className="text-xs text-zinc-600">
              Last refreshed {lastRefreshedAt}
            </span>
          )}
        </div>
      </div>

      {/* Allocation breakdown */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {categories.map(([cat, pct]) => (
          <span
            key={cat}
            className="inline-flex items-center gap-1 text-xs bg-surface border border-border text-zinc-300 rounded-lg px-2 py-0.5"
          >
            {cat}
            <span className="text-accent font-medium">{pct}%</span>
          </span>
        ))}
      </div>

      {/* Contradiction diff badge (STRAT-04) */}
      {strategy.hasContradiction && (
        <ContradictionDiff contradictionNote={strategy.contradictionNote} />
      )}
    </div>
  )
}
