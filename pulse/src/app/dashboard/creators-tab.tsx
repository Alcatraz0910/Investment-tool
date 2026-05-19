'use client'
import { useState, useTransition, useActionState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Creator, Transcript, CreatorStrategy, UserCreator } from '@/types'
import { trackCreator, untrackCreator, addCustomCreator, searchCreators, trackSearchedCreator } from '@/app/dashboard/creator-actions'
import { formatSubscriberCount, type SearchResult } from '@/lib/youtube/client'
import RefreshButton from './refresh-button'
import TranscriptList from './transcript-list'
import { StrategyCard } from './components/StrategyCard'
import { TrustWeightSlider } from './components/TrustWeightSlider'

const creatorListVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const creatorItemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' as const } },
}

interface CreatorsTabProps {
  creators: Creator[]
  initialTracked: string[]
  lastRefreshedMap: Map<string, Date | null>
  transcriptsByCreator: Map<string, Transcript[]>
  strategiesByCreator: Map<string, CreatorStrategy | null>
  userCreatorMap: Map<string, UserCreator>
}

export function CreatorsTab({ creators, initialTracked, lastRefreshedMap, transcriptsByCreator, strategiesByCreator, userCreatorMap }: CreatorsTabProps) {
  // Optimistic tracking state: mirror server state, update immediately on toggle
  const [tracked, setTracked] = useState<Set<string>>(new Set<string>(initialTracked))
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

  const [isUrlFormOpen, setIsUrlFormOpen] = useState(false)
  const [trackingIds, setTrackingIds] = useState<Set<string>>(new Set())

  type SearchState = { results?: SearchResult[]; error?: string }
  const [searchState, searchAction, searchPending] = useActionState<SearchState, FormData>(
    async (_prev, formData) => {
      const query = formData.get('channelQuery') as string
      if (!query?.trim()) return { error: 'Please enter a channel name to search.' }
      const result = await searchCreators(query.trim())
      return result.error ? { error: result.error } : { results: result.data ?? [] }
    },
    {}
  )

  async function handleTrack(result: SearchResult) {
    setTrackingIds(prev => new Set(prev).add(result.channelId))
    const res = await trackSearchedCreator(result.channelId, result.channelTitle, result.thumbnailUrl)
    if (res.error) {
      setTrackingIds(prev => {
        const next = new Set(prev)
        next.delete(result.channelId)
        return next
      })
    }
  }

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
        <motion.ul variants={creatorListVariants} initial="hidden" animate="visible">
          {creators.map((creator) => {
            const isTracked = tracked.has(creator.id)
            return (
              <motion.li
                key={creator.id}
                variants={creatorItemVariants}
                className="flex flex-col py-3 border-b border-zinc-700/50"
              >
                {/* Top row: creator info + action buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-white">{creator.displayName}</p>
                    <a
                      href={creator.channelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-zinc-500 hover:text-indigo-400 transition-colors truncate block"
                    >
                      {creator.channelUrl.replace('https://www.youtube.com/', 'youtube.com/')}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
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
                    {tracked.has(creator.id) && (
                      <RefreshButton
                        creatorId={creator.id}
                        creatorName={creator.displayName}
                        lastRefreshedAt={lastRefreshedMap.get(creator.id) ?? null}
                      />
                    )}
                  </div>
                </div>
                {tracked.has(creator.id) && (
                  <TranscriptList
                    creatorId={creator.id}
                    creatorName={creator.displayName}
                    transcripts={transcriptsByCreator.get(creator.id) ?? []}
                  />
                )}
                {tracked.has(creator.id) && (
                  <>
                    <StrategyCard
                      strategy={strategiesByCreator.get(creator.id) ?? null}
                      lastRefreshedAt={
                        lastRefreshedMap.get(creator.id)?.toLocaleDateString('en-GB') ?? 'Never'
                      }
                    />
                    {(() => {
                      const uc = userCreatorMap.get(creator.id)
                      if (!uc) return null
                      return (
                        <TrustWeightSlider
                          userCreatorId={uc.id}
                          initialGlobalWeight={uc.trustWeight}
                          initialCategoryWeights={uc.categoryWeights?.map((w) => ({
                            category: w.category,
                            weight: w.weight,
                          })) ?? []}
                        />
                      )
                    })()}
                  </>
                )}
              </motion.li>
            )
          })}
        </motion.ul>
      )}

      {/* Find a Creator — Search Bar (Primary, D-19/D-20) */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">Find a Creator</h2>

        <form
          action={(formData) => startT(() => searchAction(formData))}
          className="flex gap-2"
        >
          <label htmlFor="channelQuery" className="sr-only">Search YouTube channels</label>
          <input
            id="channelQuery"
            name="channelQuery"
            type="text"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Search by channel name or topic…"
            className="flex-1 px-4 py-3 min-h-[44px] bg-zinc-900 border border-zinc-700 rounded-md text-base text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={searchPending}
            className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-md px-4 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {searchPending ? 'Searching…' : 'Search'}
          </button>
        </form>

        {/* Loading state */}
        {searchPending && (
          <p className="text-sm text-zinc-400 mt-3">Searching YouTube…</p>
        )}

        {/* Error state */}
        {searchState.error && !searchPending && (
          <p role="alert" aria-live="polite" className="text-sm text-red-400 mt-2">
            {searchState.error}
          </p>
        )}

        {/* Results */}
        <AnimatePresence>
          {!searchPending && searchState.results !== undefined && (
            <motion.div
              key="search-results"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="mt-3"
              role="list"
              aria-live="polite"
              aria-label={
                searchState.results.length === 0
                  ? 'No channels found'
                  : `${searchState.results.length} channel${searchState.results.length === 1 ? '' : 's'} found`
              }
            >
              {searchState.results.length === 0 ? (
                <p className="text-sm text-zinc-400 py-4 text-center">
                  No channels found. Try a different name or add by URL instead.
                </p>
              ) : (
                searchState.results.map((result) => {
                  const isAlreadyTracked = trackingIds.has(result.channelId)
                  return (
                    <motion.div
                      key={result.channelId}
                      role="listitem"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="flex items-center gap-3 py-2.5 border-b border-zinc-700/50 last:border-b-0"
                    >
                      {/* Thumbnail */}
                      {result.thumbnailUrl ? (
                        <img
                          src={result.thumbnailUrl}
                          alt={`${result.channelTitle} channel thumbnail`}
                          width={40}
                          height={40}
                          className="w-10 h-10 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-full shrink-0 bg-zinc-700"
                          aria-hidden="true"
                        />
                      )}

                      {/* Name + subscriber count */}
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-white truncate">
                          {result.channelTitle}
                        </p>
                        {result.subscriberCount !== null && (
                          <p className="text-sm text-zinc-400">
                            {formatSubscriberCount(result.subscriberCount)}
                          </p>
                        )}
                      </div>

                      {/* Track button */}
                      <button
                        type="button"
                        onClick={() => handleTrack(result)}
                        disabled={isAlreadyTracked}
                        aria-label={`Track ${result.channelTitle}`}
                        aria-disabled={isAlreadyTracked}
                        className={
                          isAlreadyTracked
                            ? 'text-sm font-semibold text-indigo-400 border border-indigo-500/50 rounded-md px-3 min-h-[36px] opacity-60 cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500'
                            : 'text-sm font-semibold text-zinc-400 border border-zinc-700 rounded-md px-3 min-h-[36px] hover:border-indigo-500 hover:text-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500'
                        }
                      >
                        {isAlreadyTracked ? 'Tracking ✓' : 'Track'}
                      </button>
                    </motion.div>
                  )
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* "Add by URL instead" disclosure toggle (D-20 / SRCH-03) */}
        <button
          type="button"
          onClick={() => setIsUrlFormOpen(prev => !prev)}
          aria-expanded={isUrlFormOpen}
          className="text-sm text-zinc-400 hover:text-zinc-300 underline underline-offset-2 mt-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
        >
          {isUrlFormOpen ? 'Hide URL form' : 'Add by URL instead'}
        </button>

        {/* Collapsible URL form — identical to previous Add Custom Creator form */}
        <AnimatePresence>
          {isUrlFormOpen && (
            <motion.div
              key="url-form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 mt-3">
                <h2 className="text-lg font-semibold text-white mb-3">Add Custom Creator</h2>
                <form
                  action={(formData) => startT(() => customAction(formData))}
                  className="flex flex-col gap-3"
                >
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
                  {customState?.error && !customState.error.includes('YouTube') && !customState.error.includes('name') && (
                    <p role="alert" aria-live="polite" className="text-sm text-red-400">
                      {customState.error}
                    </p>
                  )}
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
