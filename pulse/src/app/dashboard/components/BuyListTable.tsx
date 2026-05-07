'use client'
/**
 * BuyListTable — Phase 6 restyle (UI-02, D-09/D-10/D-13).
 *
 * Phase 6 changes from Phase 5:
 * - <table> converted to glassmorphism div card list (D-02)
 * - AnimatePresence rationale accordion on click (D-09/D-10/D-13)
 * - Card-mount stagger animation (D-11.1)
 * - ISA warning uses red-500 palette (UI-SPEC)
 * - gap bar uses bg-accent (Electric Indigo)
 *
 * CRITICAL: No "advice", "recommend", or "suggest" in any user-facing string.
 * Disclaimer "Creator-derived information — not financial advice" on ALL variants.
 * CRITICAL: All rationale rendered as JSX text nodes — never dangerouslySetInnerHTML (T-06-02-01).
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { PlanResult } from '@/lib/plan/generator'

const listVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
}

interface Props {
  result: PlanResult
}

export function BuyListTable({ result }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)

  function toggleRow(key: string) {
    setExpanded((prev) => (prev === key ? null : key))
  }

  // --- no-strategy ---
  if (result.type === 'no-strategy') {
    return (
      <div className="space-y-4">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6 text-center">
          <p className="text-sm text-zinc-400">
            No strategy yet. Track a creator and run Refresh.
          </p>
        </div>
        <p className="text-xs text-zinc-500">
          Creator-derived information — not financial advice
        </p>
      </div>
    )
  }

  // --- no-fill-tickers ---
  if (result.type === 'no-fill-tickers') {
    return (
      <div className="space-y-4">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
          <p className="text-sm text-amber-400 font-medium">
            Mark preferred holdings to get specific buy suggestions.
          </p>
        </div>
        {result.gapRows.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">Category Gaps</p>
            {result.gapRows.map((row) => (
              <div
                key={row.category}
                className="flex items-start gap-3 px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl"
              >
                <span className="text-xs font-medium text-accent shrink-0 pt-0.5 w-24">
                  {row.category}
                </span>
                <p className="text-xs text-zinc-400">
                  {row.reason === 'no-fill-ticker'
                    ? `Mark a preferred holding for ${row.category} to include it in your plan.`
                    : `You're ${row.gapPct.toFixed(1)}% underweight in ${row.category} — add a holding to get started.`}
                </p>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-zinc-500">
          Creator-derived information — not financial advice
        </p>
      </div>
    )
  }

  // --- buy-list ---
  const { items, gapRows, isaWarning, effectiveBudget } = result

  return (
    <div className="space-y-4">
      {/* ISA warning (UI-SPEC: red-500 palette) */}
      {isaWarning && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-sm text-red-400">
            Your monthly budget exceeds your remaining ISA allowance. Only the remaining allowance amount will be used.
          </p>
        </div>
      )}

      {items.length === 0 && gapRows.length === 0 ? (
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6 text-center">
          <p className="text-sm text-zinc-400">
            Add your portfolio holdings to generate a Buy List.
          </p>
        </div>
      ) : (
        <>
          {/* Column headers */}
          {items.length > 0 && (
            <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-4 py-2">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Ticker</span>
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Category</span>
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide text-right">Amount</span>
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide text-right">Gap</span>
            </div>
          )}

          {/* Buy item cards with stagger */}
          {items.length > 0 && (
            <motion.div
              className="space-y-2"
              variants={listVariants}
              initial="hidden"
              animate="visible"
            >
              {items.map((item) => {
                const rowKey = `${item.ticker}-${item.category}`
                const isExpanded = expanded === rowKey
                const amountDisplay = typeof item.amountGbp === 'object' && 'toFixed' in item.amountGbp
                  ? (item.amountGbp as { toFixed: (n: number) => string }).toFixed(2)
                  : Number(item.amountGbp).toFixed(2)
                return (
                  <motion.div
                    key={rowKey}
                    variants={itemVariants}
                    className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl overflow-hidden"
                  >
                    {/* Row button — min 44px height for WCAG touch target */}
                    <button
                      type="button"
                      aria-label={`${item.ticker} ${item.category} buy row`}
                      className="w-full grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-4 py-3 min-h-[44px] text-left hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-accent rounded-xl"
                      onClick={() => toggleRow(rowKey)}
                      aria-expanded={isExpanded}
                    >
                      <span className="font-medium text-white text-sm">{item.ticker}</span>
                      <span className="text-zinc-300 text-sm">{item.category}</span>
                      <span className="font-medium text-white text-sm text-right">
                        £{amountDisplay}
                      </span>
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-12 h-1.5 bg-border rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent rounded-full"
                            style={{ width: `${Math.min(item.allocationGapPct, 100)}%` }}
                          />
                        </div>
                        <span className="text-zinc-400 text-xs w-8 text-right">
                          {item.allocationGapPct.toFixed(1)}%
                        </span>
                      </div>
                    </button>

                    {/* Rationale accordion (D-09/D-10/D-13) */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: 'easeOut' }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div className="px-4 pb-4 pt-1 border-t border-white/10">
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs mb-2">
                              <div>
                                <dt className="text-zinc-500">Category</dt>
                                <dd className="text-zinc-300">{item.category}</dd>
                              </div>
                              <div>
                                <dt className="text-zinc-500">Gap closed</dt>
                                <dd className="text-zinc-300">{item.allocationGapPct.toFixed(1)}%</dd>
                              </div>
                            </dl>
                            <p className="text-xs text-zinc-400">
                              This purchase closes {item.allocationGapPct.toFixed(1)}% of your {item.category} gap.
                            </p>
                            {item.rationale && (
                              <p className="text-xs text-zinc-500 mt-1">{item.rationale}</p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </motion.div>
          )}

          {/* Total */}
          {items.length > 0 && (
            <div className="flex justify-between items-center px-4 py-2 bg-surface border border-border rounded-xl">
              <span className="text-xs text-zinc-500">Total</span>
              <span className="text-sm font-semibold text-white">
                £{typeof effectiveBudget === 'object' && 'toFixed' in effectiveBudget
                  ? (effectiveBudget as { toFixed: (n: number) => string }).toFixed(2)
                  : Number(effectiveBudget).toFixed(2)}
              </span>
            </div>
          )}

          {/* Gap rows */}
          {gapRows.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500 uppercase tracking-wide">Gaps Not Covered</p>
              {gapRows.map((row) => (
                <div
                  key={row.category}
                  className="flex items-start gap-3 px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl"
                >
                  <span className="text-xs font-medium text-accent shrink-0 pt-0.5 w-24">
                    {row.category}
                  </span>
                  <p className="text-xs text-zinc-400">
                    {row.reason === 'no-fill-ticker'
                      ? `Mark a preferred holding for ${row.category} to include it in your plan.`
                      : `You're ${row.gapPct.toFixed(1)}% underweight in ${row.category} — add a holding to get started.`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* PLAN-04 + UI-SPEC disclaimer — required on all buy-list states */}
      <p className="text-xs text-zinc-500">
        Creator-derived information — not financial advice
      </p>
    </div>
  )
}
