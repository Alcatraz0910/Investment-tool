'use client'
import { useState, useTransition, useActionState, startTransition } from 'react'
import type { AssetCategory } from '@/types'
import { HoldingModal } from '@/components/HoldingModal'
import { deleteHolding, updateMonthlyBudget } from '@/app/dashboard/actions'
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
  category: AssetCategory
  quantity: number
  currentValue: number
  isFillTicker: boolean
  createdAt: Date
  updatedAt: Date
}

interface PortfolioTabProps {
  profile: ClientProfile | null
  holdings: ClientHolding[]
}

export function PortfolioTab({ profile, holdings }: PortfolioTabProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingHolding, setEditingHolding] = useState<ClientHolding | undefined>(undefined)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [budgetEditMode, setBudgetEditMode] = useState(false)
  const [isPending, startT] = useTransition()

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
        <button
          type="button"
          onClick={openAddModal}
          className="bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold rounded-md px-4 py-2 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          Add Holding
        </button>
      </div>

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
              className="flex items-center justify-between py-3 border-b border-zinc-700/50 hover:bg-zinc-700/30 rounded-lg px-2"
            >
              {deleteConfirmId === holding.id ? (
                // Inline delete confirmation
                <div className="flex items-center gap-3 flex-1 flex-wrap">
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
                  <span className="text-base font-semibold text-white flex-1">{holding.ticker}</span>
                  <span className="text-sm text-zinc-400 w-20 text-right">{holding.quantity.toFixed(2)}</span>
                  <span className="text-sm text-white w-24 text-right">£{holding.currentValue.toFixed(2)}</span>
                  <span className="text-sm text-zinc-400 w-32 text-right">{holding.category}</span>
                  <div className="flex gap-2 ml-4 items-center">
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
    </div>
  )
}
