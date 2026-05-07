'use client'
import { useState, useTransition, useActionState, startTransition } from 'react'
import type { Creator } from '@/types'
import { trackCreator, untrackCreator, addCustomCreator } from '@/app/dashboard/creator-actions'

interface CreatorsTabProps {
  creators: Creator[]
  trackedCreatorIds: Set<string>
}

export function CreatorsTab({ creators, trackedCreatorIds: initialTracked }: CreatorsTabProps) {
  // Optimistic tracking state: mirror server state, update immediately on toggle
  const [tracked, setTracked] = useState<Set<string>>(new Set(initialTracked))
  const [isPending, startT] = useTransition()
  const [toggleError, setToggleError] = useState<string | null>(null)

  type CustomFormState = { error?: string; success?: boolean }

  const [customState, customAction, customPending] = useActionState<CustomFormState, FormData>(
    async (_prev, formData) => {
      const result = await addCustomCreator(formData)
      return result.error ? { error: result.error } : { success: true }
    },
    {}
  )

  function handleToggle(creatorId: string) {
    const isTracked = tracked.has(creatorId)

    // Optimistic update
    setTracked((prev) => {
      const next = new Set(prev)
      if (isTracked) next.delete(creatorId)
      else next.add(creatorId)
      return next
    })

    startT(async () => {
      const result = isTracked
        ? await untrackCreator(creatorId)
        : await trackCreator(creatorId)

      if (result.error) {
        // Revert optimistic update
        setTracked((prev) => {
          const next = new Set(prev)
          if (isTracked) next.add(creatorId)
          else next.delete(creatorId)
          return next
        })
        setToggleError(result.error)
      } else {
        setToggleError(null)
      }
    })
  }

  return (
    <div>
      {/* Section heading */}
      <h2 className="text-lg font-semibold text-white mb-3">Browse Creators</h2>

      {/* Toggle error */}
      {toggleError && (
        <p role="alert" aria-live="polite" className="text-sm text-red-400 mb-3">
          {toggleError}
        </p>
      )}

      {/* Curated creator list */}
      {creators.length === 0 ? (
        <p className="text-zinc-400 text-sm py-8 text-center">
          No creators available. Check back soon.
        </p>
      ) : (
        <ul>
          {creators.map((creator) => {
            const isTracked = tracked.has(creator.id)
            return (
              <li
                key={creator.id}
                className="flex items-center justify-between py-3 border-b border-zinc-700/50"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-white">{creator.displayName}</p>
                  <p className="text-sm text-zinc-400 truncate max-w-[200px]">{creator.channelUrl}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle(creator.id)}
                  disabled={isPending}
                  aria-pressed={isTracked}
                  className={
                    isTracked
                      ? 'text-sm font-semibold text-indigo-400 border border-indigo-500/50 rounded-md px-3 min-h-[36px] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-500'
                      : 'text-sm font-semibold text-zinc-400 border border-zinc-700 rounded-md px-3 min-h-[36px] hover:border-indigo-500 hover:text-indigo-400 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-500'
                  }
                >
                  {isTracked ? '✓ Tracking' : 'Track'}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* Add Custom Creator Form */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">Add Custom Creator</h2>

        <form
          action={(formData) => startTransition(() => customAction(formData))}
          className="flex flex-col gap-3"
        >
          {/* Channel URL */}
          <div className="flex flex-col gap-1">
            <label htmlFor="channelUrl" className="text-sm font-semibold text-white">
              YouTube Channel URL
            </label>
            <input
              id="channelUrl"
              name="channelUrl"
              type="url"
              placeholder="https://www.youtube.com/c/channelname"
              required
              className="w-full px-4 py-3 min-h-[44px] bg-zinc-900 border border-zinc-700 rounded-md text-base text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {customState?.error?.includes('YouTube') && (
              <p role="alert" aria-live="polite" className="text-sm text-red-400 mt-1">
                {customState.error}
              </p>
            )}
          </div>

          {/* Display Name */}
          <div className="flex flex-col gap-1">
            <label htmlFor="displayName" className="text-sm font-semibold text-white">
              Display Name
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              placeholder="e.g. Damien Talks Money"
              required
              className="w-full px-4 py-3 min-h-[44px] bg-zinc-900 border border-zinc-700 rounded-md text-base text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {customState?.error?.includes('name') && (
              <p role="alert" aria-live="polite" className="text-sm text-red-400 mt-1">
                {customState.error}
              </p>
            )}
          </div>

          {/* Generic server error */}
          {customState?.error && !customState.error.includes('YouTube') && !customState.error.includes('name') && (
            <p role="alert" aria-live="polite" className="text-sm text-red-400">
              {customState.error}
            </p>
          )}

          {/* Success state */}
          {customState && 'success' in customState && customState.success && (
            <p className="text-sm text-white">Creator added and tracked.</p>
          )}

          <button
            type="submit"
            disabled={customPending}
            className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-md px-4 py-2 min-h-[44px] w-full mt-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {customPending ? 'Adding...' : 'Add Creator'}
          </button>
        </form>
      </div>
    </div>
  )
}
