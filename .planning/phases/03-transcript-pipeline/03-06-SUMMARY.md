---
phase: 03-transcript-pipeline
plan: "06"
subsystem: ui-components
tags: [phase-3, ui, client-component, polling, expand-collapse]
requirements: [TRANS-04, TRANS-05]

dependency_graph:
  requires: [03-03, 03-05]
  provides: [refresh-button, transcript-list]
  affects: [03-07-creators-tab-integration]

tech_stack:
  added: []
  patterns:
    - useState + useRef + setInterval for 2s polling loop with cleanup on unmount
    - useMemo for sorted transcript array (avoids re-sort on each render)
    - Per-instance isolated state (D-03 compliance — no cross-row state sharing)
    - React Fragment return from TranscriptList so toggle button and panel are siblings in parent layout

key_files:
  created:
    - pulse/src/app/dashboard/refresh-button.tsx
    - pulse/src/app/dashboard/transcript-list.tsx
  modified: []

decisions:
  - RefreshButton starts polling with setInterval on click before POST resolves, then stops polling when POST returns (synchronous pipeline) — covers step updates during long-running fetch
  - TranscriptList returns a Fragment so the chevron toggle and the sub-table panel are siblings in the parent grid row, matching the 03-07 layout intent

metrics:
  duration: "~15 min"
  completed: "2026-05-07"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 03 Plan 06: Refresh Button + Transcript List UI Components Summary

Client-side pipeline UI: per-row Refresh button with 2s polling and step status line, plus expand/collapse transcript sub-table with Embedded/Fetched/Pending semantic chips.

## Tasks Completed

| # | Task | Commit | Lines |
|---|------|--------|-------|
| 1 | RefreshButton client component with 2s polling | 608c801 | 192 |
| 2 | TranscriptList client component with expand/collapse | 8a0bfa6 | 134 |

## Component Interfaces

**RefreshButton props:**
```typescript
interface RefreshButtonProps {
  creatorId: string
  creatorName: string
  lastRefreshedAt: Date | null
}
```

**TranscriptList props:**
```typescript
interface TranscriptListProps {
  creatorId: string
  creatorName: string
  transcripts: Transcript[]
}
```

## Polling Behavior

- `setInterval(pollOnce, 2000)` starts immediately on click
- Polls `GET /api/refresh/[creatorId]` every 2s
- Stops on: `status === 'done'`, `status === 'error'`, network error, POST resolution, component unmount
- Each component instance has its own `pollRef` — D-03 per-row independence enforced

## Status Chip Mapping

| Chip | Condition | Colors |
|------|-----------|--------|
| Embedded | `t.isEmbedded === true` | `bg-emerald-500/10 text-emerald-400 border-emerald-500/20` |
| Fetched | `t.rawText != null && !t.isEmbedded` | `bg-indigo-500/10 text-indigo-400 border-indigo-500/20` |
| Pending | `t.rawText === null` | `bg-zinc-700/50 text-zinc-400 border-zinc-600/50` |

## Banned Word Check

grep -iE "advice|recommend|suggest" on both files: **0 matches** — CLAUDE.md constraint satisfied.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. Components are pure client-side UI consuming existing API routes from 03-03/03-05.

## Self-Check: PASSED

- `pulse/src/app/dashboard/refresh-button.tsx` — exists, 192 lines
- `pulse/src/app/dashboard/transcript-list.tsx` — exists, 134 lines
- Commit 608c801 — verified in git log
- Commit 8a0bfa6 — verified in git log
- `npx tsc --noEmit` — 0 errors in new files (2 pre-existing errors in creator-actions.ts, unrelated)
- All acceptance criteria grep checks — PASS
