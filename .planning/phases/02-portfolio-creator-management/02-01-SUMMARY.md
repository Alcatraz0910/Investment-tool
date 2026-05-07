---
phase: 02-portfolio-creator-management
plan: 01
subsystem: database
tags: [typescript, postgresql, supabase, decimal.js, seed-data]

requires:
  - phase: 01-foundation
    provides: schema.sql with public.users and public.creators tables

provides:
  - UserProfile interface extended with monthlyBudget: Decimal field
  - seed-creators.sql with ALTER TABLE migration and 7 UK finance creator rows

affects:
  - 02-02 (Portfolio tab needs monthlyBudget on UserProfile)
  - 02-03 (Creator list UI needs seed rows in public.creators)
  - 05-plan-generator (PlanGenerator reads monthlyBudget from UserProfile)

tech-stack:
  added: []
  patterns:
    - "DB NUMERIC columns mapped to Decimal type in domain interfaces (not number)"
    - "Schema migrations via SQL editor only (D-03) — no CLI migrations"
    - "Seed scripts are idempotent via ON CONFLICT DO NOTHING + IF NOT EXISTS"

key-files:
  created:
    - .planning/phases/02-portfolio-creator-management/seed-creators.sql
  modified:
    - pulse/src/types/index.ts

key-decisions:
  - "monthlyBudget placed between email and createdAt in UserProfile to keep £ fields grouped with other Decimal fields"
  - "seed-creators.sql includes both schema migration and seed data in one file for operator convenience"

patterns-established:
  - "All £ domain fields use Decimal type in interfaces — never number"
  - "SQL seed files include HOW TO USE header and verify SELECT comments"

requirements-completed:
  - CREATOR-01
  - PORT-03

duration: 5min
completed: 2026-05-07
---

# Phase 2 Plan 01: Schema Gap Fix and Creator Seed Summary

**UserProfile extended with monthlyBudget: Decimal, and idempotent SQL seed file produced with ALTER TABLE migration + 7 UK finance YouTube creators**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-07T00:00:00Z
- **Completed:** 2026-05-07T00:05:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `monthlyBudget: Decimal` to UserProfile interface with DB-mapping comment (PORT-03)
- Created seed-creators.sql with IF NOT EXISTS ALTER TABLE guard and 7 ON CONFLICT-safe creator inserts
- TypeScript compiles cleanly (npx tsc --noEmit: no errors)

## Task Commits

1. **Task 1: Add monthlyBudget: Decimal to UserProfile** - `afe1da5` (feat)
2. **Task 2: Write seed-creators.sql** - `657ba90` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `pulse/src/types/index.ts` - UserProfile interface extended with monthlyBudget: Decimal
- `.planning/phases/02-portfolio-creator-management/seed-creators.sql` - Schema migration + 7 UK finance creator seed rows

## Decisions Made
- None — followed plan as specified. Creator list taken verbatim from plan (7 channels: Damien Talks Money, Toby Newbatt, Money Unshackled, Sasha Yanshin, PensionCraft, Jamie Thompson Invests, Meaningful Money).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

**Manual database steps required before Phase 2 UI plans run:**

1. Open Supabase Dashboard → SQL Editor → New query
2. Paste SECTION 1 from `seed-creators.sql` → Run (adds monthly_budget column)
3. Paste SECTION 2 from `seed-creators.sql` → Run (inserts 7 creators)
4. Verify with the SELECT statements in each section

File: `.planning/phases/02-portfolio-creator-management/seed-creators.sql`

## Next Phase Readiness

- 02-02 (Portfolio tab) can proceed — UserProfile.monthlyBudget is defined
- 02-03 (Creator list UI) can proceed after manual seed-creators.sql run in Supabase
- No blockers

---
*Phase: 02-portfolio-creator-management*
*Completed: 2026-05-07*
