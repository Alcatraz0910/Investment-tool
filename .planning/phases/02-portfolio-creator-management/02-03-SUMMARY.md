---
phase: 02-portfolio-creator-management
plan: 03
subsystem: creators-ui
tags: [typescript, react, supabase, server-actions, optimistic-ui]

requires:
  - phase: 02-portfolio-creator-management
    plan: 01
    provides: public.creators seed rows (7 UK finance YouTubers)
  - phase: 02-portfolio-creator-management
    plan: 02
    provides: dashboard/page.tsx with tab routing and placeholder

provides:
  - creator-actions.ts: trackCreator, untrackCreator, addCustomCreator server actions
  - service.ts: service-role Supabase client for RLS-bypass creator inserts
  - creators-tab.tsx: CreatorsTab client component with optimistic toggle UI
  - dashboard/page.tsx: wired to fetch and render real CreatorsTab

affects:
  - 02-04 (ISA tab — uses same dashboard page pattern)
  - 03-transcript-pipeline (creators table now user-extensible via custom creator form)

tech-stack:
  added: []
  patterns:
    - "useActionState with explicit type parameter to avoid union type TS errors"
    - "Optimistic UI via useState + useTransition for instant track/untrack feedback"
    - "Service-role client imported dynamically inside server action (lazy, tree-shakeable)"
    - "server-only import guards service.ts from client bundle inclusion"

key-files:
  created:
    - pulse/src/app/dashboard/creator-actions.ts
    - pulse/src/lib/supabase/service.ts
    - pulse/src/app/dashboard/creators-tab.tsx
  modified:
    - pulse/src/app/dashboard/page.tsx

key-decisions:
  - "useActionState<CustomFormState, FormData> explicit type annotation prevents TS2339 union-type error on customState.error access"
  - "Dynamic import of service client inside addCustomCreator — avoids bundling service key path at module level"

requirements-completed:
  - CREATOR-02
  - CREATOR-03
  - CREATOR-04

duration: 15min
completed: 2026-05-07
---

# Phase 2 Plan 03: Creators Tab — Server Actions and Client Component Summary

**Three server actions (track/untrack/addCustomCreator) plus optimistic CreatorsTab UI component wired into the dashboard**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-07T00:00:00Z
- **Completed:** 2026-05-07T00:15:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `creator-actions.ts`: three `'use server'` actions; all call `getUser()` before any DB op; untrackCreator scopes DELETE with `.eq('user_id', user.id)` (T-02-11); addCustomCreator validates youtube.com URL server-side (T-02-12)
- `service.ts`: `import 'server-only'` guard; `SUPABASE_SERVICE_ROLE_KEY` env check with helpful error message pointing to Supabase Dashboard location (T-02-13)
- `creators-tab.tsx`: optimistic track/untrack toggle via `useTransition`; "Track" / "✓ Tracking" button text; `aria-pressed` on toggle buttons; Add Custom Creator form with `htmlFor` label bindings and `role="alert"` error messages
- `dashboard/page.tsx`: imports `CreatorsTab`, fetches `creators` + `trackedCreatorIds` (parallel `Promise.all`) only when `activeTab === 'creators'`, replaces placeholder `<p>`

## Task Commits

1. **Task 1: Creator server actions + service client** - `4a377f5` (feat)
2. **Task 2: CreatorsTab component + dashboard page update** - `6f8bc09` (feat)

## Files Created/Modified

- `pulse/src/app/dashboard/creator-actions.ts` — trackCreator, untrackCreator, addCustomCreator
- `pulse/src/lib/supabase/service.ts` — service-role client, server-only guarded
- `pulse/src/app/dashboard/creators-tab.tsx` — full CreatorsTab client component
- `pulse/src/app/dashboard/page.tsx` — imports CreatorsTab, fetches data, replaces placeholder

## Decisions Made

- Fixed `useActionState` type parameter (`useActionState<CustomFormState, FormData>`) to resolve TS2339 — the plan's inline code used a union return type that TypeScript couldn't narrow; unified with `{ error?: string; success?: boolean }` instead.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed useActionState union type causing TS2339**

- **Found during:** Task 2 TypeScript compile check
- **Issue:** Plan's inline code returned `result` (type `ActionResult`) or `{ success: true }` — TS inferred state as `ActionResult | { success: boolean }` and refused `.error` access on the union
- **Fix:** Explicit type annotation `useActionState<CustomFormState, FormData>` with `CustomFormState = { error?: string; success?: boolean }` — both branches return the same shape
- **Files modified:** `pulse/src/app/dashboard/creators-tab.tsx`
- **Commit:** `6f8bc09`

## Known Stubs

None — all UI is wired to real server actions and real DB data.

## User Setup Required

`SUPABASE_SERVICE_ROLE_KEY` must be added to `pulse/.env.local` before the Add Custom Creator form can insert new creators rows. Without it, `addCustomCreator` throws with a helpful message directing to Supabase Dashboard → Settings → API → service_role key.

The curated creator list requires the seed SQL from Plan 01 (`seed-creators.sql`) to have been run in Supabase SQL Editor.

## Threat Surface

All T-02-10 through T-02-13 mitigations applied as planned:

- T-02-10: `getUser()` in every action
- T-02-11: `.eq('user_id', user.id)` on DELETE
- T-02-12: `/^https?:\/\/(www\.)?youtube\.com\//i` regex before any DB write
- T-02-13: `server-only` import + `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix)

## Next Phase Readiness

- 02-04 (ISA tab) can proceed — dashboard tab routing pattern is established
- Creators tab fully functional once seed SQL and service role key are in place

---
*Phase: 02-portfolio-creator-management*
*Completed: 2026-05-07*
