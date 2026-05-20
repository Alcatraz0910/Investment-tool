'use client'
import { useState, useTransition, useActionState, startTransition } from 'react'
import type { AssetCategory } from '@/types'
import { HoldingModal } from '@/components/HoldingModal'
import ImportCSVModal from '@/components/ImportCSVModal'
import { deleteHolding, updateMonthlyBudget, refreshHoldingPrices } from '@/app/dashboard/actions'
import { setFillTicker, clearFillTicker } from '@/app/dashboard/plan-actions'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { StatTile } from '@/components/ui/StatTile'

// Plain-number versions of domain types for the RSC→client boundary
interface ClientProfile {
  id: string
  email: string
  monthlyBudget: number
  createdAt: Date
  updatedAt: Date
}

interface ClientHolding {
  id: string
  userId: string
  ticker: string
  name?: string
  category: AssetCategory
  quantity: number
  currentValue: number
  isFillTicker: boolean
  currentPrice: number | null      // null = never fetched
  priceFetchedAt: string | null     // ISO string; null = never fetched
  createdAt: Date
  updatedAt: Date
}

interface PortfolioTabProps {
  profile: ClientProfile | null
  holdings: ClientHolding[]
}

export function PortfolioTab({ profile, holdings }: PortfolioTabProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [editingHolding, setEditingHolding] = useState<ClientHolding | undefined>(undefined)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [budgetEditMode, setBudgetEditMode] = useState(false)
  const [isPending, startT] = useTransition()

  // Phase 8: price refresh state
  const [priceError, setPriceError] = useState<string | null>(null)
  const [isPriceRefreshing, startPriceTransition] = useTransition()

  const [budgetState, budgetAction, budgetPending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      const result = await updateMonthlyBudget(formData)
      if (!result.error) setBudgetEditMode(false)
      return result
    },
    {}
  )

  const [deleteState, setDeleteState] = useState<{ error?: string }>({})
  const [fillTickerState, setFillTickerState] = useState<{ error?: string }>({})

  function openAddModal() {
    setEditingHolding(undefined)
    setModalOpen(true)
  }

  function openEditModal(holding: ClientHolding) {
    setEditingHolding(holding)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingHolding(undefined)
  }

  function handleSetFillTicker(holdingId: string, category: AssetCategory, isCurrentlyFilled: boolean) {
    setFillTickerState({})
    startT(async () => {
      const result = isCurrentlyFilled
        ? await clearFillTicker(holdingId)
        : await setFillTicker(holdingId, category)
      if (result.error) {
        setFillTickerState({ error: result.error })
      }
    })
  }

  async function handleDelete(holdingId: string) {
    startT(async () => {
      const result = await deleteHolding(holdingId)
      if (result.error) {
        setDeleteState({ error: result.error })
      } else {
        setDeleteConfirmId(null)
        setDeleteState({})
      }
    })
  }

  function handleRefreshPrices() {
    setPriceError(null)
    startPriceTransition(async () => {
      const result = await refreshHoldingPrices()
      if (result.error) {
        setPriceError(result.error)
      } else if (result.results) {
        const failed = result.results.filter(r => r.price === null).map(r => r.ticker)
        if (failed.length > 0) {
          setPriceError(`Could not fetch prices for: ${failed.join(', ')}`)
        }
      }
    })
  }

  const budget = profile?.monthlyBudget ?? 0
  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0)

  return (
    <div>
      {/* Monthly Budget Banner */}
      <div className="flex items-center justify-between py-3 mb-4 border-b border-zinc-700">
        {budgetEditMode ? (
          <form
            action={(formData) => startTransition(() => budgetAction(formData))}
            className="flex items-center gap-3 flex-1"
          >
            <label htmlFor="monthlyBudget" className="text-base text-white whitespace-nowrap">
              Monthly budget: £
            </label>
            <input
              id="monthlyBudget"
              name="monthlyBudget"
              type="number"
              step="0.01"
              min="0"
              defaultValue={budget.toString()}
              autoFocus
              className="w-32 px-3 py-1 min-h-[44px] bg-zinc-900 border border-zinc-700 rounded-md text-base text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {budgetState?.error && (
              <p role="alert" aria-live="polite" className="text-sm text-red-400">
                {budgetState.error}
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="primary" size="sm" type="submit" disabled={budgetPending}>
                {budgetPending ? 'Saving...' : 'Save Budget'}
              </Button>
              <Button variant="ghost" size="sm" type="button" onClick={() => setBudgetEditMode(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <>
            <p className="text-base text-white">
              Monthly budget: <span className="font-semibold">£{budget.toFixed(2)}</span>
            </p>
            <Button variant="ghost" size="sm" onClick={() => setBudgetEditMode(true)}>
              Edit
            </Button>
          </>
        )}
      </div>

      {/* Portfolio total */}
      <StatTile
        label="Portfolio Value"
        value={`£${totalValue.toFixed(2)}`}
        animate={true}
        className="mb-4"
      />

      {/* Holdings list header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">Holdings</h2>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setImportModalOpen(true)}>Import CSV</Button>
          <Button variant="primary" onClick={openAddModal}>Add Holding</Button>
          <Button variant="primary" loading={isPriceRefreshing} onClick={handleRefreshPrices}>
            {isPriceRefreshing ? 'Refreshing…' : 'Refresh Prices'}
          </Button>
        </div>
      </div>

      {/* Price error display */}
      {priceError && (
        <p role="alert" aria-live="assertive" className="text-sm text-red-400 mt-1 mb-2">
          {priceError}
        </p>
      )}

      {/* Holdings list */}
      {holdings.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-zinc-400 text-sm font-semibold">No holdings yet</p>
          <p className="text-zinc-400 text-sm mt-1">Add your first holding to start tracking your portfolio.</p>
        </div>
      ) : (
        <>
          {/* Mobile mini-card list (< 640px) */}
          <div className="sm:hidden space-y-3">
            {holdings.map((holding) => {
              const isStale = holding.priceFetchedAt
                ? Date.now() - new Date(holding.priceFetchedAt).getTime() > 24 * 60 * 60 * 1000
                : false

              return (
                <div
                  key={holding.id}
                  className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-3"
                  style={{ WebkitBackdropFilter: 'blur(24px)' }}
                >
                  {/* Row 1: ticker */}
                  <div className="flex items-start justify-between">
                    <span className="text-base font-semibold font-mono text-white">{holding.ticker}</span>
                  </div>
                  {/* Row 2: holding name */}
                  {holding.name && (
                    <p className="text-xs text-zinc-400 mt-0.5">{holding.name}</p>
                  )}
                  {/* Row 3: units + value */}
                  <p className="text-sm text-zinc-400 font-mono mt-1">
                    Units: {holding.quantity.toFixed(2)} | Value: £{holding.currentValue.toFixed(2)}
                  </p>
                  {/* Row 4: price (amber if stale) */}
                  {holding.currentPrice !== null && (
                    <p className={`text-sm font-semibold font-mono mt-0.5 ${isStale ? 'text-amber-400' : 'text-zinc-300'}`}>
                      Price: £{holding.currentPrice.toFixed(2)}
                    </p>
                  )}
                  {/* Row 5: icon-only action row */}
                  <div className="flex gap-2 mt-3">
                    {/* Chart — TradingView link (matches desktop pattern) */}
                    <a
                      href={`https://www.tradingview.com/chart/?symbol=${holding.ticker}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`View ${holding.ticker} chart on TradingView`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-accent rounded"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <polyline points="1,12 5,7 9,9 15,3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </a>
                    {/* Star / fill-ticker toggle */}
                    <button
                      type="button"
                      aria-label={`Toggle ${holding.ticker} star`}
                      onClick={() => handleSetFillTicker(holding.id, holding.category, holding.isFillTicker)}
                      disabled={isPending}
                      className={`min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-accent rounded disabled:opacity-60 disabled:cursor-not-allowed ${holding.isFillTicker ? 'text-indigo-400 hover:text-indigo-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      <span aria-hidden="true">{holding.isFillTicker ? '★' : '☆'}</span>
                    </button>
                    {/* Edit */}
                    <button
                      type="button"
                      aria-label={`Edit ${holding.ticker} holding`}
                      onClick={() => openEditModal(holding)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-accent rounded"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    {/* Delete */}
                    <button
                      type="button"
                      aria-label={`Remove ${holding.ticker} holding`}
                      onClick={() => setDeleteConfirmId(holding.id)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-red-400 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-accent rounded"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop holdings table (>= 640px) */}
          <table className="hidden sm:table w-full border-collapse">
          <thead>
            <tr className="border-b border-zinc-700/50">
              <th className="text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide py-2 px-2">Holding</th>
              <th className="text-right text-xs font-semibold text-zinc-500 uppercase tracking-wide py-2 px-2">Units</th>
              <th className="text-right text-xs font-semibold text-zinc-500 uppercase tracking-wide py-2 px-2">Value</th>
              <th className="text-right text-xs font-semibold text-zinc-500 uppercase tracking-wide py-2 px-2">Type</th>
              <th className="text-right text-xs font-semibold text-zinc-500 uppercase tracking-wide py-2 px-2">Price</th>
              <th />
            </tr>
          </thead>
          <tbody>
          {holdings.map((holding) => (
            <tr
              key={holding.id}
              className="border-b border-zinc-700/50 hover:bg-zinc-700/30"
            >
              {deleteConfirmId === holding.id ? (
                <td colSpan={6} className="py-3 px-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-white">Delete {holding.ticker}?</span>
                    <span className="text-sm text-zinc-400">This will remove {holding.ticker} from your portfolio.</span>
                    {deleteState?.error && (
                      <span role="alert" aria-live="polite" className="text-sm text-red-400">{deleteState.error}</span>
                    )}
                    <div className="flex gap-2 ml-auto">
                      <button
                        type="button"
                        onClick={() => handleDelete(holding.id)}
                        disabled={isPending}
                        className="text-sm font-semibold text-red-400 hover:text-red-300 disabled:opacity-60 min-h-[44px] px-2 focus:outline-none focus:ring-2 focus:ring-accent rounded"
                      >
                        {isPending ? 'Deleting...' : 'Confirm'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDeleteConfirmId(null); setDeleteState({}) }}
                        className="text-sm font-semibold text-zinc-400 hover:text-white min-h-[44px] px-2 focus:outline-none focus:ring-2 focus:ring-accent rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </td>
              ) : (
                <>
                  <td className="py-3 px-2">
                    <span className="text-base font-semibold text-white">{holding.ticker}</span>
                    {holding.name && <span className="block text-xs text-zinc-400">{holding.name}</span>}
                  </td>
                  <td className="py-3 px-2 text-sm text-zinc-400 text-right whitespace-nowrap">{holding.quantity.toFixed(2)}</td>
                  <td className="py-3 px-2 text-sm text-white text-right whitespace-nowrap">£{holding.currentValue.toFixed(2)}</td>
                  <td className="py-3 px-2 text-sm text-zinc-400 text-right whitespace-nowrap">{holding.category}</td>
                  <td className="py-3 px-2 text-sm text-right whitespace-nowrap">
                    {holding.currentPrice !== null ? (
                      <span
                        className={
                          holding.priceFetchedAt &&
                          Date.now() - new Date(holding.priceFetchedAt).getTime() > 24 * 60 * 60 * 1000
                            ? 'text-amber-400'
                            : 'text-white'
                        }
                        title={holding.priceFetchedAt
                          ? `As of ${new Date(holding.priceFetchedAt).toLocaleString('en-GB')}`
                          : undefined}
                      >
                        £{holding.currentPrice.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-zinc-500" aria-label="Price not available">—</span>
                    )}
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex gap-2 items-center justify-end">
                      <a
                        href={`https://www.tradingview.com/chart/?symbol=${holding.ticker}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-500 hover:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-accent rounded"
                        aria-label={`View ${holding.ticker} chart on TradingView`}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <polyline points="1,12 5,7 9,9 15,3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleSetFillTicker(holding.id, holding.category, holding.isFillTicker)}
                        disabled={isPending}
                        aria-label={holding.isFillTicker ? 'Preferred buy target for this category' : 'Mark as preferred buy target'}
                        title={holding.isFillTicker ? 'Preferred buy target for this category' : 'Mark as preferred buy target'}
                        className={`text-lg min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-accent rounded disabled:opacity-60 disabled:cursor-not-allowed ${holding.isFillTicker ? 'text-indigo-400 hover:text-indigo-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        {holding.isFillTicker ? '★' : '☆'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(holding)}
                        className="text-sm font-semibold text-indigo-400 hover:text-indigo-300 min-h-[44px] px-2 focus:outline-none focus:ring-2 focus:ring-accent rounded"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(holding.id)}
                        className="text-sm font-semibold text-red-400 hover:text-red-300 min-h-[44px] px-2 focus:outline-none focus:ring-2 focus:ring-accent rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </>
              )}
            </tr>
          ))}
          </tbody>
        </table>
        </>
      )}

      {/* Fill-ticker error */}
      {fillTickerState.error && (
        <p role="alert" aria-live="polite" className="mt-2 text-sm text-red-400">
          {fillTickerState.error}
        </p>
      )}

      {/* Holding modal (add/edit) */}
      <HoldingModal
        isOpen={modalOpen}
        onClose={closeModal}
        holding={editingHolding}
      />

      {/* Import CSV modal */}
      {importModalOpen && (
        <ImportCSVModal
          onClose={() => setImportModalOpen(false)}
          existingTickers={new Set(holdings.map(h => h.ticker))}
        />
      )}
    </div>
  )
}
