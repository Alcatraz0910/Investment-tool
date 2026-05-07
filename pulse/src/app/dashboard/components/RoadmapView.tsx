'use client'
/**
 * RoadmapView — Phase 6 (UI-03, D-05/D-06/D-07/D-08).
 *
 * Recharts LineChart showing two monthly trajectory lines:
 *   - "Your Current Path": contributions at current allocation mix
 *   - "Creator's Vision":  contributions at blended target allocation
 *
 * Both lines track £ value in the LARGEST allocation-gap category over
 * the current UK tax year (today → 5 April). Divergence is visible
 * when currentMix != targetMix for that category.
 *
 * MUST be 'use client' — Recharts uses browser APIs (ResizeObserver).
 * Do NOT use next/dynamic({ ssr: false }) from a server component.
 *
 * Disclaimer required below chart (CLAUDE.md + UI-SPEC copywriting contract).
 * Import from 'framer-motion' (package.json dep name — not 'motion/react').
 */
import { useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { computeRoadmap, getLargestGapCategory } from '@/lib/plan/roadmap'
import { getCurrentTaxYear } from '@/lib/tax-year'
import type { HoldingWithFillTicker } from '@/lib/plan/generator'
import type { BlendedStrategy } from '@/lib/strategy/blender'

interface Props {
  holdings: HoldingWithFillTicker[]
  blend: BlendedStrategy | null
  monthlyBudget: number   // from PlanTab lifted state — updates on slider drag
}

// Custom tooltip matching glassmorphism palette (UI-SPEC Recharts Styling Contract)
function GlassTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-lg p-2 text-xs text-white shadow-lg">
      <p className="text-zinc-400 mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: £{entry.value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      ))}
    </div>
  )
}

export function RoadmapView({ holdings, blend, monthlyBudget }: Props) {
  // taxYear is computed on every render but its string value is stable within a session
  // (UK tax year changes only once a year at 6 April midnight). If the page stays open
  // across that boundary the chart will silently use the stale tax year until next refresh.
  // This is acceptable for v1 — the app is manually refreshed. A future improvement would
  // be to derive taxYear in a useState/useEffect that updates at midnight on 6 April.
  const taxYear = getCurrentTaxYear()

  const data = useMemo(
    () => computeRoadmap(holdings, blend, monthlyBudget, taxYear),
    [holdings, blend, monthlyBudget, taxYear],
  )

  const gapCategory = useMemo(
    () => blend ? getLargestGapCategory(holdings, blend) : '',
    [holdings, blend],
  )

  // Empty states (UI-SPEC copywriting contract)
  if (!blend || Object.keys(blend.unified).length === 0) {
    return (
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-8 text-center mt-6">
        <p className="text-base font-semibold text-white mb-1">12-Month Roadmap</p>
        <p className="text-sm text-zinc-400">
          Track a creator and run Refresh to see your roadmap.
        </p>
      </div>
    )
  }

  if (holdings.length === 0) {
    return (
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-8 text-center mt-6">
        <p className="text-base font-semibold text-white mb-1">12-Month Roadmap</p>
        <p className="text-sm text-zinc-400">
          Add holdings to see your roadmap trajectory.
        </p>
      </div>
    )
  }

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6 mt-6">
      <h3 className="text-base font-semibold text-white mb-1">12-Month Roadmap</h3>
      <p className="text-xs text-zinc-400 mb-4">
        {gapCategory
          ? <>Tracking <span className="text-accent">{gapCategory}</span> — the category with the largest gap between your current mix and the creator strategy.</>
          : 'How contributions grow your portfolio under each allocation strategy.'
        }
      </p>

      {/* Recharts LineChart — ResponsiveContainer requires explicit height (UI-SPEC: 300px) */}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={data}
          margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
        >
          {/* UI-SPEC: CartesianGrid stroke #3A3A3C, strokeDasharray 3 3, opacity 0.4 */}
          <CartesianGrid stroke="#3A3A3C" strokeDasharray="3 3" opacity={0.4} />
          {/* UI-SPEC: axis tick color #9CA3AF, fontSize 12 */}
          <XAxis
            dataKey="month"
            stroke="#9CA3AF"
            tick={{ fontSize: 12, fill: '#9CA3AF' }}
          />
          {/* UI-SPEC: Y-axis tick format £Xk */}
          <YAxis
            stroke="#9CA3AF"
            tick={{ fontSize: 12, fill: '#9CA3AF' }}
            tickFormatter={(v: number) => `£${(v / 1000).toFixed(0)}k`}
            width={50}
          />
          <Tooltip content={<GlassTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }} />
          {/* UI-SPEC: "Your Current Path" stroke #818CF8 (accent-hover) */}
          <Line
            type="monotone"
            dataKey="currentPath"
            name="Your Current Path"
            stroke="#818CF8"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#818CF8' }}
          />
          {/* UI-SPEC: "Creator's Vision" stroke #6366F1 (accent) */}
          <Line
            type="monotone"
            dataKey="creatorVision"
            name="Creator's Vision"
            stroke="#6366F1"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#6366F1' }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* CLAUDE.md + UI-SPEC: disclaimer required below every Buy List / Roadmap surface */}
      <p className="text-xs text-zinc-500 mt-3">
        Creator-derived information — not financial advice
      </p>
    </div>
  )
}
