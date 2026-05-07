'use client'
import { useState, useTransition, useActionState, startTransition } from 'react'
import { Decimal } from '@/types'
import type { ISAContribution } from '@/types'
import { logContribution, deleteContribution } from '@/app/dashboard/isa-actions'
import { formatTaxYearDisplay } from '@/lib/tax-year'

const ISA_ALLOWANCE = new Decimal(20000)

interface ISATabProps {
  contributions: ISAContribution[]   // current tax year only, server-filtered
  currentTaxYear: string             // e.g. '2025-26'
}

export function ISATab({ contributions, currentTaxYear }: ISATabProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [isPending, startT] = useTransition()
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [logState, logAction, logPending] = useActionState(
    async (_prev: { error?: string; success?: boolean }, formData: FormData) => {
      const result = await logContribution(formData)
      return result.error ? result : { success: true }
    },
    {}
  )

  // Compute allowance summary using decimal.js (CLAUDE.md: never use native floats for £)
  const totalContributed = contributions.reduce(
    (sum, c) => sum.plus(c.amount),
    new Decimal(0)
  )
  const remaining = ISA_ALLOWANCE.minus(totalContributed)
  const usedPct = totalContributed.div(ISA_ALLOWANCE).times(100).toNumber()

  // Color for remaining amount (UI-SPEC)
  const remainingColor =
    usedPct >= 100
      ? 'text-red-400'
      : usedPct > 90
      ? 'text-amber-400'
      : 'text-white'

  async function handleDelete(id: string) {
    startT(async () => {
      const result = await deleteContribution(id)
      if (result.error) {
        setDeleteError(result.error)
      } else {
        setDeleteConfirmId(null)
        setDeleteError(null)
      }
    })
  }

  const taxYearDisplay = formatTaxYearDisplay(currentTaxYear)

  return (
    <div>
      {/* ISA Allowance Summary */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 mb-6">
        {usedPct >= 100 ? (
          <p className="text-2xl font-semibold text-red-400">
            ISA allowance fully used for this tax year.
          </p>
        ) : (
          <>
            <p>
              <span className={`text-2xl font-semibold ${remainingColor}`}>
                £{remaining.toFixed(2)}
              </span>{' '}
              <span className="text-base text-zinc-400">remaining</span>
            </p>
            <p className="text-sm text-zinc-400 mt-1">
              £{totalContributed.toFixed(2)} contributed of £20,000
            </p>
          </>
        )}
        <p className="text-sm text-zinc-500 mt-1">
          Tax year: {taxYearDisplay}
        </p>
      </div>

      {/* Contribution Log */}
      <h2 className="text-lg font-semibold text-white mb-3">Contribution Log</h2>

      {contributions.length === 0 ? (
        <p className="text-zinc-400 text-sm py-4 text-center">
          No contributions logged for this tax year.
        </p>
      ) : (
        <ul className="mb-4">
          {contributions.map((contribution) => {
            const dateStr = contribution.contributionDate.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
            return (
              <li
                key={contribution.id}
                className="flex items-center justify-between py-3 border-b border-zinc-700/50"
              >
                {deleteConfirmId === contribution.id ? (
                  // Inline delete confirmation
                  <div className="flex items-center gap-3 flex-1 flex-wrap">
                    <span className="text-sm text-white">
                      Remove this contribution? This will update your remaining allowance.
                    </span>
                    {deleteError && (
                      <span role="alert" aria-live="polite" className="text-sm text-red-400">
                        {deleteError}
                      </span>
                    )}
                    <div className="flex gap-2 ml-auto">
                      <button
                        type="button"
                        onClick={() => handleDelete(contribution.id)}
                        disabled={isPending}
                        className="text-sm font-semibold text-red-400 hover:text-red-300 disabled:opacity-60 min-h-[44px] px-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
                      >
                        {isPending ? 'Removing...' : 'Remove'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDeleteConfirmId(null); setDeleteError(null) }}
                        className="text-sm font-semibold text-zinc-400 hover:text-white min-h-[44px] px-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-zinc-400 w-36">{dateStr}</span>
                    <span className="text-base font-semibold text-white flex-1 text-right">
                      £{contribution.amount.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(contribution.id)}
                      className="text-sm text-red-400 hover:text-red-300 ml-4 min-h-[44px] px-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
                    >
                      Delete
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Log Contribution Form */}
      <div className="border-t border-zinc-700 pt-4 mt-4">
        <h2 className="text-base font-semibold text-white mb-3">Log a contribution</h2>

        <form
          action={(formData) => startTransition(() => logAction(formData))}
        >
          <div className="flex gap-3 items-end flex-wrap">
            {/* Date */}
            <div className="flex flex-col gap-1 flex-1">
              <label htmlFor="contributionDate" className="text-sm font-semibold text-white">
                Date
              </label>
              <input
                id="contributionDate"
                name="contributionDate"
                type="date"
                required
                className="w-full px-4 py-3 min-h-[44px] bg-zinc-900 border border-zinc-700 rounded-md text-base text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Amount */}
            <div className="flex flex-col gap-1 flex-1">
              <label htmlFor="amount" className="text-sm font-semibold text-white">
                Amount (£)
              </label>
              <input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="e.g. 500.00"
                required
                className="w-full px-4 py-3 min-h-[44px] bg-zinc-900 border border-zinc-700 rounded-md text-base text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={logPending}
              className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-md px-4 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500 whitespace-nowrap"
            >
              {logPending ? 'Logging...' : 'Log Contribution'}
            </button>
          </div>

          {/* Validation/server errors */}
          {'error' in logState && logState.error && (
            <p role="alert" aria-live="polite" className="text-sm text-red-400 mt-2">
              {logState.error}
            </p>
          )}

          {/* Success feedback */}
          {'success' in logState && logState.success && (
            <p className="text-sm text-white mt-2">Contribution logged.</p>
          )}
        </form>
      </div>
    </div>
  )
}
