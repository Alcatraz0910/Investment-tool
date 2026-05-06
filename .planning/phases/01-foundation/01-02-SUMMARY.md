---
phase: 01-foundation
plan: "02"
subsystem: auth-ui
tags: [auth, next-auth, server-actions, supabase, tailwind]
dependency_graph:
  requires: ["01-01"]
  provides: ["auth-pages", "dashboard-placeholder"]
  affects: ["all-subsequent-plans"]
tech_stack:
  added: []
  patterns:
    - "Server Actions as direct form action props (formData => Promise<void>)"
    - "searchParams-based error display for Server Component forms"
    - "Defence-in-depth: middleware + page-level getUser() auth check"
key_files:
  created:
    - pulse/src/app/auth/login/actions.ts
    - pulse/src/app/auth/signup/actions.ts
    - pulse/src/app/auth/login/page.tsx
    - pulse/src/app/auth/signup/page.tsx
    - pulse/src/app/dashboard/page.tsx
  modified: []
decisions:
  - "Used (formData: FormData) => Promise<void> signature for direct form actions instead of useFormState-compatible two-arg signature — simpler, no client JS required for baseline function"
  - "Error display via URL searchParams (?error=code) — Server Component compatible, no useState needed"
  - "Error messages mapped from URL codes to human-readable copy in page components"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-06"
  tasks_completed: 2
  tasks_total: 3
  files_created: 5
  files_modified: 0
---

# Phase 1 Plan 02: Auth Pages — Login, Signup, Dashboard Summary

Auth pages and Server Actions wired to Supabase with searchParams-based error display and defence-in-depth session checks on the protected dashboard.

## Tasks Completed

| # | Name | Status | Commit |
|---|------|--------|--------|
| 1 | Create Server Actions for sign in, sign up, and sign out | Complete | 8e361bf |
| 2 | Build auth pages and dashboard placeholder per UI-SPEC | Complete | f906dc0 |
| 3 | Verify auth flow end-to-end in browser | **Checkpoint — awaiting human verification** | — |

## Task 3: Checkpoint Pending

Task 3 is a `checkpoint:human-verify` gate. The build passes and all files are committed. Browser verification is required before the plan can be marked complete.

**What to run:** `cd pulse && npm run dev` then visit http://localhost:3000

**8 tests to perform:**
1. Visit http://localhost:3000 — expect redirect to /auth/login
2. Visit http://localhost:3000/dashboard while logged out — expect redirect to /auth/login
3. Sign up at /auth/signup with a real email + 6+ char password — expect redirect to /auth/login
4. Sign in at /auth/login — expect redirect to /dashboard showing "Welcome, your@email.com"
5. Refresh /dashboard (F5) — expect stay on dashboard (session persists)
6. Click "Sign out" — expect redirect to /auth/login
7. Sign in again then navigate to /auth/login — expect middleware redirect to /dashboard
8. Enter wrong password on /auth/login — expect "Incorrect email or password. Try again."

**Resume signal:** "approved" if all 8 pass, or describe the failing test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Refactored Server Action signatures for direct form action compatibility**

- **Found during:** Task 2 build — `npm run build` failed with TypeScript error on `<form action={signIn}>`
- **Issue:** Plan specified `useFormState`-compatible two-arg signature `(_prevState, formData)` but Next.js 15 form `action` prop requires `(formData: FormData) => void | Promise<void>`. The plan's own NOTE acknowledged this was a "Phase 1" simplification but the scaffold didn't match.
- **Fix:** Changed both actions to `(formData: FormData) => Promise<void>`. Validation errors now redirect with `?error=<code>` query params. Pages decode these in `searchParams` and map to human-readable copy from a `ERROR_MESSAGES` lookup.
- **Files modified:** `pulse/src/app/auth/login/actions.ts`, `pulse/src/app/auth/signup/actions.ts`, `pulse/src/app/auth/login/page.tsx`, `pulse/src/app/auth/signup/page.tsx`
- **Commit:** f906dc0

**Side effect:** Error display is now URL-visible (`?error=invalid_credentials`) which is acceptable for Phase 1. Error codes are opaque slugs, not leaking internal detail.

## Known Stubs

- `/dashboard` page body: "Phase 1 placeholder. Portfolio features coming in Phase 2." — intentional per plan (D-07 and PLAN.md objective). Resolved in Phase 2.

## Threat Surface Scan

All threat mitigations from the plan's `<threat_model>` are present:

| Threat | Status |
|--------|--------|
| T-1-06: Empty-field guards on signIn | Implemented — guard before Supabase call, redirect with ?error=missing_fields |
| T-1-07: Defence-in-depth getUser() on dashboard | Implemented — dashboard page calls getUser() and redirects if !user |
| T-1-08: Email enumeration on signup | Implemented — "already registered" mapped to safe message |
| T-1-09: Confirm password bypass | Implemented — server-side password !== confirmPassword check in signUp action |
| T-1-10: CSRF on Server Actions | Accepted — Next.js 15 origin-checks by default |

No new threat surface introduced beyond what the plan modelled.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| pulse/src/app/auth/login/actions.ts | FOUND |
| pulse/src/app/auth/signup/actions.ts | FOUND |
| pulse/src/app/auth/login/page.tsx | FOUND |
| pulse/src/app/auth/signup/page.tsx | FOUND |
| pulse/src/app/dashboard/page.tsx | FOUND |
| commit 8e361bf | FOUND |
| commit f906dc0 | FOUND |
| npm run build | EXIT 0 |
