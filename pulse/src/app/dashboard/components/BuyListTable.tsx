'use client'
/**
 * BuyListTable — Phase 5 Plan Generator (PLAN-01 … PLAN-04, ISA-02).
 *
 * Renders all three PlanResult variants:
 *   - 'no-strategy'     : placeholder card (D-06)
 *   - 'no-fill-tickers' : gap rows + prompt banner (D-08)
 *   - 'buy-list'        : ISA warning + buy rows + gap rows + disclaimer (PLAN-04)
 *
 * CRITICAL: No "advice", "recommend", or "suggest" in any user-facing string.
 */
import type { PlanResult } from '@/lib/plan/generator'

interface Props {
  result: PlanResult
}

export function BuyListTable({ result }: Props) {
  // --- no-strategy: placeholder ---
  if (result.type === 'no-strategy') {
    return (
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6 text-center">
        <p className="text-sm text-zinc-400">
          Refresh a creator to generate your first Buy List.
        </p>
      </div>
    )
  }

  // --- no-fill-tickers: banner + gap rows ---
  if (result.type === 'no-fill-tickers') {
    return (
      <div className="space-y-4">
        {/* D-08 banner */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
          <p className="text-sm text-amber-400 font-medium">
            Mark preferred holdings to get specific buy suggestions.
          </p>
        </div>

        {/* Gap rows */}
        {result.gapRows.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">Category Gaps</p>
            {result.gapRows.map((row) => (
              <div
                key={row.category}
                className="flex items-start gap-3 px-4 py-2 bg-zinc-800/40 border border-zinc-700/50 rounded-md"
              >
                <span className="text-xs font-medium text-indigo-400 shrink-0 pt-0.5 w-24">
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

        <p className="text-xs text-zinc-500 mt-4">
          Creator-derived information — not financial advice
        </p>
      </div>
    )
  }

  // --- buy-list ---
  const { items, gapRows, isaWarning, effectiveBudget } = result

  return (
    <div className="space-y-4">
      {/* ISA warning (ISA-02) */}
      {isaWarning && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
          <p className="text-sm text-amber-400 font-medium">
            Your budget exceeds your remaining ISA allowance. Plan total has been capped to the ISA limit.
          </p>
        </div>
      )}

      {items.length === 0 && gapRows.length === 0 ? (
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6 text-center">
          <p className="text-sm text-zinc-400">
            Your portfolio is already at or above all target allocations.
          </p>
        </div>
      ) : (
        <>
          {/* Buy items table */}
          {items.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-zinc-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-800 border-b border-zinc-700">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                      Ticker
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                      Category
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                      Amount (£)
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                      Gap Closed
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-700/50">
                  {items.map((item) => (
                    <tr
                      key={`${item.ticker}-${item.category}`}
                      className="bg-zinc-800/30 hover:bg-zinc-800/60 transition-colors"
                      title={item.rationale}
                    >
                      <td className="px-4 py-3 font-medium text-white">
                        {item.ticker}
                      </td>
                      <td className="px-4 py-3 text-zinc-300">
                        {item.category}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-white">
                        £{item.amountGbp.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${Math.min(item.allocationGapPct, 100)}%` }}
                            />
                          </div>
                          <span className="text-zinc-300 text-xs w-10 text-right">
                            {item.allocationGapPct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-zinc-700 bg-zinc-800">
                    <td colSpan={2} className="px-4 py-2 text-xs text-zinc-500">
                      Total
                    </td>
                    <td className="px-4 py-2 text-right text-sm font-semibold text-white">
                      £{effectiveBudget.toFixed(2)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Gap rows (informational — categories without fill tickers or holdings) */}
          {gapRows.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500 uppercase tracking-wide">Gaps Not Covered</p>
              {gapRows.map((row) => (
                <div
                  key={row.category}
                  className="flex items-start gap-3 px-4 py-2 bg-zinc-800/40 border border-zinc-700/50 rounded-md"
                >
                  <span className="text-xs font-medium text-indigo-400 shrink-0 pt-0.5 w-24">
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

      {/* PLAN-04 disclaimer */}
      <p className="text-xs text-zinc-500 mt-4">
        Creator-derived information — not financial advice
      </p>
    </div>
  )
}
