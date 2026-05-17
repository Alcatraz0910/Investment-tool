'use client'
import { useState, useTransition, useActionState, startTransition } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { AssetCategory } from '@/types'
import { HoldingModal } from '@/components/HoldingModal'
import ImportCSVModal from '@/components/ImportCSVModal'
import { TradingViewWidget } from '@/components/TradingViewWidget'
import { deleteHolding, updateMonthlyBudget, refreshHoldingPrices } from '@/app/dashboard/actions'
import { setFillTicker, clearFillTicker } from '@/app/dashboard/plan-actions'

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
  const [expandedChartId, setExpandedChartId] = useState<string | null>(null)
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
      if (result.error) setPriceError(result.error)
    })
  }

  const budget = profile?.monthlyBudget ?? 0

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
              className="w-32 px-3 py-1 min-h-[44px] bg-zinc-900 border border-zinc-700 rounded-md text-base text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {budgetState?.error && (
              <p role="alert" aria-live="polite" className="text-sm text-red-400">
                {budgetState.error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={budgetPending}
                className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-md px-3 py-1 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {budgetPending ? 'Saving...' : 'Save Budget'}
              </button>
              <button
                type="button"
                onClick={() => setBudgetEditMode(false)}
                className="border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white text-sm font-semibold rounded-md px-3 py-1 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="text-base text-white">
              Monthly budget: <span className="font-semibold">£{budget.toFixed(2)}</span>
            </p>
            <button
              type="button"
              onClick={() => setBudgetEditMode(true)}
              className="text-sm font-semibold text-zinc-400 hover:text-white border border-zinc-700 rounded-md px-3 py-1 hover:bg-zinc-700 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Edit
            </button>
          </>
        )}
      </div>

      {/* Holdings list header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">Holdings</h2>
        <div className="flex items-center gap-2">
          {/* "Import CSV" button — ghost style matching UI-SPEC */}
          <button
            type="button"
            onClick={() => setImportModalOpen(true)}
            className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-zinc-300 hover:text-white hover:border-zinc-500 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Import CSV
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold rounded-md px-4 py-2 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Add Holding
          </button>
          <button
            type="button"
            onClick={handleRefreshPrices}
            disabled={isPriceRefreshing}
            className="bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold rounded-md px-3 min-h-[44px] disabled:opacity-75 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label={isPriceRefreshing ? 'Refreshing prices...' : undefined}
          >
            {isPriceRefreshing ? (
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
        <ul>
          {holdings.map((holding) => (
            <li
              key={holding.id}
              className="border-b border-zinc-700/50"
            >
              {deleteConfirmId === holding.id ? (
                // Inline delete confirmation
                <div className="flex items-center gap-3 flex-1 flex-wrap py-3 px-2 hover:bg-zinc-700/30 rounded-lg">
                  <span className="text-sm text-white">
                    Delete {holding.ticker}?
                  </span>
                  <span className="text-sm text-zinc-400">
                    This will remove {holding.ticker} from your portfolio.
                  </span>
                  {deleteState?.error && (
                    <span role="alert" aria-live="polite" className="text-sm text-red-400">
                      {deleteState.error}
                    </span>
                  )}
                  <div className="flex gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => handleDelete(holding.id)}
                      disabled={isPending}
                      className="text-sm font-semibold text-red-400 hover:text-red-300 disabled:opacity-60 min-h-[44px] px-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
                    >
                      {isPending ? 'Deleting...' : 'Confirm'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDeleteConfirmId(null); setDeleteState({}) }}
                      className="text-sm font-semibold text-zinc-400 hover:text-white min-h-[44px] px-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between py-3 hover:bg-zinc-700/30 rounded-lg px-2">
                    <span className="flex-1 min-w-0">
                      <span className="text-base font-semibold text-white">{holding.ticker}</span>
                      {holding.name && <span className="block text-xs text-zinc-400 truncate">{holding.name}</span>}
                    </span>
                    <span className="text-sm text-zinc-400 w-20 text-right">{holding.quantity.toFixed(2)}</span>
                    <span className="text-sm text-white w-24 text-right">£{holding.currentValue.toFixed(2)}</span>
                    <span className="text-sm text-zinc-400 w-32 text-right">{holding.category}</span>

                    {/* Price cell — always rendered (D-08: no layout shift) */}
                    <span className="text-sm w-24 text-right">
                      {holding.currentPrice !== null ? (
                        <span className="text-white">£{holding.currentPrice.toFixed(2)}</span>
                      ) : (
                        <span className="text-zinc-500" aria-label="Price not available">—</span>
                      )}
                    </span>

                    {/* As-of timestamp cell */}
                    <span className="text-xs w-32 text-right">
                      {holding.priceFetchedAt ? (
                        <span
                          className={
                            Date.now() - new Date(holding.priceFetchedAt).getTime() > 24 * 60 * 60 * 1000
                              ? 'text-amber-400'
                              : 'text-zinc-400'
                          }
                        >
                          {new Date(holding.priceFetchedAt).toLocaleString('en-GB')}
                        </span>
                      ) : null}
                    </span>

                    <div className="flex gap-2 ml-4 items-center">
                      {/* Chart toggle button */}
                      <button
                        type="button"
                        onClick={() => setExpandedChartId(expandedChartId === holding.id ? null : holding.id)}
                        className={`min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded ${
                          expandedChartId === holding.id ? 'text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                        aria-label={
                          expandedChartId === holding.id
                            ? `Hide chart for ${holding.ticker}`
                            : `Show chart for ${holding.ticker}`
                        }
                        aria-expanded={expandedChartId === holding.id}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <polyline
                            points="1,12 5,7 9,9 15,3"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetFillTicker(holding.id, holding.category, holding.isFillTicker)}
                        disabled={isPending}
                        aria-label={holding.isFillTicker ? 'Preferred buy target for this category' : 'Mark as preferred buy target'}
                        title={holding.isFillTicker ? 'Preferred buy target for this category' : 'Mark as preferred buy target'}
                        className={`text-lg min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded disabled:opacity-60 disabled:cursor-not-allowed ${holding.isFillTicker ? 'text-indigo-400 hover:text-indigo-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        {holding.isFillTicker ? '★' : '☆'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(holding)}
                        className="text-sm font-semibold text-indigo-400 hover:text-indigo-300 min-h-[44px] px-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(holding.id)}
                        className="text-sm font-semibold text-red-400 hover:text-red-300 min-h-[44px] px-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Animated chart panel */}
                  <AnimatePresence>
                    {expandedChartId === holding.id && (
                      <motion.div
                        key={`chart-${holding.id}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        style={{ overflow: 'hidden' }}
                        className="pt-2 pb-4 px-4"
                      >
                        <TradingViewWidget symbol={`LSE:${holding.ticker}`} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </li>
          ))}
        </ul>
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
