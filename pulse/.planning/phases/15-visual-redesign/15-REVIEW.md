---
phase: 15-visual-redesign
reviewed: 2026-05-20T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - pulse/src/app/globals.css
  - pulse/src/app/layout.tsx
  - pulse/src/components/ui/Card.tsx
  - pulse/src/components/ui/Badge.tsx
  - pulse/src/components/ui/Button.tsx
  - pulse/src/components/ui/StatTile.tsx
  - pulse/src/app/dashboard/TabBar.tsx
  - pulse/src/app/dashboard/page.tsx
  - pulse/src/app/dashboard/components/AnimatedTabPanel.tsx
  - pulse/src/app/dashboard/components/WatchListTab.tsx
  - pulse/src/components/PortfolioTab.tsx
  - pulse/src/app/dashboard/components/TrustWeightSlider.tsx
  - pulse/src/app/dashboard/creators-tab.tsx
  - pulse/src/app/dashboard/components/BlendSummary.tsx
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-05-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Phase 15 is a visual redesign layer (glassmorphism, typography, animation). The core logic is mostly inherited from earlier phases. Most files are clean. One critical bug exists in `WatchListTab.tsx` where a variable is referenced before it is assigned. Five warnings cover incorrect font application, a missing dependency in `useEffect`, stale-closure risk in an async budget handler, and two minor logic gaps. Four info items cover dead markup, accessibility gaps, and minor inconsistencies.

---

## Critical Issues

### CR-01: `stale` variable used before declaration in `getPriceColorClass`

**File:** `pulse/src/app/dashboard/components/WatchListTab.tsx:133`
**Issue:** `getPriceColorClass` is a function defined on line 131 that references the `stale` variable on lines 133 and 136. `stale` is declared via `const stale = isStale(priceTimestamp)` on line 209, well below the function definition. In JavaScript/TypeScript `const` and `let` are not hoisted — when `getPriceColorClass` is called the closure captures the binding, but `stale` is in the temporal dead zone at module evaluation time. In React components the function body isn't executed at definition time, so the runtime will correctly see the `stale` value computed on line 209 **only because** both lines are inside the same component function body and `getPriceColorClass` is only ever called after the component renders past line 209. However this is an order-dependent code smell that is one refactor away from breaking, and static analysis tools (ESLint `no-use-before-define`) will flag it as an error. If `getPriceColorClass` were ever moved to module scope or called during initialisation it would throw `ReferenceError`.

More concretely: `stale` is a derived value (`const stale = isStale(priceTimestamp)`). Any call to `getPriceColorClass` before line 209 is reached in the render path would silently use `undefined` (coerced to falsy), suppressing the amber stale colour entirely.

**Fix:** Move `const stale = isStale(priceTimestamp)` above the function definitions that use it (before line 124), or pass `stale` as a parameter:

```typescript
// Option A — hoist the declaration above the helper functions (line ~124):
const stale = isStale(priceTimestamp)

const getPriceColorClass = (ticker: string): string => {
  const pct = getPriceChangePct(ticker)
  if (pct === null) return stale ? 'text-amber-400' : 'text-white'
  if (pct > 0) return 'text-green-400'
  if (pct < 0) return 'text-red-400'
  return stale ? 'text-amber-400' : 'text-white'
}
```

---

## Warnings

### WR-01: Font variable applied with non-standard Tailwind syntax — font may silently not apply

**File:** `pulse/src/app/layout.tsx:20`
**Issue:** The body uses `className="font-[var(--font-geist)]"`. Tailwind's arbitrary-value syntax for `font-family` expects a font name string, not a CSS variable reference — `font-[var(--font-geist)]` emits `font-family: var(--font-geist)` only in Tailwind v4 with JIT. In Tailwind v3 (which this project likely uses given `@import "tailwindcss"` in globals.css is a v4 pattern, but the package may still be v3) arbitrary font values via `var()` are not reliably supported and the class may be purged or produce an incorrect rule. Additionally, `globals.css` defines `--font-geist` in `@theme` (a Tailwind v4 construct), but the `next/font/google` loader also injects `--font-geist` as a CSS variable on the `<html>` element via the `variable` option. If both resolve to the same variable name they may conflict or one may shadow the other.

The conventional and reliable pattern for Next.js + `next/font` is to apply the variable class on `<html>` (which is already done) and reference it via `font-sans` override in Tailwind config, or use `style={{ fontFamily: "var(--font-geist)" }}` directly.

**Fix:**
```tsx
// In layout.tsx — use inline style for certainty:
<body style={{ fontFamily: 'var(--font-geist)' }}>{children}</body>

// OR configure tailwind.config.ts to extend fontFamily:
// theme: { extend: { fontFamily: { sans: ['var(--font-geist)', 'sans-serif'] } } }
// then use className="font-sans"
```

### WR-02: `useEffect` missing `count` in dependency array — animation does not re-trigger on `count` reset

**File:** `pulse/src/components/ui/StatTile.tsx:34`
**Issue:** The `eslint-disable-line react-hooks/exhaustive-deps` comment suppresses a legitimate warning. The `count` motion value is created via `useMotionValue(0)` and is used inside the effect, but omitted from the dependency array. When `value` prop changes, `numeric` changes, `count` is unchanged (it's a stable object), so the effect correctly re-fires on `numeric` change. However the `count.set(numeric)` path in the `shouldReduceMotion` branch also uses `count` implicitly. The real issue: if `shouldAnimate` or `shouldReduceMotion` changes without `numeric` changing, the effect fires but `count` is not in deps — this is the exact scenario the exhaustive-deps rule guards. The suppression comment hides whether this is intentional, and silences future genuine regressions.

**Fix:** Remove the suppression and either add `count` to the dependency array (it is a stable ref so it won't cause extra runs) or document with a targeted disable with explanation:

```typescript
useEffect(() => {
  if (!shouldAnimate || shouldReduceMotion) {
    count.set(numeric)
    return
  }
  const controls = animate(count, numeric, { duration: 0.8, ease: 'easeOut' })
  return controls.stop
}, [numeric, shouldAnimate, shouldReduceMotion, count]) // count is stable MotionValue ref
```

### WR-03: Budget input accepts values above ISA annual limit without validation

**File:** `pulse/src/app/dashboard/components/WatchListTab.tsx:501`
**Issue:** The per-creator monthly budget input has `max="20000"` (the full annual ISA allowance). A single creator monthly budget of £20,000 would imply £240,000/year — far exceeding the £20,000 annual ISA limit. The HTML `max` attribute prevents values above 20000 from being submitted via native form validation, but `type="number"` + programmatic `setState` bypasses this: the `onChange` handler on line 506 calls `parseFloat` and only applies `Math.max(0, raw)` — there is no upper bound enforced in JavaScript. A user can type a value larger than 20000 and it will be saved to the database.

Per CLAUDE.md, the annual ISA limit is £20,000. A reasonable monthly budget upper bound is £20,000 / 12 ≈ £1,667, but even capping at £20,000/month would be a data integrity improvement.

**Fix:**
```typescript
const val = isNaN(raw) ? 0 : Math.min(20000, Math.max(0, raw))
```

### WR-04: `handleSaveBudget` captures stale `userCreatorIdMap` from closure

**File:** `pulse/src/app/dashboard/components/WatchListTab.tsx:167`
**Issue:** `handleSaveBudget` looks up `userCreatorIdMap[creatorId]` from the prop directly. `userCreatorIdMap` is a prop (not state), so it is fixed for the lifetime of this component mount — it cannot change without a full page remount (server refetch). This is currently safe. However the async `saveCreatorMonthlyBudget` call on line 173 uses `userCreatorId` from that lookup. If `userCreatorIdMap` does not contain `creatorId` (e.g. a creator was untracked in another tab between renders), `userCreatorId` will be `undefined` and will be passed to the server action, potentially causing a silent server error or corrupting an unrelated row.

**Fix:** Guard against missing map entry:
```typescript
const userCreatorId = userCreatorIdMap[creatorId]
if (!userCreatorId) {
  setBudgetError((e) => ({ ...e, [creatorId]: 'Creator not found — please refresh the page.' }))
  setSavingBudget((s) => ({ ...s, [creatorId]: false }))
  return
}
```

### WR-05: `AnimatedTabPanel` wraps an RSC (`DashboardPage`) child — `AnimatePresence` exit animation never fires

**File:** `pulse/src/app/dashboard/components/AnimatedTabPanel.tsx:31`
**Issue:** `AnimatedTabPanel` uses `AnimatePresence mode="wait"` with `exit` animations. The children (`PortfolioTab`, `WatchListTab`) are rendered by the RSC parent `DashboardPage`. Tab navigation calls `router.push(?tab=...)` which triggers a server-side navigation and full RSC re-render. By the time React reconciles the new tree the exiting child has already been replaced — `AnimatePresence` never gets to run the `exit` animation because the component unmounts synchronously from React's perspective during the RSC transition, not from a state change within the client tree.

The `exit: { opacity: 0, x: -16 }` will therefore never be visible. The `initial` animation (`opacity: 0, x: 16`) will play correctly on mount.

**Fix:** To get bidirectional tab transitions, tab state must live in client-side state (e.g. `useState` in a client layout wrapper), not in the URL-driven RSC. Either accept that exit animations are lost (remove `exit` prop to avoid misleading code), or migrate tab state to a client component that keeps both panels mounted and uses `key`-based conditional rendering:

```tsx
// Accept the limitation and remove exit:
<motion.div
  key={tabKey}
  initial={{ opacity: 0, x: shouldReduceMotion ? 0 : 16 }}
  animate={{ opacity: 1, x: 0 }}
  // no exit — RSC navigation replaces the tree before exit can run
  transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: 'easeOut' }}
>
```

---

## Info

### IN-01: `Card` component's `WebkitBackdropFilter` inline style duplicates Tailwind's `backdrop-blur-xl`

**File:** `pulse/src/components/ui/Card.tsx:14`
**Issue:** `backdrop-blur-xl` (a Tailwind utility) emits both `-webkit-backdrop-filter` and `backdrop-filter` in modern Tailwind. The additional `style={{ WebkitBackdropFilter: 'blur(24px)' }}` is redundant and the hardcoded `24px` does not match what `backdrop-blur-xl` produces (`blur(24px)` — they happen to match, but if Tailwind's definition changes this inline style would drift). The same pattern is repeated inline in `DashboardPage` (line 237) and `PortfolioTab` mobile cards (line 217).

**Fix:** Remove the `style` prop from `Card` and the inline duplicates elsewhere; rely solely on Tailwind's `backdrop-blur-xl`.

### IN-02: Macro themes strip uses array index as React `key`

**File:** `pulse/src/app/dashboard/components/WatchListTab.tsx:539`
**Issue:** `key={i}` (array index) is used for the `macroThemes.slice(0, 3)` badge list. If the theme list changes order React will not correctly reconcile items. Use a stable identifier.

**Fix:**
```tsx
{newsContext.macroThemes.slice(0, 3).map((theme, i) => (
  <Badge key={`${theme.sector}-${theme.theme}`} ...>
```

### IN-03: `creators-tab.tsx` animation variants do not respect `useReducedMotion`

**File:** `pulse/src/app/dashboard/creators-tab.tsx:14-19`
**Issue:** `creatorListVariants` and `creatorItemVariants` are defined at module scope as constants with hardcoded `y: 8` and `duration: 0.25`. Unlike `WatchListTab` (which correctly guards with `shouldReduceMotion`), the creators tab does not conditionally zero out these values. Users with `prefers-reduced-motion` will still see translate animations.

**Fix:** Move variant definitions inside the component and apply the `useReducedMotion` guard:
```typescript
const shouldReduceMotion = useReducedMotion()
const creatorItemVariants = {
  hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 8 },
  visible: { opacity: 1, y: 0, transition: { duration: shouldReduceMotion ? 0 : 0.25, ease: 'easeOut' as const } },
}
```

### IN-04: `TrustWeightSlider` — `setTimeout` for `saved` tick not cleared on unmount

**File:** `pulse/src/app/dashboard/components/TrustWeightSlider.tsx:51`
**Issue:** `setTimeout(() => setSaved(false), 1500)` is not stored and never cleared. If the `SingleSlider` unmounts within 1.5 seconds of a save (e.g. user navigates away), the `setSaved(false)` call fires on an unmounted component. In React 18 this is a no-op with a console warning rather than a memory leak, but it is still sloppy and will produce noise in dev.

**Fix:**
```typescript
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

// in handleRelease:
if (timerRef.current) clearTimeout(timerRef.current)
timerRef.current = setTimeout(() => setSaved(false), 1500)

// cleanup:
useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])
```

---

_Reviewed: 2026-05-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
