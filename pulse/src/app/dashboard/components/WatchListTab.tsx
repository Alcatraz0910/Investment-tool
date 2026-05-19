'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Decimal } from 'decimal.js'
import { fetchTickerPrices } from '@/app/dashboard/actions'
import { saveCreatorMonthlyBudget } from '@/app/dashboard/watchlist-actions'
import { calcShareQuantity, buildMergedWatchList } from '@/lib/watchlist/generator'
import type { CreatorWatchList, WatchListItem, MergedWatchListItem } from '@/lib/watchlist/generator'

interface WatchListTabProps {
  initialWatchLists: CreatorWatchList[]
  userCreatorIdMap: Record<string, string>
}

const sectionVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' as const } },
}

const CONVICTION_CLASS: Record<WatchListItem['conviction'], string> = {
  high: 'text-xs font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 rounded px-1.5 py-0.5',
  medium: 'text-xs font-semibold text-zinc-400 bg-zinc-700/50 border border-zinc-600/30 rounded px-1.5 py-0.5',
  low: 'text-xs font-semibold text-zinc-500 bg-zinc-800/50 border border-zinc-700/30 rounded px-1.5 py-0.5',
}
const CONVICTION_LABEL: Record<WatchListItem['conviction'], string> = {
  high: 'High', medium: 'Medium', low: 'Low',
}

function SpinnerSVG() {
  return (
    <svg className="animate-spin h-4 w-4" aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

function isStale(timestamp: Date | null): boolean {
  if (!timestamp) return false
  return Date.now() - timestamp.getTime() > 24 * 60 * 60 * 1000
}

export function WatchListTab({ initialWatchLists, userCreatorIdMap }: WatchListTabProps) {
  const [watchLists, setWatchLists] = useState<CreatorWatchList[]>(initialWatchLists)
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [priceTimestamp, setPriceTimestamp] = useState<Date | null>(null)
  const [priceError, setPriceError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Record<string, number | null>>({})
  const [savingBudget, setSavingBudget] = useState<Record<string, boolean>>({})
  const [budgetError, setBudgetError] = useState<Record<string, string | null>>({})

  const handleRefreshPrices = async () => {
    setRefreshing(true)
    setPriceError(null)
    const allTickers = watchLists.flatMap((wl) => wl.items.map((i) => i.ticker))
    const uniqueTickers = [...new Set(allTickers)]
    const result = await fetchTickerPrices(uniqueTickers)
    // Filter out null prices before storing (null = fetch failed for that ticker)
    const validPrices: Record<string, number> = {}
    const failedTickers: string[] = []
    for (const [ticker, price] of Object.entries(result.prices ?? {})) {
      if (price !== null && price !== undefined) {
        validPrices[ticker] = price
      } else {
        failedTickers.push(ticker)
      }
    }
    setPrices(validPrices)
    setPriceTimestamp(new Date())
    if (result.error) {
      setPriceError(result.error)
    } else if (failedTickers.length > 0) {
      setPriceError(`Could not fetch prices for: ${failedTickers.join(', ')}`)
    }
    setRefreshing(false)
  }

  const handleSaveBudget = async (creatorId: string) => {
    const budget = editingBudget[creatorId]
    if (budget === null || budget === undefined) return
    setSavingBudget((s) => ({ ...s, [creatorId]: true }))
    setBudgetError((e) => ({ ...e, [creatorId]: null }))
    const userCreatorId = userCreatorIdMap[creatorId]
    const result = await saveCreatorMonthlyBudget(userCreatorId, budget)
    if (result.success) {
      setWatchLists((wls) =>
        wls.map((wl) => (wl.creatorId === creatorId ? { ...wl, monthlyBudgetGbp: budget } : wl))
      )
      setEditingBudget((e) => ({ ...e, [creatorId]: null }))
    } else {
      setBudgetError((e) => ({ ...e, [creatorId]: result.error }))
    }
    setSavingBudget((s) => ({ ...s, [creatorId]: false }))
  }

  const stale = isStale(priceTimestamp)

  return (
    <div className="space-y-6">
      {/* Heading row */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Watch List</h2>
        <button
          onClick={handleRefreshPrices}
          disabled={refreshing}
          className="bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold rounded-md px-4 min-h-[44px] disabled:opacity-75 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center gap-2"
        >
          {refreshing ? <SpinnerSVG /> : 'Refresh Prices'}
        </button>
      </div>

      {/* Price error banner */}
      {priceError && (
        <p role="alert" aria-live="assertive" className="text-sm text-red-400">{priceError}</p>
      )}

      {/* Empty state */}
      {watchLists.length === 0 && (
        <div className="text-center py-12">
          <p className="text-base font-semibold text-white mb-2">No creators tracked</p>
          <p className="text-sm text-zinc-400">
            Go to the Creators tab to track a creator, then refresh them to generate picks.
          </p>
        </div>
      )}

      {/* Merged ticker list */}
      {watchLists.length > 0 && (() => {
        const merged = buildMergedWatchList(watchLists.filter(wl => wl.hasProfile))
        if (merged.length === 0) return null
        return (
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
            <p className="text-xl font-semibold text-white">All Picks</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs font-semibold text-zinc-500 uppercase tracking-wide border-b border-white/10">
                    <th className="py-2 pr-2">Holding</th>
                    <th className="py-2 pr-2 w-20">Conviction</th>
                    <th className="py-2 pr-2 w-22">Signal</th>
                    <th className="py-2 pr-2 w-18 text-right">Price</th>
                    <th className="py-2">Creators</th>
                  </tr>
                </thead>
                <tbody>
                  {merged.map((item) => {
                    const price = prices[item.ticker]
                    return (
                      <tr key={item.ticker} className="border-b border-white/5 last:border-0">
                        <td className="py-2 pr-2">
                          <p className="text-base font-semibold text-white">{item.ticker}</p>
                          <p className="text-xs text-zinc-400">{item.name}</p>
                        </td>
                        <td className="py-2 pr-2">
                          <span className={CONVICTION_CLASS[item.conviction]}>
                            {CONVICTION_LABEL[item.conviction]}
                          </span>
                        </td>
                        <td className="py-2 pr-2">
                          {item.layer === 'stable'
                            ? <span className="text-xs text-zinc-500">Established</span>
                            : <span className="text-xs text-amber-400">This Month</span>
                          }
                        </td>
                        <td className="py-2 pr-2 text-right">
                          {price !== undefined ? (
                            <span className={stale ? 'text-sm text-amber-400' : 'text-sm text-white'}>
                              £{price.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-zinc-500" aria-label="Price not available">—</span>
                          )}
                        </td>
                        <td className="py-2">
                          <p className="text-xs text-zinc-400">{item.creators.join(', ')}</p>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}

      {/* Per-creator sections */}
      {watchLists.length > 0 && (
        <motion.div variants={sectionVariants} initial="hidden" animate="visible" className="space-y-4">
          <AnimatePresence>
            {watchLists.map((wl) => {
              const isEditing = editingBudget[wl.creatorId] !== undefined && editingBudget[wl.creatorId] !== null
              const editVal = editingBudget[wl.creatorId] ?? wl.monthlyBudgetGbp
              const isSaving = savingBudget[wl.creatorId] ?? false
              const bError = budgetError[wl.creatorId] ?? null
              const inputId = `budget-${wl.creatorId}`

              return (
                <motion.div
                  key={wl.creatorId}
                  variants={itemVariants}
                  className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4 space-y-3"
                >
                  {/* Creator header row */}
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <p className="text-xl font-semibold text-white">{wl.creatorName}</p>

                    {/* Budget display / edit */}
                    <div className="flex flex-col items-end gap-1">
                      {!isEditing ? (
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-zinc-400">£{wl.monthlyBudgetGbp} / month</span>
                          <button
                            onClick={() => setEditingBudget((e) => ({ ...e, [wl.creatorId]: wl.monthlyBudgetGbp }))}
                            className="text-sm font-semibold text-zinc-400 hover:text-white border border-zinc-700 rounded-md px-3 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            Edit
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <label htmlFor={inputId} className="sr-only">
                            Monthly budget for {wl.creatorName} in pounds
                          </label>
                          <span className="text-sm text-zinc-400">£</span>
                          <input
                            id={inputId}
                            type="number"
                            min="0"
                            max="20000"
                            step="10"
                            value={editVal ?? 0}
                            onChange={(e) =>
                              setEditingBudget((prev) => ({
                                ...prev,
                                [wl.creatorId]: Number(e.target.value),
                              }))
                            }
                            className="w-28 bg-zinc-900 border border-zinc-700 rounded-md text-base text-white px-3 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            aria-label={`Monthly budget for ${wl.creatorName} in pounds`}
                          />
                          <button
                            onClick={() => handleSaveBudget(wl.creatorId)}
                            disabled={isSaving}
                            className="text-sm font-semibold bg-indigo-500 hover:bg-indigo-400 text-white rounded-md px-3 min-h-[44px] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            {isSaving ? 'Saving…' : 'Save Budget'}
                          </button>
                          <button
                            onClick={() => setEditingBudget((e) => ({ ...e, [wl.creatorId]: null }))}
                            className="text-sm text-zinc-400 hover:text-white border border-zinc-700 rounded-md px-3 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            Discard Changes
                          </button>
                        </div>
                      )}
                      {bError && (
                        <p role="alert" aria-live="polite" className="text-sm text-red-400">{bError}</p>
                      )}
                    </div>
                  </div>

                  {/* No profile state */}
                  {!wl.hasProfile && (
                    <p className="text-sm text-zinc-500 text-center py-4">
                      Refresh this creator to generate picks
                    </p>
                  )}

                  {/* Has profile but no tickers */}
                  {wl.hasProfile && wl.items.length === 0 && (
                    <p className="text-sm text-zinc-500 text-center py-4">
                      This creator has not cited specific tickers recently
                    </p>
                  )}

                  {/* Ticker table */}
                  {wl.hasProfile && wl.items.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-xs font-semibold text-zinc-500 uppercase tracking-wide border-b border-white/10">
                            <th className="py-2 pr-2">Holding</th>
                            <th className="py-2 pr-2 w-20">Conviction</th>
                            <th className="py-2 pr-2 w-22">Signal</th>
                            <th className="py-2 pr-2 w-18 text-right">Price</th>
                            <th className="py-2 pr-2 w-12 text-right">Qty</th>
                            <th className="py-2 w-16 text-right">Spend</th>
                          </tr>
                        </thead>
                        <tbody>
                          {wl.items.map((item, idx) => {
                            const price = prices[item.ticker]
                            const budget = new Decimal(wl.monthlyBudgetGbp)
                            const qtyResult =
                              price !== undefined && budget.greaterThan(0)
                                ? calcShareQuantity(budget, new Decimal(price))
                                : null

                            return (
                              <tr key={`${item.ticker}-${idx}`} className="border-b border-white/5 last:border-0">
                                <td className="py-2 pr-2">
                                  <p className="text-base font-semibold text-white">{item.ticker}</p>
                                  <p className="text-xs text-zinc-400">{item.name}</p>
                                </td>
                                <td className="py-2 pr-2">
                                  <span className={CONVICTION_CLASS[item.conviction]}>
                                    {CONVICTION_LABEL[item.conviction]}
                                  </span>
                                </td>
                                <td className="py-2 pr-2">
                                  {item.layer === 'stable' ? (
                                    <span className="text-xs text-zinc-500">Established</span>
                                  ) : (
                                    <span className="text-xs text-amber-400">This Month</span>
                                  )}
                                </td>
                                <td className="py-2 pr-2 text-right">
                                  {price !== undefined ? (
                                    <span
                                      className={stale ? 'text-sm text-amber-400' : 'text-sm text-white'}
                                      title={
                                        stale && priceTimestamp
                                          ? `As of ${priceTimestamp.toLocaleString()} — refresh to update`
                                          : undefined
                                      }
                                    >
                                      £{price.toFixed(2)}
                                    </span>
                                  ) : (
                                    <span className="text-zinc-500" aria-label="Price not available">—</span>
                                  )}
                                </td>
                                <td className="py-2 pr-2 text-right">
                                  {qtyResult ? (
                                    <span className="text-sm font-semibold text-white">
                                      {qtyResult.quantity.toFixed(0)}
                                    </span>
                                  ) : (
                                    <span className="text-zinc-500" aria-label="Price needed to calculate quantity">—</span>
                                  )}
                                </td>
                                <td className="py-2 text-right">
                                  {qtyResult ? (
                                    <span className="text-xs text-zinc-400">£{qtyResult.spent.toFixed(2)}</span>
                                  ) : (
                                    <span className="text-zinc-500">—</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Disclaimer footer */}
      <p className="text-xs text-zinc-500">
        Watch list picks are derived from creator content and are not financial advice. Always do your own research.
      </p>
    </div>
  )
}
