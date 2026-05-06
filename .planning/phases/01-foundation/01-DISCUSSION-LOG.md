# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 1-Foundation
**Areas discussed:** Supabase environment, DB schema column detail, Auth pages, TypeScript type strategy

---

## Supabase Environment

### Q1: Existing or new project?

| Option | Description | Selected |
|--------|-------------|----------|
| Already created | Plan skips project creation, just needs keys in .env.local | |
| Need to create one | Plan includes Supabase project creation steps | ✓ |
| You decide | Leave to planner | |

**User's choice:** Need to create one

---

### Q2: Local dev setup?

| Option | Description | Selected |
|--------|-------------|----------|
| Cloud-only | Dev and prod both point to same cloud project. No Docker. | ✓ |
| Local Docker + cloud | Run `supabase start` locally, separate prod project | |
| You decide | Leave to planner | |

**User's choice:** Cloud-only

---

### Q3: Schema deployment method?

| Option | Description | Selected |
|--------|-------------|----------|
| SQL in Supabase console | Write SQL, run in SQL editor. No extra tooling. | ✓ |
| Supabase CLI migrations | `supabase migration new` + `supabase db push`. Versioned. | |
| You decide | Leave to planner | |

**User's choice:** SQL in Supabase console

---

## DB Schema Column Detail

### Q1: creator_strategies.allocation storage?

| Option | Description | Selected |
|--------|-------------|----------|
| JSON column | Single `JSONB` column stores full strategy object | ✓ |
| Normalized rows | Separate `strategy_allocations` table with (strategy_id, category, pct) | |
| You decide | Leave to planner | |

**User's choice:** JSON column (JSONB)

---

### Q2: How much column detail in Phase 1?

| Option | Description | Selected |
|--------|-------------|----------|
| Full column spec now | All columns, types, FKs, constraints for all 8 tables | ✓ |
| Skeleton only | PKs + FK relationships only; extend per phase | |

**User's choice:** Full column spec now

---

### Q3: RLS configuration?

| Option | Description | Selected |
|--------|-------------|----------|
| Enable RLS + basic policies | RLS ON + `auth.uid() = user_id` per table | |
| Enable RLS flag only | RLS toggled on, no policies yet | |
| You decide | Leave RLS policy detail to planner | ✓ |

**User's choice:** You decide

---

## Auth Pages

### Q1: Styling level?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal Tailwind | Clean form with Tailwind utilities — centered card, inputs, button | ✓ |
| Unstyled/functional only | Plain HTML, no styling | |
| Full design system preview | Space Grey + Electric Indigo now (Phase 6 scope) | |

**User's choice:** Minimal Tailwind

---

### Q2: Post-login destination?

| Option | Description | Selected |
|--------|-------------|----------|
| Basic /dashboard placeholder | Protected route showing Welcome [email] + Sign Out | ✓ |
| No landing page, redirect to / | Auth middleware redirects to root | |
| You decide | Let planner decide | |

**User's choice:** Basic /dashboard placeholder

---

## TypeScript Type Strategy

### Q1: Generation approach?

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-written types/index.ts | Rich domain types; use Decimal for £ amounts | ✓ |
| Auto-generated from Supabase | `supabase gen types typescript` — DB-faithful but low-level | |
| Both: generated + domain layer | Most correct long-term, more files in Phase 1 | |

**User's choice:** Hand-written types/index.ts

---

### Q2: File structure?

| Option | Description | Selected |
|--------|-------------|----------|
| Single types/index.ts | All domain types in one file. Import: `@/types` | ✓ |
| Domain modules | types/creators.ts, types/portfolio.ts, etc. | |

**User's choice:** Single types/index.ts

---

## Claude's Discretion

- **RLS policies:** Planner decides exact policy syntax for each table.

## Deferred Ideas

None — discussion stayed within phase scope.
