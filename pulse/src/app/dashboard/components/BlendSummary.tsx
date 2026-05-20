/**
 * BlendSummary — Phase 6 restyle (D-02).
 *
 * Phase 6 changes from Phase 4:
 * - Glassmorphism card wrapper (D-02)
 * - Allocation chips use bg-surface border-border + text-accent (design tokens)
 * - rounded-xl on containers
 *
 * Displays per-creator influence % from blendStrategies() output.
 * Also shows the unified allocation breakdown.
 *
 * UI copy: "Creator-derived blend" — no advice/recommend/suggest (CLAUDE.md).
 * Server component.
 */
import type { BlendedStrategy } from '@/lib/strategy/blender'

interface BlendSummaryProps {
  blend: BlendedStrategy | null
  creatorNameMap: Record<string, string>  // creatorId → displayName
}

export function BlendSummary({ blend, creatorNameMap }: BlendSummaryProps) {
  // MOB-01 audit: no overflow risk at 375px — flex flex-wrap for chips, flex-col for influence list, no tables
  if (!blend || Object.keys(blend.unified).length === 0) {
    return (
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4">
        <h2 className="text-base font-semibold text-white mb-2">Blended Strategy</h2>
        <p className="text-sm text-zinc-500">
          No blend available yet. Track creators and run Refresh to extract creator-derived strategies.
        </p>
      </div>
    )
  }

  const sortedAllocation = Object.entries(blend.unified).sort(
    ([, a], [, b]) => (b ?? 0) - (a ?? 0),
  )

  const sortedInfluence = Object.entries(blend.influence).sort(
    ([, a], [, b]) => b - a,
  )

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4">
      <h2 className="text-base font-semibold text-white mb-3">Blended Strategy</h2>

      {/* Unified allocation */}
      <div className="mb-4">
        <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Target Allocation</p>
        <div className="flex flex-wrap gap-1.5">
          {sortedAllocation.map(([cat, pct]) => (
            <span
              key={cat}
              className="inline-flex items-center gap-1 text-xs bg-surface border border-border text-zinc-300 rounded px-2 py-0.5"
            >
              {cat}
              <span className="text-accent font-medium">{pct !== undefined ? pct.toFixed(1) : '—'}%</span>
            </span>
          ))}
        </div>
      </div>

      {/* Per-creator influence (BLEND-03) */}
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Creator Influence</p>
        <div className="flex flex-col gap-1">
          {sortedInfluence.map(([creatorId, pct]) => (
            <div key={creatorId} className="flex items-center justify-between text-sm">
              <span className="text-zinc-300">
                {creatorNameMap[creatorId] ?? creatorId}
              </span>
              <span className="text-zinc-400 font-medium">{pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-zinc-500 mt-3">
        Creator-derived information only. This is not financial advice.
      </p>
    </div>
  )
}
