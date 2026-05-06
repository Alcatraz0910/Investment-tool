---
phase: 01-foundation
plan: "01"
subsystem: scaffold
tags: [nextjs, supabase, auth, tailwind, typescript]
dependency_graph:
  requires: []
  provides: [nextjs-scaffold, supabase-ssr-clients, middleware-auth]
  affects: [all-downstream-plans]
tech_stack:
  added:
    - next@15.5.16
    - "@supabase/supabase-js@2.105.3"
    - "@supabase/ssr@0.10.2"
    - decimal.js@10.6.0
    - framer-motion@12.38.0
    - server-only
    - tailwindcss@4.x (via create-next-app)
  patterns:
    - Supabase SSR split-client pattern (createBrowserClient / createServerClient)
    - Next.js 15 async cookies() server client
    - Middleware JWT validation via getUser() (not getSession())
    - Tailwind v4 CSS-first @theme configuration
key_files:
  created:
    - pulse/src/lib/supabase/client.ts
    - pulse/src/lib/supabase/server.ts
    - pulse/middleware.ts
    - pulse/src/app/globals.css
    - pulse/src/app/layout.tsx
    - pulse/src/app/page.tsx
    - pulse/.env.local.example
    - pulse/.gitignore
    - pulse/package.json
  modified: []
decisions:
  - "Pinned Next.js to v15 (15.5.16) per CLAUDE.md; npm latest is v16"
  - "Used NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (sb_publishable_ format) — new post-Nov 2025 Supabase key"
  - "Client and server Supabase clients both include ?? fallback to NEXT_PUBLIC_SUPABASE_ANON_KEY for legacy project compatibility"
  - "Tailwind v4 @theme used in globals.css; no tailwind.config.js created"
  - "Unignored .env*.example in pulse/.gitignore so the example file can be committed"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-06"
  tasks_completed: 2
  tasks_total: 2
  files_created: 14
  files_modified: 3
---

# Phase 01 Plan 01: Next.js 15 Scaffold + Supabase SSR Wiring Summary

**One-liner:** Next.js 15 App Router scaffold with @supabase/ssr split-client pair (createBrowserClient/createServerClient), getUser()-based middleware JWT validation, Tailwind v4 @theme tokens, and all production dependencies installed.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Create Supabase project (human-action) | — | Credentials provided by user |
| 2 | Scaffold Next.js 15 + install dependencies | 5219bdd | package.json, globals.css, layout.tsx, page.tsx, .env.local.example |
| 3 | Wire Supabase SSR client pair + middleware | af714bd | src/lib/supabase/client.ts, src/lib/supabase/server.ts, middleware.ts |

## Verification Results

- `npm run build` exits 0 — Next.js 15.5.16, Turbopack, middleware compiled (90.6 kB)
- `npx tsc --noEmit` exits 0 — no type errors
- `grep createBrowserClient src/lib/supabase/client.ts` — found (2 occurrences)
- `grep createServerClient src/lib/supabase/server.ts` — found (2 occurrences)
- `grep "import 'server-only'" src/lib/supabase/server.ts` — found
- `grep "await cookies()" src/lib/supabase/server.ts` — found
- `grep -v "^//" middleware.ts | grep "getUser()"` — found (not getSession())
- `grep "getSession" middleware.ts` — found only in comment (not in live code)
- `.env.local` contains real NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Config] Unignore .env*.example in pulse/.gitignore**
- **Found during:** Task 2
- **Issue:** `pulse/.gitignore` had `.env*` which blocked committing `.env.local.example`
- **Fix:** Added `!.env*.example` negation rule to pulse/.gitignore
- **Files modified:** `pulse/.gitignore`
- **Commit:** 5219bdd

No other deviations — plan executed as written.

## Known Stubs

None — this plan only scaffolds infrastructure (no data-rendering components).

## Threat Surface Scan

All mitigations from the plan's threat model applied:

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-1-01 | `getUser()` in middleware (not `getSession()`) | Applied — verified via grep |
| T-1-02 | @supabase/ssr HttpOnly cookie handling | Applied — createServerClient pattern used |
| T-1-03 | .env.local excluded from git | Applied — .gitignore has .env* rule |
| T-1-04 | `import 'server-only'` in server.ts | Applied — line 1 of server.ts |
| T-1-05 | CSRF via Next.js Server Actions default | Applied — Server Action pattern will be used in auth pages |

No new threat surfaces introduced beyond plan scope.

## Self-Check: PASSED

- [x] `pulse/src/lib/supabase/client.ts` — exists
- [x] `pulse/src/lib/supabase/server.ts` — exists
- [x] `pulse/middleware.ts` — exists
- [x] `pulse/.env.local.example` — exists
- [x] `pulse/package.json` — next@15.5.16 confirmed
- [x] Commit 5219bdd — exists in git log
- [x] Commit af714bd — exists in git log
- [x] STATE.md — NOT modified (per instructions)
- [x] ROADMAP.md — NOT modified (per instructions)
