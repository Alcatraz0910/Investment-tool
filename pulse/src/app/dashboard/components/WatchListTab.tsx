'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Decimal } from 'decimal.js'
import { fetchTickerPrices } from '@/app/dashboard/actions'
import { saveCreatorMonthlyBudget } from '@/app/dashboard/watchlist-actions'
import { refreshNewsAndSummary } from '@/app/dashboard/news-actions'
import { calcShareQuantity, buildMergedWatchList } from '@/lib/watchlist/generator'
import type { CreatorWatchList, WatchListItem, MergedWatchListItem } from '@/lib/watchlist/generator'
import type { NewsCacheContext, NewsContextResult } from '@/lib/news/news-types'
import { runContradictionCheck } from '@/lib/strategy/contradiction'
import type { CreatorProfile } from '@/lib/strategy/extractor'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface WatchListTabProps {
  initialWatchLists: CreatorWatchList[]
  userCreatorIdMap: Record<string, string>
  initialNewsContext: NewsCacheContext
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

function tradingViewUrl(ticker: string, currency: string): string {
  if (currency === 'GBp' || currency === 'GBP') {
    return `https://www.tradingview.com/chart/?symbol=LSE:${ticker}`
  }
  return `https://www.tradingview.com/chart/?symbol=${ticker}`
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / (60 * 1000))
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000))
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
}

function isNewsStale(date: Date | null): boolean {
  if (!date) return false
  return Date.now() - date.getTime() > 24 * 60 * 60 * 1000
}

type SentimentTrend = 'bullish' | 'cautious' | null

function computeSentimentTrend(
  stable: CreatorProfile,
  latest: CreatorProfile | null,
): SentimentTrend {
  if (!latest) return null
  let towardBullish = 0
  let towardCautious = 0
  const latestMap = new Map(
    latest.sector_focus.map((s) => [s.sector.toLowerCase(), s.stance]),
  )
  for (const sf of stable.sector_focus) {
    const latestStance = latestMap.get(sf.sector.toLowerCase())
    if (!latestStance) continue  // D-11: unmatched sectors ignored
    if (sf.stance !== 'bullish' && latestStance === 'bullish') towardBullish++
    if (sf.stance !== 'cautious' && latestStance === 'cautious') towardCautious++
  }
  if (towardBullish > towardCautious) return 'bullish'
  if (towardCautious > towardBullish) return 'cautious'
  return null  // mixed, tied, or unchanged — no badge
}

function ExternalLinkIcon() {
  return (
    <svg className="inline-block ml-1 w-3 h-3 opacity-50" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V7M7 1h4m0 0v4m0-4L5 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function WatchListTab({ initialWatchLists, userCreatorIdMap, initialNewsContext }: WatchListTabProps) {
  const router = useRouter()
  const shouldReduceMotion = useReducedMotion()

  const [watchLists, setWatchLists] = useState<CreatorWatchList[]>(initialWatchLists)
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [prevPrices, setPrevPrices] = useState<Record<string, number>>({})
  const [currencies, setCurrencies] = useState<Record<string, string>>({})
  const [priceTimestamp, setPriceTimestamp] = useState<Date | null>(null)
  const [priceError, setPriceError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Record<string, number | null>>({})
  const [savingBudget, setSavingBudget] = useState<Record<string, boolean>>({})
  const [budgetError, setBudgetError] = useState<Record<string, string | null>>({})

  // News context state (D-01, D-05)
  const [newsContext, setNewsContext] = useState<NewsCacheContext>(initialNewsContext)
  const [newsRefreshing, setNewsRefreshing] = useState(false)
  const [newsError, setNewsError] = useState<string | null>(null)
  const [isContextExpanded, setIsContextExpanded] = useState(true) // D-05: expanded by default
  // Mobile expand toggle per-creator (15-05: MOB-01)
  const [tickersExpanded, setTickersExpanded] = useState<Record<string, boolean>>({})

  const stale = isStale(priceTimestamp)

  // Stagger variants — useReducedMotion guard (15-UI-SPEC.md §3)
  const sectionVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: shouldReduceMotion ? 0 : 0.07 } },
  }
  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 8 },
    visible: { opacity: 1, y: 0, transition: { duration: shouldReduceMotion ? 0 : 0.25, ease: 'easeOut' as const } },
  }

  const getPriceChangePct = (ticker: string): number | null => {
    const curr = prices[ticker]
    const prev = prevPrices[ticker]
    if (curr === undefined || prev === undefined || prev === 0) return null
    return ((curr - prev) / prev) * 100
  }

  const getPriceColorClass = (ticker: string): string => {
    const pct = getPriceChangePct(ticker)
    if (pct === null) return stale ? 'text-amber-400' : 'text-white'
    if (pct > 0) return 'text-green-400'
    if (pct < 0) return 'text-red-400'
    return stale ? 'text-amber-400' : 'text-white'
  }

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
    setPrevPrices(prices)
    setPrices(validPrices)
    setCurrencies(result.currencies ?? {})
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
    if (!userCreatorId) {
      setBudgetError((e) => ({ ...e, [creatorId]: 'Creator not found — please refresh the page.' }))
      setSavingBudget((s) => ({ ...s, [creatorId]: false }))
      return
    }
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

  const handleRefreshNews = async () => {
    setNewsRefreshing(true)
    setNewsError(null)
    const allTickers = watchLists.flatMap((wl) => wl.items.map((i) => i.ticker))
    const uniqueTickers = [...new Set(allTickers)]
    const sectors = initialNewsContext.creatorSectors ?? []

    const result = await refreshNewsAndSummary(uniqueTickers, sectors)

    if (result.success) {
      setNewsContext((prev) => ({
        ...prev,
        contextSummary: result.data.context_summary,
        tickerCounts: result.data.ticker_counts,
        macroThemes: result.data.macro_themes,
        newsLastFetchedAt: new Date(),
      }))
      router.refresh()
    } else {
      setNewsError(result.error)
    }
    setNewsRefreshing(false)
  }

  const newsStale = isNewsStale(newsContext.newsLastFetchedAt)

  return (
    <div className="space-y-6">
      {/* Heading row */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Watch List</h2>
        <Button
          variant="primary"
          onClick={handleRefreshPrices}
          disabled={refreshing || newsRefreshing}
          loading={refreshing}
        >
          Refresh Prices
        </Button>
      </div>

      {/* "This Month's Context" panel (NEWS-06, D-01, D-05) — not wrapped in hover lift */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
        {/* Panel header row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-white">This Month's Context</span>
            {newsContext.newsLastFetchedAt && (
              <span
                className={`text-xs ${newsStale ? 'text-amber-400' : 'text-zinc-500'}`}
                aria-label={newsStale ? 'News data is more than 24 hours old' : undefined}
              >
                Last updated: {formatRelativeTime(newsContext.newsLastFetchedAt)}
                {newsStale ? ' — stale' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={handleRefreshNews}
              disabled={newsRefreshing || refreshing}
              loading={newsRefreshing}
            >
              Refresh News
            </Button>
            <button
              onClick={() => setIsContextExpanded((v) => !v)}
              aria-expanded={isContextExpanded}
              aria-controls="news-context-body"
              className="p-1 focus:outline-none focus:ring-2 focus:ring-accent rounded"
            >
              <svg
                className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${isContextExpanded ? 'rotate-180' : ''}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Panel body — collapsible */}
        <div
          id="news-context-body"
          role="region"
          aria-label="This month's market context summary"
          className={`overflow-hidden transition-all duration-200 ease-out ${isContextExpanded ? 'max-h-96' : 'max-h-0'}`}
        >
          {newsContext.contextSummary ? (
            <div className="space-y-2 pt-1">
              <p className="text-sm text-zinc-300 leading-relaxed">{newsContext.contextSummary}</p>
              <p className="text-xs text-zinc-500">
                News is sourced from public feeds and AI cross-referencing. Not financial advice.
              </p>
            </div>
          ) : (
            <p className="text-sm text-zinc-500 italic pt-1">
              No context yet — click Refresh News to generate your first summary.
            </p>
          )}
        </div>
      </div>

      {/* News refresh error banner */}
      {newsError && (
        <p role="alert" aria-live="assertive" className="text-sm text-red-400">{newsError}</p>
      )}

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

      {/* Merged ticker list — All Picks */}
      {watchLists.length > 0 && (() => {
        const merged = buildMergedWatchList(watchLists.filter(wl => wl.hasProfile))
        if (merged.length === 0) return null
        return (
          <>
            {/* All Picks mobile chip list — visible only below sm (15-05: MOB-01) */}
            <div className="flex flex-wrap gap-2 sm:hidden">
              {merged.map(item => (
                <span
                  key={item.ticker}
                  className="text-xs font-semibold font-mono text-zinc-300 bg-zinc-800/60 border border-white/10 rounded px-1.5 py-0.5"
                >
                  {item.ticker}
                </span>
              ))}
            </div>

            {/* All Picks card — desktop only */}
            <div className="hidden sm:block">
              <motion.div
                whileHover={shouldReduceMotion ? {} : { y: -3, scale: 1.01 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                style={{ willChange: 'transform' }}
              >
                <Card padding="md" className="space-y-3">
                  <p className="text-xl font-semibold text-white">All Picks</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-xs font-semibold text-zinc-500 uppercase tracking-wide border-b border-white/10">
                          <th className="py-2 pr-2">Holding</th>
                          <th className="py-2 pr-2 w-20">Conviction</th>
                          <th className="py-2 pr-2 w-22">Signal</th>
                          <th className="py-2 pr-2 w-[72px]">News</th>
                          <th className="py-2 pr-2 w-18 text-right">Price</th>
                          <th className="py-2">Creators</th>
                        </tr>
                      </thead>
                      <tbody>
                        {merged.map((item) => {
                      const price = prices[item.ticker]
                      const currency = currencies[item.ticker]
                      const changePct = getPriceChangePct(item.ticker)
                      return (
                        <tr key={item.ticker} className="border-b border-white/5 last:border-0">
                          <td className="py-2 pr-2">
                            <a
                              href={tradingViewUrl(item.ticker, currency ?? '')}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-base font-semibold text-white hover:text-indigo-300 transition-colors"
                            >
                              {item.ticker}<ExternalLinkIcon />
                            </a>
                            <p className="text-xs text-zinc-400">{item.name}</p>
                            {item.creators.length >= 2 && (
                              <Badge variant="consensus">Consensus</Badge>
                            )}
                          </td>
                          <td className="py-2 pr-2">
                            <Badge
                              variant={
                                item.conviction === 'high'
                                  ? 'high-conviction'
                                  : item.conviction === 'medium'
                                  ? 'medium-conviction'
                                  : 'low-conviction'
                              }
                            >
                              {item.conviction === 'high' ? 'High' : item.conviction === 'medium' ? 'Medium' : 'Low'}
                            </Badge>
                          </td>
                          <td className="py-2 pr-2">
                            {item.layer === 'stable'
                              ? <Badge variant="established">Established</Badge>
                              : <Badge variant="this-month">This Month</Badge>
                            }
                          </td>
                          <td className="py-2 pr-2">
                            {(() => {
                              const count = newsContext.tickerCounts[item.ticker] ?? 0
                              return count > 0 ? (
                                <Badge variant="news-count">{count} news</Badge>
                              ) : (
                                <span className="text-xs text-zinc-600" aria-label="No relevant news">—</span>
                              )
                            })()}
                          </td>
                          <td className="py-2 pr-2 text-right">
                            {price !== undefined ? (
                              <div className="flex flex-col items-end">
                                <span className={`text-sm font-semibold ${getPriceColorClass(item.ticker)}`}>
                                  {currency === 'USD' ? '$' : '£'}{price.toFixed(2)}
                                </span>
                                {changePct !== null && (
                                  <span className={`text-xs ${changePct > 0 ? 'text-green-400' : changePct < 0 ? 'text-red-400' : 'text-zinc-400'}`}>
                                    {changePct > 0 ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
                                  </span>
                                )}
                              </div>
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
                </Card>
              </motion.div>
            </div>
          </>
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
                  whileHover={shouldReduceMotion ? {} : { y: -3, scale: 1.01 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  style={{ willChange: 'transform', opacity: wl.profileLatestNull ? 0.8 : 1 }}
                >
                  <Card padding="md" className="space-y-3">
                    {/* Creator header row */}
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xl font-semibold text-white">{wl.creatorName}</p>

                        {/* SIG-04: No recent posts badge — shown when profileLatestNull */}
                        {wl.profileLatestNull && (
                          <Badge variant="no-recent-posts">No recent posts</Badge>
                        )}

                        {/* SIG-02: Sentiment trend badge — suppressed when profileLatestNull (D-03) */}
                        {!wl.profileLatestNull && wl.profileStable !== null && (() => {
                          const trend = computeSentimentTrend(wl.profileStable, wl.profileLatest)
                          if (!trend) return null
                          return trend === 'bullish' ? (
                            <Badge variant="trending-bullish">Trending bullish</Badge>
                          ) : (
                            <Badge variant="trending-cautious">Trending cautious</Badge>
                          )
                        })()}

                        {/* SIG-03: Contradiction badge — suppressed when profileLatestNull (D-04) */}
                        {!wl.profileLatestNull && wl.profileStable !== null && (() => {
                          const { hasContradiction, reason } = runContradictionCheck(wl.profileStable, wl.profileLatest)
                          if (!hasContradiction) return null
                          return (
                            <Badge variant="contradiction" title={reason ?? undefined}>Contradiction</Badge>
                          )
                        })()}
                      </div>

                      {/* Budget display / edit */}
                      <div className="flex flex-col items-end gap-1">
                        {!isEditing ? (
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-zinc-400">£{wl.monthlyBudgetGbp} / month</span>
                            <Button
                              variant="ghost"
                              onClick={() => setEditingBudget((e) => ({ ...e, [wl.creatorId]: wl.monthlyBudgetGbp }))}
                            >
                              Edit
                            </Button>
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
                              onChange={(e) => {
                                const raw = parseFloat(e.target.value)
                                const val = isNaN(raw) ? 0 : Math.min(20000, Math.max(0, raw))
                                setEditingBudget((prev) => ({ ...prev, [wl.creatorId]: val }))
                              }}
                              className="w-28 bg-zinc-900 border border-zinc-700 rounded-md text-base text-white px-3 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-accent"
                              aria-label={`Monthly budget for ${wl.creatorName} in pounds`}
                            />
                            <Button
                              variant="primary"
                              onClick={() => handleSaveBudget(wl.creatorId)}
                              disabled={isSaving}
                              loading={isSaving}
                            >
                              Save Budget
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => setEditingBudget((e) => ({ ...e, [wl.creatorId]: null }))}
                            >
                              Discard Changes
                            </Button>
                          </div>
                        )}
                        {bError && (
                          <p role="alert" aria-live="polite" className="text-sm text-red-400">{bError}</p>
                        )}
                      </div>
                    </div>

                    {/* Macro themes strip (NEWS-05) — below creator header, above ticker table */}
                    {newsContext.macroThemes.length > 0 && (
                      <div className="flex flex-nowrap sm:flex-wrap gap-2 overflow-x-auto pb-1">
                        {newsContext.macroThemes.slice(0, 3).map((theme) => (
                          <Badge
                            key={`${theme.sector}-${theme.theme}`}
                            variant="macro-theme"
                            sentimentDot={
                              theme.sentiment === 'positive'
                                ? 'positive'
                                : theme.sentiment === 'negative'
                                ? 'negative'
                                : 'neutral'
                            }
                          >
                            {theme.sector}: {theme.theme}
                          </Badge>
                        ))}
                      </div>
                    )}

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
                      <>
                        {/* Mobile summary line — visible only below sm (15-05: MOB-01) */}
                        <p className="text-sm text-zinc-400 sm:hidden">
                          Top picks: {wl.items[0]?.ticker}{wl.items[1] ? `, ${wl.items[1].ticker}` : ''}
                          {wl.items.length > 2 ? ` +${wl.items.length - 2} more` : ''}
                        </p>

                        {/* Mobile expand toggle — visible only below sm */}
                        <button
                          onClick={() => setTickersExpanded(prev => ({ ...prev, [wl.creatorId]: !prev[wl.creatorId] }))}
                          className="sm:hidden text-sm text-zinc-400 hover:text-white min-h-[44px] focus:outline-none focus:ring-2 focus:ring-accent rounded"
                          aria-expanded={tickersExpanded[wl.creatorId] ?? false}
                        >
                          {tickersExpanded[wl.creatorId] ? 'Hide picks' : 'Show all picks'}
                        </button>

                        <div className={`overflow-x-auto ${tickersExpanded[wl.creatorId] ? '' : 'hidden'} sm:block`}>
                        <table className="w-full text-left">
                          <thead>
                            <tr className="text-xs font-semibold text-zinc-500 uppercase tracking-wide border-b border-white/10">
                              <th className="py-2 pr-2">Holding</th>
                              <th className="py-2 pr-2 w-20">Conviction</th>
                              <th className="py-2 pr-2 w-22">Signal</th>
                              <th className="py-2 pr-2 w-[72px]">News</th>
                              <th className="py-2 pr-2 w-18 text-right">Price</th>
                              <th className="py-2 pr-2 w-12 text-right">Qty</th>
                              <th className="py-2 w-16 text-right">Spend</th>
                            </tr>
                          </thead>
                          <tbody>
                            {wl.items.map((item, idx) => {
                              const price = prices[item.ticker]
                              const currency = currencies[item.ticker]
                              const changePct = getPriceChangePct(item.ticker)
                              const budget = new Decimal(wl.monthlyBudgetGbp)
                              const qtyResult =
                                price !== undefined && budget.greaterThan(0)
                                  ? calcShareQuantity(budget, new Decimal(price))
                                  : null

                              return (
                                <tr key={`${item.ticker}-${idx}`} className="border-b border-white/5 last:border-0">
                                  <td className="py-2 pr-2">
                                    <a
                                      href={tradingViewUrl(item.ticker, currency ?? '')}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-base font-semibold text-white hover:text-indigo-300 transition-colors"
                                    >
                                      {item.ticker}<ExternalLinkIcon />
                                    </a>
                                    <p className="text-xs text-zinc-400">{item.name}</p>
                                  </td>
                                  <td className="py-2 pr-2">
                                    <Badge
                                      variant={
                                        item.conviction === 'high'
                                          ? 'high-conviction'
                                          : item.conviction === 'medium'
                                          ? 'medium-conviction'
                                          : 'low-conviction'
                                      }
                                    >
                                      {item.conviction === 'high' ? 'High' : item.conviction === 'medium' ? 'Medium' : 'Low'}
                                    </Badge>
                                  </td>
                                  <td className="py-2 pr-2">
                                    {item.layer === 'stable' ? (
                                      <Badge variant="established">Established</Badge>
                                    ) : (
                                      <Badge variant="this-month">This Month</Badge>
                                    )}
                                  </td>
                                  <td className="py-2 pr-2">
                                    {(() => {
                                      const count = newsContext.tickerCounts[item.ticker] ?? 0
                                      return count > 0 ? (
                                        <Badge variant="news-count">{count} news</Badge>
                                      ) : (
                                        <span className="text-xs text-zinc-600" aria-label="No relevant news">—</span>
                                      )
                                    })()}
                                  </td>
                                  <td className="py-2 pr-2 text-right">
                                    {price !== undefined ? (
                                      <div className="flex flex-col items-end">
                                        <span
                                          className={`text-sm font-semibold ${getPriceColorClass(item.ticker)}`}
                                          title={
                                            stale && priceTimestamp
                                              ? `As of ${priceTimestamp.toLocaleString()} — refresh to update`
                                              : undefined
                                          }
                                        >
                                          {currency === 'USD' ? '$' : '£'}{price.toFixed(2)}
                                        </span>
                                        {changePct !== null && (
                                          <span className={`text-xs ${changePct > 0 ? 'text-green-400' : changePct < 0 ? 'text-red-400' : 'text-zinc-400'}`}>
                                            {changePct > 0 ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
                                          </span>
                                        )}
                                      </div>
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
                      </>
                    )}
                  </Card>
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
