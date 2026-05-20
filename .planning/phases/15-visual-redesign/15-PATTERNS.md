# Phase 15: Visual Redesign - Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** 7
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `pulse/src/components/ui/Card.tsx` | component | request-response | `pulse/src/app/dashboard/components/WatchListTab.tsx` (creator card divs, lines 419-421) | role-match |
| `pulse/src/components/ui/Badge.tsx` | component | transform | `pulse/src/app/dashboard/components/WatchListTab.tsx` (conviction/signal spans, lines 32-35, 438-461) | exact |
| `pulse/src/components/ui/Button.tsx` | component | request-response | `pulse/src/components/PortfolioTab.tsx` (button cluster, lines 183-215) | exact |
| `pulse/src/components/ui/StatTile.tsx` | component | transform | `pulse/src/app/dashboard/components/WatchListTab.tsx` (budget display, lines 466-476) + Framer Motion `animate()` pattern | partial |
| `pulse/src/app/dashboard/page.tsx` | component | request-response | self (tab bar block, lines 238-258) | exact (self-modify) |
| `pulse/src/app/dashboard/components/WatchListTab.tsx` | component | event-driven | self (stagger variants, lines 22-28; creator card, lines 406-667) | exact (self-modify) |
| `pulse/src/components/PortfolioTab.tsx` | component | event-driven | self (holdings table, lines 233-349) | exact (self-modify) |
| `pulse/src/app/globals.css` | config | transform | self (lines 1-14) | exact (self-modify) |
| `pulse/src/app/layout.tsx` | config | request-response | self (lines 1-22) | exact (self-modify) |

---

## Pattern Assignments

### `pulse/src/components/ui/Card.tsx` (component, presentational container)

**Analog:** `pulse/src/app/dashboard/components/WatchListTab.tsx`

**Glassmorphism pattern** (lines 419-421 and 315-316):
```tsx
// Creator card — exact glassmorphism class set used throughout codebase
<motion.div
  className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4 space-y-3"
  style={{ opacity: wl.profileLatestNull ? 0.8 : 1 }}
>
```

**News context panel variant** (lines 229):
```tsx
<div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
```

**Outer content card** (`dashboard/page.tsx` line 236):
```tsx
<div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl">
```

**Implementation notes:**
- `-webkit-backdrop-filter` must be applied via `style` prop: `style={{ WebkitBackdropFilter: 'blur(24px)' }}` — not present in any existing analog (iOS Safari gap to fix).
- `padding` prop maps: `sm` → `p-3`, `md` → `p-4` (default). The `p-3` variant is specified in UI-SPEC for mobile mini cards.
- Hover lift is applied by consumers wrapping `<Card>` in `<motion.div whileHover={...}>`, not by Card itself. Card is purely presentational.

```tsx
// pulse/src/components/ui/Card.tsx
import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: 'sm' | 'md'
}

export function Card({ children, className = '', padding = 'md' }: CardProps) {
  const padClass = padding === 'sm' ? 'p-3' : 'p-4'
  return (
    <div
      className={`backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl ${padClass} ${className}`}
      style={{ WebkitBackdropFilter: 'blur(24px)' }}
    >
      {children}
    </div>
  )
}
```

---

### `pulse/src/components/ui/Badge.tsx` (component, transform)

**Analog:** `pulse/src/app/dashboard/components/WatchListTab.tsx`

**Conviction badge pattern** (lines 32-35, 354-355):
```tsx
const CONVICTION_CLASS: Record<WatchListItem['conviction'], string> = {
  high: 'text-xs font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 rounded px-1.5 py-0.5',
  medium: 'text-xs font-semibold text-zinc-400 bg-zinc-700/50 border border-zinc-600/30 rounded px-1.5 py-0.5',
  low: 'text-xs font-semibold text-zinc-500 bg-zinc-800/50 border border-zinc-700/30 rounded px-1.5 py-0.5',
}
// usage:
<span className={CONVICTION_CLASS[item.conviction]}>{CONVICTION_LABEL[item.conviction]}</span>
```

**Sentiment trend badges** (lines 438-447):
```tsx
// Trending bullish:
<span className="text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/30 rounded-full px-2 py-0.5">
  Trending bullish
</span>
// Trending cautious:
<span className="text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5">
  Trending cautious
</span>
```

**Contradiction badge** (lines 453-459):
```tsx
<span
  title={reason ?? undefined}
  className="text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/30 rounded-full px-2 py-0.5 cursor-help"
>
  Contradiction
</span>
```

**No recent posts badge** (lines 428-430):
```tsx
<span className="text-xs font-semibold text-zinc-500 bg-zinc-700/40 border border-zinc-600/30 rounded-full px-2 py-0.5">
  No recent posts
</span>
```

**Consensus badge** (lines 347-349):
```tsx
<span className="mt-0.5 inline-block text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded px-1.5 py-0.5">
  Consensus
</span>
```

**News count badge** (lines 366-369):
```tsx
<span className="text-xs font-semibold text-zinc-400 bg-zinc-700/50 border border-zinc-600/30 rounded px-1.5 py-0.5">
  {count} news
</span>
```

**Macro-theme chip** (lines 522-537):
```tsx
<span className="flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 bg-zinc-800/60 border border-white/10">
  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
    theme.sentiment === 'positive' ? 'bg-green-400'
    : theme.sentiment === 'negative' ? 'bg-red-400'
    : 'bg-zinc-400'
  }`} />
  <span className="text-zinc-300">{theme.sector}: {theme.theme}</span>
</span>
```

**Text-only signal labels** (lines 358-361):
```tsx
// Established:
<span className="text-xs text-zinc-500">Established</span>
// This Month:
<span className="text-xs text-amber-400">This Month</span>
```

**Implementation note:** All ad-hoc `<span>` patterns above collapse into the `Badge` component keyed by `variant`. The `CONVICTION_CLASS` map in `WatchListTab.tsx` and the inline span patterns in the badge catalog are the source of truth for class strings. The `macro-theme` variant is the only one that needs an internal flex layout with a dot child element.

---

### `pulse/src/components/ui/Button.tsx` (component, request-response)

**Analog:** `pulse/src/components/PortfolioTab.tsx`

**Primary button pattern** (lines 192-195 and 149-151):
```tsx
// Add Holding / Refresh Prices / Save Budget:
<button
  type="button"
  className="bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold rounded-md px-4 py-2 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
>
  Add Holding
</button>
// With disabled:
<button
  disabled={isPriceRefreshing}
  className="bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold rounded-md px-3 min-h-[44px] disabled:opacity-75 focus:outline-none focus:ring-2 focus:ring-indigo-500"
>
```

**Secondary button pattern** (lines 183-189):
```tsx
<button
  type="button"
  className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-zinc-300 hover:text-white hover:border-zinc-500 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
>
  Import CSV
</button>
```

**Ghost button pattern** (`WatchListTab.tsx` lines 469-473 and `PortfolioTab.tsx` lines 169-173):
```tsx
// Edit Budget / Discard Changes / Cancel:
<button
  className="text-sm font-semibold text-zinc-400 hover:text-white border border-zinc-700 rounded-md px-3 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
>
  Edit
</button>
```

**Spinner SVG pattern** (`WatchListTab.tsx` lines 41-47 and `PortfolioTab.tsx` lines 204-212):
```tsx
// Reuse this exact SVG for loading state — pattern is consistent across both components:
{isPriceRefreshing ? (
  <svg className="animate-spin h-4 w-4" aria-hidden="true" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
) : 'Refresh Prices'}
```

**Implementation notes:**
- Replace hardcoded `bg-indigo-500` / `focus:ring-indigo-500` with CSS var tokens `bg-accent` / `focus:ring-accent` to use the design system. This is a Phase 15 improvement over existing pattern.
- `loading` prop sets `disabled` automatically and renders SpinnerSVG. Children become the label text.
- `size="sm"` modifier: `px-3 min-h-[36px] text-xs` (replaces `min-h-[44px]`).

---

### `pulse/src/components/ui/StatTile.tsx` (component, transform + animation)

**Analog:** `pulse/src/components/PortfolioTab.tsx` (budget display) + `pulse/src/app/dashboard/components/AnimatedTabPanel.tsx` (Framer Motion pattern)

**Closest existing static pattern** (`PortfolioTab.tsx` lines 163-166):
```tsx
<p className="text-base text-white">
  Monthly budget: <span className="font-semibold">£{budget.toFixed(2)}</span>
</p>
```

**Framer Motion animate pattern** (`AnimatedTabPanel.tsx` lines 19, 27-40) — use as reference for how `framer-motion` is imported and used:
```tsx
import { motion, AnimatePresence } from 'framer-motion'
// ...
<motion.div
  key={tabKey}
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.2, ease: 'easeOut' }}
>
```

**Number counting implementation** (no existing analog — use UI-SPEC contract directly):
```tsx
// From 15-UI-SPEC.md Animation Contracts §1
import { useMotionValue, useTransform, animate } from 'framer-motion'
import { useReducedMotion } from 'framer-motion'

const shouldReduceMotion = useReducedMotion()
const count = useMotionValue(0)
useEffect(() => {
  const controls = animate(count, targetValue, {
    duration: shouldReduceMotion ? 0 : 0.8,  // 0.4 for prices
    ease: 'easeOut',
  })
  return controls.stop
}, [targetValue])
const display = useTransform(count, (v) => formatter(v))
// <motion.span>{display}</motion.span>
```

**StatTile layout** (from UI-SPEC, no existing analog — new pattern):
```
[label — text-xs font-semibold text-zinc-400 uppercase tracking-wide]
[value — text-2xl font-semibold text-white font-mono]
[delta — text-xs font-semibold text-green-400 | text-red-400 | text-zinc-400]
```

---

### `pulse/src/app/dashboard/page.tsx` (tab bar redesign)

**Analog:** self — current tab bar at lines 238-258

**Current tab bar pattern** (lines 238-258):
```tsx
<div className="border-b border-border mb-0">
  <nav className="flex px-8 pt-6" aria-label="Dashboard tabs">
    {tabs.map((tab) => {
      const isActive = activeTab === tab.id
      return (
        <a
          key={tab.id}
          href={`?tab=${tab.id}`}
          aria-current={isActive ? 'page' : undefined}
          className={
            isActive
              ? 'px-4 py-2 text-sm font-semibold text-accent border-b-2 border-accent -mb-px focus:outline-none focus:ring-2 focus:ring-accent rounded-t-sm'
              : 'px-4 py-2 text-sm font-semibold text-zinc-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-accent rounded-t-sm'
          }
        >
          {tab.label}
        </a>
      )
    })}
  </nav>
</div>
```

**Target pattern** (from UI-SPEC Tab Bar Contract):
```tsx
// TabBar must be extracted to a Client Component ('use client')
// because layoutId requires framer-motion (no SSR for the indicator)
// The RSC shell passes activeTab as a prop.

// Container:
<nav
  className="flex gap-1 p-1 rounded-full backdrop-blur-xl bg-white/5 border border-white/10"
  style={{ WebkitBackdropFilter: 'blur(24px)' }}
  aria-label="Dashboard tabs"
>
  {tabs.map((tab) => {
    const isActive = activeTab === tab.id
    return (
      <a
        key={tab.id}
        href={`?tab=${tab.id}`}
        aria-current={isActive ? 'page' : undefined}
        className="relative px-5 py-2 rounded-full min-h-[36px] flex items-center"
      >
        {isActive && (
          <motion.div
            layoutId="tab-indicator"
            className="absolute inset-0 rounded-full bg-accent"
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        )}
        <span className={`relative z-10 text-sm font-semibold ${isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}`}>
          {tab.label}
        </span>
      </a>
    )
  })}
</nav>
```

**Implementation notes:**
- The `dashboard/page.tsx` is currently an RSC. The tab bar block must be extracted to `TabBar.tsx` (`'use client'`) that receives `activeTab: Tab` from the RSC.
- `AnimatedTabPanel` already exists at `pulse/src/app/dashboard/components/AnimatedTabPanel.tsx` — upgrade its transition values to match UI-SPEC (x-axis wipe, mode="wait").

---

### `pulse/src/app/dashboard/components/WatchListTab.tsx` (stagger + mobile)

**Analog:** self

**Existing stagger variants** (lines 22-28) — upgrade stagger from 0.06 to 0.07 and add `useReducedMotion`:
```tsx
// CURRENT (to be upgraded):
const sectionVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' as const } },
}

// TARGET pattern (from UI-SPEC Animation Contracts §3):
const shouldReduceMotion = useReducedMotion()
const sectionVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: shouldReduceMotion ? 0 : 0.07 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 8 },
  visible: { opacity: 1, y: 0, transition: { duration: shouldReduceMotion ? 0 : 0.25, ease: 'easeOut' as const } },
}
```

**Existing creator card glassmorphism** (lines 419-421) — replace with `<Card>` primitive:
```tsx
// CURRENT:
<motion.div
  key={wl.creatorId}
  variants={itemVariants}
  className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4 space-y-3"
>

// TARGET: wrap with hover lift motion.div, use Card inside
<motion.div
  key={wl.creatorId}
  variants={itemVariants}
  whileHover={shouldReduceMotion ? {} : { y: -3, scale: 1.01 }}
  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
  style={{ willChange: 'transform' }}
>
  <Card padding="md" className="space-y-3">
    {/* existing content */}
  </Card>
</motion.div>
```

**Mobile ticker summary toggle** (new `useState` — pattern from existing `isContextExpanded` toggle, lines 124, 251-265):
```tsx
// Existing expand/collapse pattern to copy:
const [isContextExpanded, setIsContextExpanded] = useState(true)
// ...
<button
  onClick={() => setIsContextExpanded((v) => !v)}
  aria-expanded={isContextExpanded}
  aria-controls="news-context-body"
>

// New mobile ticker toggle (same pattern):
const [tickersExpanded, setTickersExpanded] = useState<Record<string, boolean>>({})
// Per-creator toggle:
<button
  onClick={() => setTickersExpanded(prev => ({ ...prev, [wl.creatorId]: !prev[wl.creatorId] }))}
  className="sm:hidden text-sm text-zinc-400 hover:text-white"
>
  {tickersExpanded[wl.creatorId] ? 'Hide picks' : 'Show all picks'}
</button>
```

**Mobile responsive classes to add:**
```tsx
// Ticker table: hide on mobile, show from sm
<div className="hidden sm:block overflow-x-auto">  {/* was: overflow-x-auto */}

// Summary line: show on mobile only
<p className="text-sm text-zinc-400 sm:hidden">
  Top picks: {wl.items[0]?.ticker}, {wl.items[1]?.ticker}
  {wl.items.length > 2 ? ` +${wl.items.length - 2} more` : ''}
</p>

// All Picks card: hide on mobile
<div className="hidden sm:block backdrop-blur-xl ...">

// All Picks ticker chip fallback on mobile:
<div className="flex flex-wrap gap-2 sm:hidden">
  {merged.map(item => (
    <span key={item.ticker} className="text-xs font-semibold font-mono text-zinc-300 bg-zinc-800/60 border border-white/10 rounded px-1.5 py-0.5">
      {item.ticker}
    </span>
  ))}
</div>
```

---

### `pulse/src/components/PortfolioTab.tsx` (mobile mini cards)

**Analog:** self + `WatchListTab.tsx` card pattern

**Existing holdings table** (lines 233-349) — add responsive hide/show:
```tsx
// Table: hide on mobile
<table className="hidden sm:table w-full border-collapse">

// New mini-card list: show on mobile only, one per holding
<div className="sm:hidden space-y-3">
  {holdings.map((holding) => (
    <div
      key={holding.id}
      className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-3"
      style={{ WebkitBackdropFilter: 'blur(24px)' }}
    >
      {/* Mini card layout from UI-SPEC Mobile Contracts §Portfolio */}
      <div className="flex items-start justify-between">
        <span className="text-base font-semibold font-mono text-white">{holding.ticker}</span>
        {/* changePct delta — text-xs color-coded */}
      </div>
      {holding.name && <p className="text-xs text-zinc-400">{holding.name}</p>}
      <p className="text-sm text-zinc-400 font-mono">
        Units: {holding.quantity.toFixed(2)} | Value: £{holding.currentValue.toFixed(2)}
      </p>
      {/* Price cell — amber if stale */}
      {/* Icon-only action row — min-h-[44px] min-w-[44px] per button, aria-label required */}
      <div className="flex gap-2 mt-2">
        <button aria-label={`Show ${holding.ticker} chart`} className="min-h-[44px] min-w-[44px] ...">
          {/* chart SVG */}
        </button>
        <button aria-label={`Toggle ${holding.ticker} star`} className="min-h-[44px] min-w-[44px] ...">
          {holding.isFillTicker ? '★' : '☆'}
        </button>
        <button aria-label={`Edit ${holding.ticker} holding`} className="min-h-[44px] min-w-[44px] ...">
          {/* edit SVG */}
        </button>
        <button aria-label={`Remove ${holding.ticker} holding`} className="min-h-[44px] min-w-[44px] ...">
          {/* delete SVG */}
        </button>
      </div>
    </div>
  ))}
</div>
```

**Note:** Icon-only mobile buttons must carry `aria-label` per UI-SPEC. The pattern for icon-only existing buttons is at `PortfolioTab.tsx` lines 307-333.

---

### `pulse/src/app/globals.css` (design tokens)

**Analog:** self (lines 1-14)

**Current `@theme {}` block** (lines 3-9):
```css
@theme {
  --color-surface: #2C2C2E;
  --color-base: #1C1C1E;
  --color-border: #3A3A3C;
  --color-accent: #6366F1;
  --color-accent-hover: #818CF8;
}
```

**Add font vars — extend, never replace:**
```css
@theme {
  --color-surface: #2C2C2E;
  --color-base: #1C1C1E;
  --color-border: #3A3A3C;
  --color-accent: #6366F1;
  --color-accent-hover: #818CF8;
  /* Phase 15 additions */
  --font-geist: 'Geist', sans-serif;
  --font-geist-mono: 'Geist Mono', monospace;
}
```

**Note:** Tailwind v4 CSS-first config — no `tailwind.config.ts`. All tokens live in `@theme {}`. Do not remove existing properties.

---

### `pulse/src/app/layout.tsx` (font loading)

**Analog:** self (lines 1-22)

**Current font loading** (lines 1-6):
```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })
```

**Target pattern** (replace Inter with Geist + Geist Mono):
```tsx
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="font-[var(--font-geist)]">{children}</body>
    </html>
  )
}
```

**Note:** `variable` mode is required so that `--font-geist` / `--font-geist-mono` CSS vars are injected into the HTML element, matching the `@theme` declarations in `globals.css`. The `font-mono` Tailwind utility must be mapped to `--font-geist-mono` — this is done by the `@theme` `--font-geist-mono` declaration, which Tailwind v4 picks up automatically.

---

## Shared Patterns

### Glassmorphism Card
**Source:** `pulse/src/app/dashboard/components/WatchListTab.tsx` lines 419-421, 315-316
**Apply to:** Card primitive, All Picks panel, news context panel, portfolio mini cards
```tsx
className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4"
style={{ WebkitBackdropFilter: 'blur(24px)' }}
```

### Spinner SVG
**Source:** `pulse/src/app/dashboard/components/WatchListTab.tsx` lines 41-47
**Apply to:** Button primitive `loading` state, all Refresh / Save actions
```tsx
<svg className="animate-spin h-4 w-4" aria-hidden="true" viewBox="0 0 24 24" fill="none">
  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
</svg>
```

### Error Alert Pattern
**Source:** `pulse/src/components/PortfolioTab.tsx` lines 221-223
**Apply to:** All error banners in WatchListTab, PortfolioTab
```tsx
<p role="alert" aria-live="assertive" className="text-sm text-red-400 mt-1 mb-2">
  {errorMessage}
</p>
```

### Focus Ring
**Source:** `pulse/src/components/PortfolioTab.tsx` lines 192-195 (consistent across all interactive elements)
**Apply to:** All Button variants, tab links, expand/collapse toggles
```
focus:outline-none focus:ring-2 focus:ring-accent
```
Note: replace hardcoded `focus:ring-indigo-500` with `focus:ring-accent` in Phase 15.

### Touch Target Minimum
**Source:** `pulse/src/app/dashboard/page.tsx` lines 211-213, `PortfolioTab.tsx` lines 192, 307-333
**Apply to:** All buttons and interactive links across tabs
```
min-h-[44px] min-w-[44px]
```

### Framer Motion Import
**Source:** `pulse/src/app/dashboard/components/AnimatedTabPanel.tsx` line 19
**Apply to:** All new animated components (TabBar, WatchListTab stagger upgrade, Card hover lift, StatTile)
```tsx
import { motion, AnimatePresence, useMotionValue, useTransform, animate, useReducedMotion } from 'framer-motion'
```
**Critical:** import from `'framer-motion'` NOT `'motion/react'` — per existing codebase comment in `AnimatedTabPanel.tsx`.

### useReducedMotion Guard
**Source:** `pulse/src/app/dashboard/components/AnimatedTabPanel.tsx` (pattern exists but guard not yet applied — Phase 15 adds it)
**Apply to:** AnimatedTabPanel upgrade, TabBar, WatchListTab stagger, Card hover lift, StatTile count-up
```tsx
const shouldReduceMotion = useReducedMotion()
// All duration/y/scale values: ternary with shouldReduceMotion ? 0 : actualValue
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `pulse/src/components/ui/StatTile.tsx` (count-up animation) | component | transform | `useMotionValue` + `useTransform` + `animate()` counting pattern not used anywhere in codebase yet — use UI-SPEC contract directly |
| `pulse/src/app/dashboard/TabBar.tsx` (new Client Component) | component | request-response | No existing Client Component tab bar — current tab bar is inline JSX in RSC. New file needed. |

---

## Metadata

**Analog search scope:** `pulse/src/` — all `.tsx` and `.css` files
**Files scanned:** 9 source files read in full
**Pattern extraction date:** 2026-05-20
