# Phase 1: Foundation - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Scaffold the working skeleton everything downstream depends on: Next.js 15 App Router project with Supabase auth (email/password), a complete DB schema for all 8 domain tables, and shared TypeScript domain types. Phase ends when a user can sign up, log in, stay logged in, and the DB schema is live in Supabase with RLS enabled.

No UI design system, no business logic, no data pipelines — those are Phases 2–6.

</domain>

<decisions>
## Implementation Decisions

### Supabase Environment
- **D-01:** A new Supabase project must be created for Pulse. The plan must include steps for project creation (Supabase console) and capturing the project URL + anon key.
- **D-02:** Cloud-only development. No local Docker / `supabase start` setup. Both dev and prod point to the same cloud project.
- **D-03:** Schema is deployed via SQL run in the Supabase SQL editor (console). No Supabase CLI migrations.

### DB Schema
- **D-04:** `creator_strategies.allocation` is a `JSONB` column storing the full strategy object (e.g. `{"Tech": 60, "Dividends": 20, "Cash": 20}`). No separate normalized `strategy_allocations` table.
- **D-05:** Full column spec for all 8 tables must be defined in Phase 1 — all columns, data types, foreign keys, and constraints. Downstream phases must not need schema migrations. Tables: `users` (extends Supabase auth.users), `creators`, `user_creators`, `holdings`, `isa_contributions`, `transcripts`, `creator_strategies`, `buy_lists`.

### Auth Pages
- **D-06:** Auth pages (`/auth/login`, `/auth/signup`) use minimal Tailwind styling — centered card, labeled inputs, submit button. No design system (glassmorphism is Phase 6). Must be functional and readable.
- **D-07:** After login, user lands on `/dashboard` — a protected placeholder page showing "Welcome, [email]" and a Sign Out button. Proves middleware redirect works.

### TypeScript Types
- **D-08:** Types are hand-written (not auto-generated from Supabase). They model domain concepts — `Creator`, `Holding`, `BuyListItem`, `CreatorStrategy`, etc. — not raw DB rows. Use `Decimal` (from `decimal.js`) for all `£` amount fields, not `number`.
- **D-09:** Single flat file: `types/index.ts`. All domain models in one place. Import path: `@/types`.

### Claude's Discretion
- **RLS policies:** Planner decides the exact policy syntax. Guidance: RLS should be ON for every table; a sensible default is `auth.uid() = user_id` for user-scoped tables. The `creators` table (admin-managed) may need different policy rules.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Requirements
- `.planning/ROADMAP.md` §Phase 1 — Plans (4 tasks), success criteria (3 criteria), table names
- `.planning/REQUIREMENTS.md` §Authentication — AUTH-01 (email/password signup/login), AUTH-02 (session persistence)
- `.planning/PROJECT.md` — Tech stack, key decisions, out-of-scope items

### Critical Constraints
- `CLAUDE.md` §Critical Constraints — `decimal.js` for £ arithmetic, RAG pattern for Claude, no "advice" language in user-facing output, ISA tax year (6 Apr–5 Apr), manual-first v1

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — fresh project. No existing components, hooks, or utilities.

### Established Patterns
- None yet. Phase 1 establishes the patterns all later phases follow.

### Integration Points
- `types/index.ts` is the single import point for all domain types across the entire codebase. Every subsequent phase imports from `@/types`.
- Supabase client must be initialized once in `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (server components / route handlers) — standard Next.js + Supabase SSR pattern.
- Middleware (`middleware.ts`) handles route protection — authenticated routes require valid session, unauthenticated requests redirect to `/auth/login`.

</code_context>

<specifics>
## Specific Ideas

- No specific UI references or design inspirations for Phase 1. Auth pages just need to work cleanly.
- The `decimal.js` import must be present in `types/index.ts` or a utility file from Phase 1 so later phases inherit the pattern.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Foundation*
*Context gathered: 2026-05-06*
