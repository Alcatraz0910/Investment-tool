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
import { useMemo, useState, useTransition } from 'react'
import { generatePlan } from '@/lib/plan/generator'
import type { HoldingWithFillTicker } from '@/lib/plan/generator'
import type { BlendedStrategy } from '@/lib/strategy/blender'
import { fetchTickerPrices } from '@/app/dashboard/actions'
import { BuyListTable } from './BuyListTable'

interface Props {
  portfolio: HoldingWithFillTicker[]
  strategy: BlendedStrategy | null
  isaRemaining: number
  budget: number          // lifted state from PlanTab (Open Question 1)
  onBudgetChange: (v: number) => void
}

const BUDGET_MIN = 200
const BUDGET_MAX = 1000

export function ContributionCalculator({ portfolio, strategy, isaRemaining, budget, onBudgetChange }: Props) {
  // D-12: client-side only, no network call — UNCHANGED from Phase 5
  const plan = useMemo(
    () => generatePlan(portfolio, budget, strategy, isaRemaining),
    [portfolio, budget, strategy, isaRemaining],
  )

  // Phase 8: Buy List prices — React state only (D-02, D-06)
  const [buyListPrices, setBuyListPrices] = useState<Record<string, number | null>>({})
  const [pricesPending, startPricesTransition] = useTransition()
  const [buyListPriceError, setBuyListPriceError] = useState<string | null>(null)

  function handleRefreshBuyListPrices() {
    if (!plan || plan.type !== 'buy-list' || !plan.items?.length) return
    setBuyListPriceError(null)
    const tickers = plan.items.map((i: { ticker: string }) => i.ticker)
    startPricesTransition(async () => {
      const result = await fetchTickerPrices(tickers)
      if (result.error) {
        setBuyListPriceError(result.error)
      } else if (result.prices) {
        setBuyListPrices(result.prices)
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Slider section — glassmorphism card */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6">
        <div className="flex items-center gap-4">
          <label className="text-sm text-zinc-400 shrink-0">Monthly budget</label>
          <input
            type="range"
            min={BUDGET_MIN}
            max={BUDGET_MAX}
            step={1}
            value={budget}
            onChange={(e) => onBudgetChange(Number(e.target.value))}
            className="flex-1 accent-accent"
            aria-label="Monthly contribution budget"
          />
          <input
            type="number"
            min={BUDGET_MIN}
            max={BUDGET_MAX}
            step={1}
            value={budget}
            onChange={(e) => {
              // Allow free typing — clamp only on blur to avoid jarring mid-type snapping
              const raw = parseInt(e.target.value, 10)
              if (!isNaN(raw)) onBudgetChange(raw)
            }}
            onBlur={(e) => {
              const clamped = Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, parseInt(e.target.value, 10) || BUDGET_MIN))
              onBudgetChange(clamped)
            }}
            className="w-20 bg-surface border border-border rounded-lg px-2 py-1 text-sm text-white text-right focus:outline-none focus:ring-2 focus:ring-accent"
            aria-label="Monthly contribution amount in pounds"
          />
          <span className="text-sm text-zinc-400">£</span>
        </div>
      </div>

      {/* Buy List — Phase 8: Refresh Prices button and price column */}
      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={handleRefreshBuyListPrices}
          disabled={pricesPending}
          className="bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold rounded-md px-3 min-h-[44px] disabled:opacity-75"
          aria-label={pricesPending ? 'Refreshing prices...' : undefined}
        >
          {pricesPending ? (
            <svg
              className="animate-spin h-4 w-4"
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : 'Refresh Prices'}
        </button>
      </div>
      {buyListPriceError && (
        <p role="alert" aria-live="assertive" className="text-sm text-red-400 mb-2">
          {buyListPriceError}
        </p>
      )}
      <BuyListTable result={plan} prices={buyListPrices} />
    </div>
  )
}
