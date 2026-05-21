---
phase: 15-visual-redesign
fixed_at: 2026-05-20T00:00:00Z
review_path: .planning/phases/15-visual-redesign/15-REVIEW.md
iteration: 2
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
---

# Phase 15: Code Review Fix Report

**Fixed at:** 2026-05-20T00:00:00Z
**Source review:** .planning/phases/15-visual-redesign/15-REVIEW.md
**Iteration:** 2

**Summary:**
- Findings in scope: 10 (6 CR/WR fixed in iteration 1 + 4 Info fixed in iteration 2)
- Fixed: 10
- Skipped: 0

## Fixed Issues

### CR-01: `stale` variable used before declaration in `getPriceColorClass`

**Files modified:** `pulse/src/app/dashboard/components/WatchListTab.tsx`
**Commit:** 0bd80c4
**Applied fix:** Moved `const stale = isStale(priceTimestamp)` above the `sectionVariants` block (before `getPriceColorClass` and `getPriceChangePct`). Removed the duplicate `const stale` declaration that had been sitting after `handleRefreshNews`.

### WR-01: Font variable applied with non-standard Tailwind syntax

**Files modified:** `pulse/src/app/layout.tsx`
**Commit:** b250b31
**Applied fix:** Replaced `className="font-[var(--font-geist)]"` on `<body>` with `style={{ fontFamily: 'var(--font-geist)' }}`.

### WR-02: `useEffect` missing `count` in dependency array

**Files modified:** `pulse/src/components/ui/StatTile.tsx`
**Commit:** accb0f0
**Applied fix:** Added `count` to the dependency array and removed the `eslint-disable-line react-hooks/exhaustive-deps` comment. Replaced with an explanatory inline comment noting `count` is a stable MotionValue ref.

### WR-03: Budget input accepts values above ISA annual limit without validation

**Files modified:** `pulse/src/app/dashboard/components/WatchListTab.tsx`
**Commit:** 0bd80c4
**Applied fix:** Added `Math.min(20000, ...)` upper-bound to the budget `onChange` handler: `const val = isNaN(raw) ? 0 : Math.min(20000, Math.max(0, raw))`.

### WR-04: `handleSaveBudget` captures stale `userCreatorIdMap` from closure

**Files modified:** `pulse/src/app/dashboard/components/WatchListTab.tsx`
**Commit:** 0bd80c4
**Applied fix:** Added guard after `userCreatorId` lookup — if the entry is missing, sets a user-visible error message and returns early before calling the server action.

### WR-05: `AnimatedTabPanel` exit animation never fires due to RSC navigation

**Files modified:** `pulse/src/app/dashboard/components/AnimatedTabPanel.tsx`
**Commit:** 73bceb6
**Applied fix:** Removed the `exit` prop from `motion.div`. Added a comment explaining that RSC navigation replaces the tree before AnimatePresence can execute exit transitions.

### IN-01: Card `WebkitBackdropFilter` inline style removed

**Files modified:** `pulse/src/components/ui/Card.tsx`
**Commit:** 340967f
**Applied fix:** Removed `style={{ WebkitBackdropFilter: 'blur(24px)' }}` from the Card div. Tailwind's `backdrop-blur-xl` already emits the `-webkit-backdrop-filter` prefixed rule.

### IN-02: Stable composite key on macro themes badges

**Files modified:** `pulse/src/app/dashboard/components/WatchListTab.tsx`
**Commit:** 7c725d3
**Applied fix:** Replaced `key={i}` (array index) with `key={\`${theme.sector}-${theme.theme}\`}` on the `.map()` for `macroThemes.slice(0, 3)`. Removed the now-unused `i` parameter.

### IN-03: `creatorItemVariants` respects `useReducedMotion`

**Files modified:** `pulse/src/app/dashboard/creators-tab.tsx`
**Commit:** c5458e6
**Applied fix:** Added `useReducedMotion` import. Moved `creatorListVariants` and `creatorItemVariants` from module scope into the component body. Variants now conditionally zero `y` and `duration` when `shouldReduceMotion` is true.

### IN-04: `setTimeout` cleared on unmount in `TrustWeightSlider`

**Files modified:** `pulse/src/app/dashboard/components/TrustWeightSlider.tsx`
**Commit:** 324ad7a
**Applied fix:** Added `useRef` and `useEffect` imports. Added `timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)` in `SingleSlider`. `handleRelease` clears any existing timer before setting a new one. Cleanup `useEffect` clears the timer on unmount.

---

_Fixed: 2026-05-20T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
