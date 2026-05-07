'use client'
import { useRef, useEffect, useActionState, startTransition } from 'react'
import type { Holding, AssetCategory } from '@/types'
import { addHolding, updateHolding } from '@/app/dashboard/actions'

const ASSET_CATEGORIES: AssetCategory[] = [
  'Tech', 'Dividends', 'Bonds', 'Commodities',
  'Cash', 'Emerging Markets', 'Small Cap', 'REITs',
]

interface HoldingModalProps {
  isOpen: boolean
  onClose: () => void
  /** If provided, the modal is in "Edit" mode pre-filled with this holding */
  holding?: Holding
}

export function HoldingModal({ isOpen, onClose, holding }: HoldingModalProps) {
  const isEdit = Boolean(holding)
  const headingId = 'holding-modal-heading'
  const firstInputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  // Bind the correct server action (add vs update)
  const boundAction = isEdit && holding
    ? (formData: FormData) => updateHolding(holding.id, formData)
    : addHolding

  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      const result = await boundAction(formData)
      if (!result.error) onClose()
      return result
    },
    {}
  )

  // Capture trigger element for focus restoration
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement
      // Small delay to let overlay render, then focus first input
      setTimeout(() => firstInputRef.current?.focus(), 50)
    } else if (triggerRef.current) {
      triggerRef.current.focus()
      triggerRef.current = null
    }
  }, [isOpen])

  // Close on Escape key; trap focus inside modal
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    // Overlay — click backdrop to close
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Modal card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="bg-zinc-800 border border-zinc-700 rounded-xl p-6 w-full max-w-sm mx-4"
      >
        <h2
          id={headingId}
          className="text-xl font-semibold text-white mb-4"
        >
          {isEdit ? 'Edit Holding' : 'Add Holding'}
        </h2>

        <form action={(formData) => startTransition(() => formAction(formData))}>
          <div className="flex flex-col gap-4">

            {/* Ticker */}
            <div className="flex flex-col gap-1">
              <label htmlFor="ticker" className="text-sm font-semibold text-white">
                Ticker
              </label>
              <input
                ref={firstInputRef}
                id="ticker"
                name="ticker"
                type="text"
                defaultValue={holding?.ticker ?? ''}
                placeholder="e.g. VWRP"
                maxLength={20}
                required
                className="w-full px-4 py-3 min-h-[44px] bg-zinc-900 border border-zinc-700 rounded-md text-base text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Quantity */}
            <div className="flex flex-col gap-1">
              <label htmlFor="quantity" className="text-sm font-semibold text-white">
                Quantity
              </label>
              <input
                id="quantity"
                name="quantity"
                type="number"
                step="any"
                min="0"
                defaultValue={holding?.quantity.toString() ?? ''}
                placeholder="e.g. 12"
                required
                className="w-full px-4 py-3 min-h-[44px] bg-zinc-900 border border-zinc-700 rounded-md text-base text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Current Value */}
            <div className="flex flex-col gap-1">
              <label htmlFor="currentValue" className="text-sm font-semibold text-white">
                Current Value (£)
              </label>
              <input
                id="currentValue"
                name="currentValue"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={holding?.currentValue.toString() ?? ''}
                placeholder="e.g. 1240.00"
                required
                className="w-full px-4 py-3 min-h-[44px] bg-zinc-900 border border-zinc-700 rounded-md text-base text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Asset Category */}
            <div className="flex flex-col gap-1">
              <label htmlFor="category" className="text-sm font-semibold text-white">
                Asset Category
              </label>
              <select
                id="category"
                name="category"
                defaultValue={holding?.category ?? ''}
                required
                className="w-full px-4 py-3 min-h-[44px] bg-zinc-900 border border-zinc-700 rounded-md text-base text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="" disabled>Select category</option>
                {ASSET_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Server error */}
            {state?.error && (
              <p role="alert" aria-live="polite" className="text-sm text-red-400">
                {state.error}
              </p>
            )}

          </div>

          {/* Footer */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 rounded-md px-4 py-2 text-sm font-semibold min-h-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-md px-4 py-2 text-sm font-semibold min-h-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {isPending ? 'Saving...' : 'Save Holding'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
