---
phase: 01-foundation
plan: "03"
subsystem: database
tags: [schema, supabase, postgresql, rls, isa]
dependency_graph:
  requires: ["01-01"]
  provides: ["schema.sql", "supabase-tables"]
  affects: ["01-02", "01-04", "phase-02", "phase-03", "phase-04", "phase-05", "phase-06"]
tech_stack:
  added: []
  patterns:
    - "RLS with auth.uid() = user_id for user-scoped tables"
    - "SECURITY DEFINER trigger for public.users auto-creation"
    - "JSONB for allocation snapshots (D-04)"
    - "Stub table pattern for BLEND-01 forward compatibility (D-05)"
key_files:
  created:
    - .planning/phases/01-foundation/schema.sql
  modified: []
decisions:
  - "D-04: allocation is JSONB on creator_strategies — no normalized strategy_allocations table"
  - "D-05: all 9 tables fully specified in Phase 1 — no future migrations for Phases 2-6"
  - "BLEND-01: user_creator_category_weights stub defined now to avoid future migration"
  - "T-1-11: RLS auth.uid() = user_id on all 6 user-scoped tables"
  - "T-1-13: No INSERT/UPDATE/DELETE policy on creators — authenticated role blocked by default; service role only"
metrics:
  duration: "< 5 minutes"
  completed_date: "2026-05-06"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 0
---

# Phase 01 Plan 03: Database Schema Summary

**One-liner:** Complete 9-table PostgreSQL schema with RLS, auth trigger, JSONB allocation, and per-category weight stub for Supabase deployment.

## Status

| Task | Name | Status | Commit |
|------|------|--------|--------|
| 1 | Write complete schema SQL file | COMPLETE | 7060c39 |
| 2 | Deploy schema to Supabase | COMPLETE | human-confirmed |

## What Was Built

`schema.sql` at `.planning/phases/01-foundation/schema.sql` — complete SQL ready for paste into Supabase SQL Editor.

### Tables (9 total)

| # | Table | Scope | Notes |
|---|-------|-------|-------|
| 1 | `public.users` | User-scoped | Extends auth.users via FK + trigger |
| 2 | `public.creators` | Shared (read-only for auth users) | Admin-managed via service role |
| 3 | `public.user_creators` | User-scoped | Global trust_weight (0–100) |
| 3a | `public.user_creator_category_weights` | User-scoped | BLEND-01 stub; per-category weight overrides |
| 4 | `public.holdings` | User-scoped | ISA portfolio positions |
| 5 | `public.isa_contributions` | User-scoped | UK tax year tracking (6 Apr–5 Apr) |
| 6 | `public.transcripts` | Shared (read-only for auth users) | YouTube transcripts; raw_text nullable until fetched |
| 7 | `public.creator_strategies` | Shared (read-only for auth users) | allocation is JSONB per D-04 |
| 8 | `public.buy_lists` | User-scoped | Monthly buy plans; items + unified_allocation as JSONB |

### Key Design Points

- **RLS on all 9 tables** — user-scoped tables use `auth.uid() = user_id`; shared tables use `USING (TRUE)` for SELECT only
- **on_auth_user_created trigger** — SECURITY DEFINER function inserts into public.users on auth.users INSERT; `ON CONFLICT (id) DO NOTHING` makes it idempotent
- **allocation JSONB** on creator_strategies — stores `{"Tech": 60, "Dividends": 20, ...}` per D-04; no separate normalized table
- **user_creator_category_weights** — stub satisfying BLEND-01 (per-category trust weights) and D-05 (no future migrations); empty until Phase 4
- **category CHECK constraints** on holdings and user_creator_category_weights enforce the 8 standard asset categories

## Deviations from Plan

None — plan executed exactly as written. Schema copied verbatim from plan specification.

## Checkpoint: Task 2 Resolved

**Type:** human-action  
**Resolution:** User confirmed all 9 tables deployed to Supabase with RLS enabled. Schema live.

## Threat Flags

None — all security surface in this plan was addressed by the RLS policies in schema.sql. All T-1-11 through T-1-15 mitigations are implemented as specified in the threat model.

## Self-Check

- [x] `.planning/phases/01-foundation/schema.sql` exists — FOUND
- [x] Commit 7060c39 exists — FOUND
- [x] 9 CREATE TABLE statements verified (grep count = 9)
- [x] 9 ENABLE ROW LEVEL SECURITY statements verified (grep count = 9)
- [x] on_auth_user_created trigger present
- [x] user_creator_category_weights present (BLEND-01)
- [x] allocation JSONB present (D-04)
- [x] ON CONFLICT (id) DO NOTHING present

## Self-Check: PASSED
