'use client'

import { useState, useEffect, useRef } from 'react'

interface RefreshButtonProps {
  creatorId: string
  creatorName: string
  lastRefreshedAt: Date | null
}

type Status = 'idle' | 'running' | 'done' | 'error'

interface StatusPayload {
  status: Status
  step: string | null
  summary: string | null
  error: string | null
}

function formatLastRefreshed(d: Date | null): string {
  if (!d) return 'Never refreshed'
  // UI-SPEC: "Last refreshed: D MMM YYYY at HH:MM" (UK formatting)
  const day = d.getDate()
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const month = months[d.getMonth()]
  const year = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `Last refreshed: ${day} ${month} ${year} at ${hh}:${mm}`
}

export default function RefreshButton({
  creatorId,
  creatorName,
  lastRefreshedAt,
}: RefreshButtonProps) {
  const [status, setStatus] = useState<Status>('idle')
  const [step, setStep] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Stop polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [])

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  async function pollOnce() {
    try {
      const res = await fetch(`/api/refresh/${creatorId}`, { method: 'GET' })
      if (!res.ok) {
        setError('Refresh failed — please try again')
        setStatus('error')
        stopPolling()
        return
      }
      const data: StatusPayload = await res.json()
      setStep(data.step)
      setSummary(data.summary)
      setError(data.error)
      if (data.status === 'done' || data.status === 'error') {
        setStatus(data.status)
        stopPolling()
      } else if (data.status === 'running') {
        setStatus('running')
      }
    } catch {
      setError('Refresh failed — please try again')
      setStatus('error')
      stopPolling()
    }
  }

  async function handleClick() {
    if (status === 'running') return

    // Reset display state
    setStatus('running')
    setStep('Resolving channel...')
    setSummary(null)
    setError(null)

    // Start 2s polling immediately (D-02)
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(pollOnce, 2000)

    try {
      const res = await fetch(`/api/refresh/${creatorId}`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))

      // Stop polling once POST returns (it ran synchronously to completion)
      stopPolling()

      if (!res.ok) {
        setStatus('error')
        setError(data?.error ?? 'Refresh failed — please try again')
        return
      }

      setStatus('done')
      setStep(null)
      setSummary(data?.summary ?? null)
      setError(null)
    } catch {
      stopPolling()
      setStatus('error')
      setError('Refresh failed — please try again')
    }
  }

  const isRunning = status === 'running'

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isRunning}
        aria-label={isRunning ? 'Refreshing...' : `Refresh ${creatorName}`}
        className="text-sm font-semibold text-white bg-indigo-500 hover:bg-indigo-400 rounded-md px-3 min-h-[36px] focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-75 inline-flex items-center justify-center gap-2"
      >
        {isRunning ? (
          <svg
            className="animate-spin h-4 w-4 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          'Refresh'
        )}
      </button>

      {/* Last refreshed timestamp — always visible */}
      <p className={`text-sm ${lastRefreshedAt ? 'text-zinc-500' : 'text-zinc-600'}`}>
        {formatLastRefreshed(lastRefreshedAt)}
      </p>

      {/* Step status line — visible during refresh */}
      {status === 'running' && step !== null && (
        <p className="text-sm text-zinc-400 py-1 pl-1" aria-live="polite">
          {step}
        </p>
      )}

      {/* Summary line — visible after done */}
      {status === 'done' && summary && (
        <p className="text-sm text-zinc-400 py-1 pl-1" aria-live="polite">
          {summary}
        </p>
      )}

      {/* Error line — visible on error */}
      {status === 'error' && error && (
        <p
          role="alert"
          aria-live="assertive"
          className="text-sm text-red-400 py-1 pl-1"
        >
          {error}
        </p>
      )}
    </div>
  )
}
