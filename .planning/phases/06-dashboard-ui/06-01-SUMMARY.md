---
phase: "06"
plan: "06-01"
title: "Design System: globals.css body token, page.tsx shell restyle, AnimatedTabPanel"
subsystem: dashboard-ui
status: complete
completed: "2026-05-07"
duration: "~10 minutes"

tags: [design-system, framer-motion, tailwind-css-v4, animation, glassmorphism]

dependency_graph:
  requires: ["06-00"]
  provides: ["design-tokens-wired", "AnimatedTabPanel", "dashboard-shell-restyled"]
  affects: ["06-02", "06-03", "06-04", "06-05", "06-06"]

tech_stack:
  added: ["framer-motion (AnimatePresence, motion.div)"]
  patterns: ["CSS @theme variable consumption", "AnimatePresence mode=wait tab fade", "Tailwind CSS v4 semantic tokens"]

key_files:
  modified:
    - pulse/src/app/globals.css
    - pulse/src/app/dashboard/page.tsx
  created:
    - pulse/src/app/dashboard/components/AnimatedTabPanel.tsx

decisions:
  - "body background uses var(--color-base) — single source of truth for Space Grey base"
  - "AnimatedTabPanel import from 'framer-motion' (not 'motion/react') per RESEARCH Pitfall 7"
  - "tab active text uses text-accent (Electric Indigo) per UI-SPEC D-01"
  - "outer card is backdrop-blur-xl bg-white/5 glassmorphism per UI-SPEC D-02"

metrics:
  tasks_completed: 3
  tasks_total: 3
  files_created: 1
  files_modified: 2
  commits: 3
---

# Phase 6 Plan 01: Design System — Body Token, Shell Restyle, AnimatedTabPanel Summary

## One-liner

Space Grey + Electric Indigo design tokens wired into dashboard shell: body uses CSS variable, page.tsx restyled to max-w-4xl glassmorphism card with accent-coloured tab nav, and AnimatedTabPanel client wrapper added for D-11.2 opacity/y fade.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update globals.css body rule | 80c6f64 | pulse/src/app/globals.css |
| 2 | Create AnimatedTabPanel.tsx | 2c3f450 | pulse/src/app/dashboard/components/AnimatedTabPanel.tsx |
| 3 | Restyle page.tsx shell | 8784247 | pulse/src/app/dashboard/page.tsx |

## What Was Built

**Task 1 — globals.css:** Replaced hardcoded `background-color: #1C1C1E` with `var(--color-base)`. The `@theme` block with all 5 tokens (`--color-surface`, `--color-base`, `--color-border`, `--color-accent`, `--color-accent-hover`) was left untouched.

**Task 2 — AnimatedTabPanel.tsx:** New `'use client'` component. Wraps children in `AnimatePresence mode="wait"` + `motion.div` keyed on `tabKey`. Animation: `initial={{ opacity: 0, y: 8 }}`, `animate={{ opacity: 1, y: 0 }}`, `exit={{ opacity: 0, y: -8 }}`, `transition={{ duration: 0.2, ease: 'easeOut' }}`. Imports from `'framer-motion'` (not `'motion/react'`).

**Task 3 — page.tsx:** Seven className changes applied:
- `bg-zinc-900` → `bg-base` on `<main>`
- `max-w-2xl` → `max-w-4xl`
- Outer card: `bg-zinc-800 border border-zinc-700` → `backdrop-blur-xl bg-white/5 border border-white/10`
- Tab bar border: `border-zinc-700` → `border-border`
- Active tab: `border-indigo-500 text-white` → `border-accent text-accent`
- Inactive tab: `hover:text-zinc-200 ring-indigo-500` → `hover:text-white ring-accent`
- Sign out button: `border-zinc-700 hover:bg-zinc-800 ring-indigo-500` → `border-border hover:bg-white/5 ring-accent`
- All tab panels wrapped in `<AnimatedTabPanel tabKey={activeTab}>`

## Verification

- `npx vitest run`: 52 passed, 0 failed
- `grep "var(--color-base)" globals.css`: matched
- `grep "max-w-4xl" page.tsx`: matched
- `grep -c "indigo-500" page.tsx`: 0 (all replaced)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no placeholder text or hardcoded empty data in changed files.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes introduced.

## Self-Check: PASSED

- pulse/src/app/globals.css: FOUND (var(--color-base) confirmed)
- pulse/src/app/dashboard/components/AnimatedTabPanel.tsx: FOUND
- pulse/src/app/dashboard/page.tsx: FOUND (max-w-4xl, bg-base, AnimatedTabPanel confirmed)
- Commits: 80c6f64, 2c3f450, 8784247 — all in git log
