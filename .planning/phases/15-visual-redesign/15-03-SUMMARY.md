---
phase: 15
plan: "03"
subsystem: dashboard / tab-bar / watch-list
tags: [framer-motion, tab-bar, badge, card, useReducedMotion, layoutId]
dependency_graph:
  requires: [15-01, 15-02]
  provides: [TabBar Client Component, AnimatedTabPanel x-axis wipe, WatchListTab Card+Badge]
  affects:
    - pulse/src/app/dashboard/TabBar.tsx
    - pulse/src/app/dashboard/page.tsx
    - pulse/src/app/dashboard/components/AnimatedTabPanel.tsx
    - pulse/src/app/dashboard/components/WatchListTab.tsx
tech_stack:
  added: []
  patterns:
    - framer-motion layoutId shared-layout animation
    - useReducedMotion guard on all animation durations and transforms
    - useRouter().push() for client-side tab navigation (keeps TabBar mounted)
    - Card + Badge primitives from pulse/src/components/ui/
key_files:
  created:
    - pulse/src/app/dashboard/TabBar.tsx
  modified:
    - pulse/src/app/dashboard/page.tsx
    - pulse/src/app/dashboard/components/AnimatedTabPanel.tsx
    - pulse/src/app/dashboard/components/WatchListTab.tsx
decisions:
  - "useRouter().push() used for tab navigation — <a href> causes RSC remount which breaks layoutId sliding indicator"
  - "opacity on creator card wrapper moved to style prop on motion.div (not Card) to preserve Framer Motion whileHover compositing"
  - "News context panel intentionally NOT wrapped in hover lift — spec explicitly excludes it (functional display, not navigable card)"
  - "CONVICTION_CLASS and CONVICTION_LABEL constants fully removed — Badge variant handles all conviction styling"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-20"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
requirements: [VIS-01, VIS-03, VIS-04, VIS-05]
---

# Phase 15 Plan 03: Tab Bar + WatchListTab Redesign Summary

Pill-style frosted glass tab bar with `layoutId` sliding indicator extracted to TabBar Client Component using `useRouter().push()`; AnimatedTabPanel upgraded to x-axis wipe with `mode="wait"`; WatchListTab creator cards and All Picks panel replaced with Card primitive; all ad-hoc badge spans replaced with Badge primitive; stagger and hover lift guarded by `useReducedMotion`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create TabBar Client Component and wire into page.tsx | 5152fb0 | pulse/src/app/dashboard/TabBar.tsx, pulse/src/app/dashboard/page.tsx |
| 2 | Upgrade AnimatedTabPanel and apply Card + Badge to WatchListTab | 9325a1a | pulse/src/app/dashboard/components/AnimatedTabPanel.tsx, pulse/src/app/dashboard/components/WatchListTab.tsx |

## Verification Results

1. `grep "layoutId=\"tab-indicator\"" pulse/src/app/dashboard/TabBar.tsx` — 1 match
2. `grep "useRouter" pulse/src/app/dashboard/TabBar.tsx` — matches (import + usage)
3. `grep "<a href" pulse/src/app/dashboard/TabBar.tsx` — 0 matches
4. `grep "mode=\"wait\"" pulse/src/app/dashboard/components/AnimatedTabPanel.tsx` — 1 match
5. `grep "CONVICTION_CLASS" pulse/src/app/dashboard/components/WatchListTab.tsx` — 0 matches
6. `grep "from.*components/ui/Card" pulse/src/app/dashboard/components/WatchListTab.tsx` — 1 match
7. `grep "from.*components/ui/Badge" pulse/src/app/dashboard/components/WatchListTab.tsx` — 1 match
8. `cd pulse && npx tsc --noEmit` — exits 0

## Acceptance Criteria

- [x] TabBar.tsx exists with `'use client'`
- [x] TabBar.tsx imports `useRouter` from `'next/navigation'`
- [x] TabBar.tsx uses `router.push(\`?tab=${tab.id}\`)` — no `<a href>` for tabs
- [x] TabBar.tsx contains `layoutId="tab-indicator"`
- [x] TabBar.tsx contains `WebkitBackdropFilter: 'blur(24px)'`
- [x] TabBar.tsx contains `shouldReduceMotion` guard on spring transition
- [x] TabBar.tsx contains `rounded-full bg-accent` on indicator motion.div
- [x] TabBar.tsx contains `min-h-[36px]` on tab button elements
- [x] page.tsx imports `{ TabBar }` from `'./TabBar'`
- [x] page.tsx contains `<TabBar tabs={tabs} activeTab={activeTab} />`
- [x] page.tsx does NOT contain `border-b-2 border-accent`
- [x] AnimatedTabPanel.tsx contains `mode="wait"`
- [x] AnimatedTabPanel.tsx contains `x: shouldReduceMotion ? 0 : 16`
- [x] AnimatedTabPanel.tsx contains `x: shouldReduceMotion ? 0 : -16`
- [x] WatchListTab.tsx imports `Card` from `@/components/ui/Card`
- [x] WatchListTab.tsx imports `Badge` from `@/components/ui/Badge`
- [x] WatchListTab.tsx imports `useReducedMotion` from `'framer-motion'`
- [x] WatchListTab.tsx contains `shouldReduceMotion ? 0 : 0.07` stagger guard
- [x] WatchListTab.tsx contains `whileHover` with `y: -3, scale: 1.01`
- [x] WatchListTab.tsx does NOT contain `CONVICTION_CLASS`
- [x] WatchListTab.tsx does NOT contain inline Consensus badge span classes
- [x] WatchListTab.tsx does NOT contain `backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4` on a plain div

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all badge and card wiring is fully connected to live data. No hardcoded or placeholder values introduced.

## Threat Flags

No new threat surface beyond what is documented in the plan threat model:
- T-15-03-01 (Badge title XSS) — accepted; `title` is a browser-escaped HTML attribute
- T-15-03-02 (TabBar router.push injection) — accepted; tab.id values are static literals
- T-15-03-03 (AnimatePresence mode="wait") — accepted; pure UI state

## Self-Check: PASSED

- pulse/src/app/dashboard/TabBar.tsx — created, verified
- pulse/src/app/dashboard/page.tsx — modified, verified
- pulse/src/app/dashboard/components/AnimatedTabPanel.tsx — modified, verified
- pulse/src/app/dashboard/components/WatchListTab.tsx — modified, verified
- Commit 5152fb0 — exists (feat(15-03): create TabBar Client Component)
- Commit 9325a1a — exists (feat(15-03): upgrade AnimatedTabPanel x-axis wipe)
- npx tsc --noEmit — exits 0
