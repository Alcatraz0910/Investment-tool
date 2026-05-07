---
phase: "03-transcript-pipeline"
plan: "07"
subsystem: "dashboard-integration"
tags: [phase-3, integration, server-component, creators-tab, wave-5]
dependency_graph:
  requires: [03-06]
  provides: [creators-tab-wired, transcript-data-fetch]
  affects: [dashboard-page, creators-tab]
tech_stack:
  added: []
  patterns: [server-component-data-fetch, map-prop-passing, conditional-client-render]
key_files:
  created: []
  modified:
    - pulse/src/app/dashboard/page.tsx
    - pulse/src/app/dashboard/creators-tab.tsx
decisions:
  - "Structured <li> as flex-col so RefreshButton (flex-col div) and TranscriptList panel render below the actions row without breaking layout"
  - "Pre-existing TS errors in creator-actions.ts are out of scope — confirmed present before this plan's edits via git stash test"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-07"
  tasks_completed: 2
  tasks_total: 3
  files_changed: 2
---

# Phase 03 Plan 07: Dashboard Integration Summary

## One-liner

Server component extended to fetch transcripts + last_refreshed_at per tracked creator; creators-tab.tsx wired with RefreshButton + TranscriptList conditional rendering per tracked row.

## Tasks Completed

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Extend page.tsx server-component data fetch | Done | 0a2dbb6 |
| 2 | Extend creators-tab.tsx to render RefreshButton + TranscriptList | Done | fe2cae3 |
| 3 | User verifies end-to-end refresh flow | Awaiting human checkpoint | — |

## Changes by File

### pulse/src/app/dashboard/page.tsx (+47 -6)

- Added `Transcript` to type import from `@/types`
- Replaced single `trackedCreatorIds: Set<string>` with `lastRefreshedMap: Map<string, Date | null>` and `transcriptsByCreator: Map<string, Transcript[]>`
- Extended `user_creators` SELECT to `'creator_id, last_refreshed_at'`
- Built `lastRefreshedMap` from track rows (null when `last_refreshed_at` is NULL in DB)
- Added transcript fetch using `.in('creator_id', trackedIds)` guarded by `trackedIds.length > 0`
- Full field select: `id, creator_id, video_id, title, published_at, raw_text, word_count, is_embedded, last_fetched, created_at, updated_at`
- Row → domain mapping includes all `Transcript` interface fields (`createdAt`, `updatedAt`)
- Updated `<CreatorsTab>` JSX to pass `initialTracked`, `lastRefreshedMap`, `transcriptsByCreator`

### pulse/src/app/dashboard/creators-tab.tsx (+44 -21)

- Added imports: `Transcript` type, `RefreshButton` default, `TranscriptList` default
- Updated `CreatorsTabProps` interface: `trackedCreatorIds: Set<string>` replaced by `initialTracked: string[]`; added `lastRefreshedMap` and `transcriptsByCreator` props
- Updated component signature to destructure new props directly
- Restructured creator row `<li>` from `flex items-center justify-between` to `flex flex-col` with inner top row; ensures RefreshButton's timestamp/step lines and TranscriptList's expand panel render below the button row
- Conditional rendering: `tracked.has(creator.id) && <RefreshButton ... />` and `tracked.has(creator.id) && <TranscriptList ... />`
- All Phase 2 behavior preserved verbatim: track toggle, optimistic state, custom creator form, error display

## Deviations from Plan

### Pre-existing TypeScript Errors (Out of Scope)

`creator-actions.ts` has two pre-existing `error TS2353` / `error TS2339` errors unrelated to this plan's changes. Confirmed pre-existing via `git stash` test — errors appear without our edits. Per deviation rules, pre-existing failures in unrelated files are out of scope.

No other deviations. Plan executed as written.

## Threat Flags

None. The `.in('creator_id', trackedIds)` query is bounded by `lastRefreshedMap` which is derived from `user_creators` filtered by `auth.uid()` (RLS). The `tracked.has(creator.id)` guard prevents RefreshButton/TranscriptList rendering on untracked rows (T-03-07-01, T-03-07-02 mitigated).

## Known Stubs

None. Data flows from server through to client components. `lastRefreshedMap.get(creator.id) ?? null` and `transcriptsByCreator.get(creator.id) ?? []` are correct runtime defaults (null = never refreshed; empty array = no transcripts yet).

## Self-Check: PASSED

- `pulse/src/app/dashboard/page.tsx` — modified, committed at 0a2dbb6
- `pulse/src/app/dashboard/creators-tab.tsx` — modified, committed at fe2cae3
- Commits verified in git log
- Grep checks: all acceptance criteria literals present in both files
- Banned words (advice/recommend/suggest): not found in creators-tab.tsx
- Other tab branches (portfolio, isa) and auth/redirect logic: unchanged (additive-only diff)
