'use client'

import { useState, useMemo } from 'react'
import type { Transcript } from '@/types'

interface TranscriptListProps {
  creatorId: string
  creatorName: string
  transcripts: Transcript[]
}

type ChipKind = 'Embedded' | 'Fetched' | 'Pending'

function chipFor(t: Transcript): ChipKind {
  if (t.isEmbedded) return 'Embedded'
  if (t.rawText != null) return 'Fetched'
  return 'Pending'
}

const CHIP_CLASSES: Record<ChipKind, string> = {
  Embedded:
    'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  Fetched:
    'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
  Pending:
    'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-700/50 text-zinc-400 border border-zinc-600/50',
}

function formatPublished(d: Date): string {
  const day = d.getDate()
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const month = months[d.getMonth()]
  const year = d.getFullYear()
  const currentYear = new Date().getFullYear()
  return year === currentYear ? `${day} ${month}` : `${day} ${month} ${year}`
}

export default function TranscriptList({
  creatorId,
  creatorName,
  transcripts,
}: TranscriptListProps) {
  const [open, setOpen] = useState(false)

  const sorted = useMemo(
    () =>
      [...transcripts].sort(
        (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
      ),
    [transcripts],
  )

  const listId = `${creatorId}-transcript-list`
  const count = transcripts.length

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={listId}
        aria-label={
          open
            ? `Hide transcripts for ${creatorName}`
            : `Show transcripts for ${creatorName}`
        }
        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-1"
      >
        <svg
          className={`h-3 w-3 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        <span>{count} transcript{count !== 1 ? 's' : ''}</span>
      </button>

      {open && (
        <div
          id={listId}
          role="region"
          aria-label={`Transcripts for ${creatorName}`}
          className="bg-zinc-900/50 border border-zinc-700/50 rounded-lg mt-2 overflow-hidden"
        >
          {sorted.length === 0 ? (
            <p className="text-sm text-zinc-500 px-4 py-3 italic">
              No transcripts yet. Refresh to fetch.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 border-b border-zinc-700/50">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                  Title
                </span>
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide whitespace-nowrap">
                  Published
                </span>
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide whitespace-nowrap">
                  Status
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {sorted.map((t) => {
                  const kind = chipFor(t)
                  return (
                    <div
                      key={t.id}
                      className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 border-b border-zinc-700/30 last:border-0 items-center"
                    >
                      <span
                        className="text-sm text-zinc-300 truncate"
                        title={t.title}
                      >
                        {t.title}
                      </span>
                      <span className="text-sm text-zinc-400 whitespace-nowrap tabular-nums">
                        {formatPublished(t.publishedAt)}
                      </span>
                      <span className={CHIP_CLASSES[kind]}>{kind}</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
