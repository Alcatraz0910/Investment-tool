/**
 * ContradictionDiff — Phase 4 (D-11, D-12, STRAT-04).
 *
 * Amber badge "⚠ Strategy shift detected" shown when has_contradiction=true.
 * Clicking badge expands a diff table: "Category: old% → new% (±delta%)"
 * ⚠ icon only on rows where |delta| > 15.
 *
 * D-12: auto-clears when newest strategy row has has_contradiction=false.
 * No user-dismissal needed — this component simply doesn't render when
 * has_contradiction=false.
 *
 * UI copy: "Creator-derived strategy" — no advice/recommend/suggest language (CLAUDE.md).
 */
'use client'
import { useState } from 'react'

interface ShiftRow {
  category: string
  from: number
  to: number
  delta: number
}

interface ContradictionDiffProps {
  contradictionNote: string | null
}

function parseNoteToShifts(note: string): ShiftRow[] {
  // Note format from contradiction.ts: "Tech: 40% → 66% (+26%); Dividends: 30% → 15% (-15%)"
  return note
    .split('; ')
    .map((segment) => {
      // Match: "Category Name: 40% → 66% (+26%)"
      const match = segment.match(/^(.+?):\s*(\d+)%\s*→\s*(\d+)%\s*\(([+-]\d+)%\)$/)
      if (!match) return null
      return {
        category: match[1].trim(),
        from: parseInt(match[2], 10),
        to: parseInt(match[3], 10),
        delta: parseInt(match[4], 10),
      }
    })
    .filter((r): r is ShiftRow => r !== null)
}

export function ContradictionDiff({ contradictionNote }: ContradictionDiffProps) {
  const [expanded, setExpanded] = useState(false)

  if (!contradictionNote) return null

  const shifts = parseNoteToShifts(contradictionNote)

  return (
    <div className="mt-2">
      {/* Amber badge */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-amber-400 text-xs font-medium bg-amber-400/10 border border-amber-400/30 rounded-md px-2.5 py-1 hover:bg-amber-400/20 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
        aria-expanded={expanded}
      >
        <span>⚠</span>
        <span>Strategy shift detected</span>
        <span className="text-amber-400/60 ml-1">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expandable diff table */}
      {expanded && shifts.length > 0 && (
        <div className="mt-2 rounded-md border border-zinc-700 bg-zinc-900/50 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="text-left px-3 py-2 text-zinc-400 font-medium">Category</th>
                <th className="text-right px-3 py-2 text-zinc-400 font-medium">Previous</th>
                <th className="text-right px-3 py-2 text-zinc-400 font-medium">Current</th>
                <th className="text-right px-3 py-2 text-zinc-400 font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((row) => {
                const isFlagged = Math.abs(row.delta) > 15
                return (
                  <tr
                    key={row.category}
                    className="border-b border-zinc-700/50 last:border-0"
                  >
                    <td className="px-3 py-1.5 text-zinc-300">
                      {isFlagged && <span className="text-amber-400 mr-1">⚠</span>}
                      {row.category}
                    </td>
                    <td className="px-3 py-1.5 text-right text-zinc-400">{row.from}%</td>
                    <td className="px-3 py-1.5 text-right text-zinc-300">{row.to}%</td>
                    <td
                      className={`px-3 py-1.5 text-right font-medium ${
                        row.delta > 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {row.delta > 0 ? '+' : ''}{row.delta}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
