---
phase: 15
plan: "02"
subsystem: ui-primitives / design-system
tags: [card, badge, button, stat-tile, glassmorphism, framer-motion, css-vars]
dependency_graph:
  requires: [15-01]
  provides: [Card, Badge, Button, StatTile exports from pulse/src/components/ui/]
  affects: [all Phase 15 tab redesign plans, WatchListTab.tsx, PortfolioTab.tsx]
tech_stack:
  added: []
  patterns: [framer-motion useMotionValue/useTransform count-up, CSS var token classes (bg-accent/focus:ring-accent), WebkitBackdropFilter iOS Safari compat]
key_files:
  created:
    - pulse/src/components/ui/Card.tsx
    - pulse/src/components/ui/Badge.tsx
    - pulse/src/components/ui/Button.tsx
    - pulse/src/components/ui/StatTile.tsx
  modified: []
decisions:
  - "Button uses CSS var tokens (bg-accent, focus:ring-accent) not hardcoded indigo values — ensures single-source-of-truth with globals.css"
  - "StatTile animation collapses to instant snap when useReducedMotion() returns true — accessibility requirement"
  - "Card does not use 'use client' directive — it is a pure presentational wrapper with no hooks or interactivity"
  - "StatTile parseValue uses regex to extract prefix/numeric/suffix enabling arbitrary formatted strings like £12,450.00 or 42%"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-20"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
requirements: [VIS-02, VIS-03, VIS-04]
---

# Phase 15 Plan 02: UI Primitives Summary

Four shared UI primitives created in pulse/src/components/ui/: glassmorphism Card with iOS Safari WebkitBackdropFilter, 12-variant Badge with macro-theme sentiment dot, CSS-var-token Button with loading spinner, and animated StatTile with 800ms count-up respecting useReducedMotion.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create Card and Badge primitives | 86db455 | pulse/src/components/ui/Card.tsx, pulse/src/components/ui/Badge.tsx |
| 2 | Create Button and StatTile primitives | 6d1cfd8 | pulse/src/components/ui/Button.tsx, pulse/src/components/ui/StatTile.tsx |

## Verification Results

1. `ls pulse/src/components/ui/` — shows Card.tsx, Badge.tsx, Button.tsx, StatTile.tsx
2. `grep "WebkitBackdropFilter" pulse/src/components/ui/Card.tsx` — 1 match
3. `grep "bg-accent hover:bg-accent-hover" pulse/src/components/ui/Button.tsx` — 1 match
4. `grep "useReducedMotion" pulse/src/components/ui/StatTile.tsx` — 1 match
5. `npx tsc --noEmit` — exits 0

## Acceptance Criteria

- [x] pulse/src/components/ui/Card.tsx exists and contains `export function Card`
- [x] Card contains `WebkitBackdropFilter: 'blur(24px)'` in style prop
- [x] Card contains `backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl`
- [x] Card `padding='sm'` maps to `p-3`, `padding='md'` (default) maps to `p-4`
- [x] pulse/src/components/ui/Badge.tsx exists and contains `export function Badge`
- [x] Badge contains all 12 variant keys in VARIANT_CLASSES
- [x] Badge `macro-theme` variant renders sentiment dot child span
- [x] Badge `contradiction` variant class includes `cursor-help`
- [x] pulse/src/components/ui/Button.tsx exists and contains `export function Button`
- [x] Button contains `bg-accent hover:bg-accent-hover` (not hardcoded bg-indigo-500)
- [x] Button contains `focus:ring-accent` (not hardcoded focus:ring-indigo-500)
- [x] Button contains `min-h-[44px]` for size md
- [x] Button contains `min-h-[36px]` for size sm
- [x] Button contains SpinnerSVG and renders it when `loading={true}`
- [x] Button sets `disabled` when `loading={true}` (via `disabled={disabled || loading}`)
- [x] pulse/src/components/ui/StatTile.tsx exists and contains `export function StatTile`
- [x] StatTile imports `useMotionValue, useTransform, animate, useReducedMotion` from 'framer-motion'
- [x] StatTile contains `duration: 0.8` in the animate() call
- [x] StatTile contains `shouldReduceMotion` guard that skips animation
- [x] StatTile value renders via `<motion.p>` with the `display` MotionValue

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — these are pure component primitives with no data dependencies. All props are caller-supplied.

## Threat Flags

No new threat surface introduced beyond what was documented in the plan's threat model. All component props are typed; no dangerouslySetInnerHTML used in any primitive.

## Self-Check: PASSED

- pulse/src/components/ui/Card.tsx — created, verified
- pulse/src/components/ui/Badge.tsx — created, verified
- pulse/src/components/ui/Button.tsx — created, verified
- pulse/src/components/ui/StatTile.tsx — created, verified
- Commit 86db455 — exists (Card + Badge)
- Commit 6d1cfd8 — exists (Button + StatTile)
- npx tsc --noEmit exits 0
