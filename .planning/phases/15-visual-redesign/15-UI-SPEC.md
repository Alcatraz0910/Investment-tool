---
phase: 15
slug: visual-redesign
status: approved
shadcn_initialized: false
preset: none
created: 2026-05-20
approved: 2026-05-20
---

# Phase 15 — UI Design Contract

> Visual and interaction contract for the Visual Redesign phase.
> All D-01 through D-12 decisions are locked from CONTEXT.md and pre-populated below.
> Claude's Discretion areas are resolved with concrete values in this document.

---

## Design System

| Property        | Value                                                        |
|-----------------|--------------------------------------------------------------|
| Tool            | Manual (no shadcn) — custom primitives in `src/components/ui/` |
| Preset          | none                                                         |
| Component library | Custom: Card, Badge, Button, StatTile — see Component Contracts |
| Icon library    | Inline SVG only (no icon package). Existing pattern carried forward. |
| Font — prose    | Geist (proportional) — `next/font/google` or `next/font/local`. CSS var `--font-geist`. |
| Font — numeric  | Geist Mono — `next/font/google` or `next/font/local`. CSS var `--font-geist-mono`. Applied via `font-mono` utility class mapped to `--font-geist-mono`. |

Source: D-01, D-02, D-07 (CONTEXT.md)

---

## Spacing Scale

All values are multiples of 4px. Applied via Tailwind spacing utilities.

| Token | px  | Tailwind class | Primary Usage                                         |
|-------|-----|----------------|-------------------------------------------------------|
| xs    | 4   | `gap-1`, `p-1` | Icon internal padding, badge inner gap                |
| sm    | 8   | `gap-2`, `p-2` | Badge padding (`px-2 py-0.5`), table cell padding     |
| md    | 16  | `gap-4`, `p-4` | Card internal padding, form field spacing             |
| lg    | 24  | `gap-6`, `p-6` | Section spacing between cards (`space-y-6`)           |
| xl    | 32  | `gap-8`, `p-8` | Tab panel padding (`p-8`), dashboard outer gutter     |
| 2xl   | 48  | `py-12`        | Page vertical padding (`py-12`)                       |
| 3xl   | 64  | `py-16`        | Empty state vertical padding                          |

Touch target minimum: `min-h-[44px] min-w-[44px]` on all interactive elements. Carried forward from existing pattern — must be preserved in all Button and interactive Badge variants.

Source: D-03 (generous/airy intent), D-10 (existing `p-8` tab panel), discretion applied.

---

## Typography

Prose type scale (4 sizes only):

| Role     | Size class  | px  | Weight class      | Weight | Line-height class | Font family       |
|----------|-------------|-----|-------------------|--------|-------------------|-------------------|
| Heading  | `text-xl`   | 20  | `font-semibold`   | 600    | `leading-tight` (1.2) | Geist          |
| Label    | `text-base` | 16  | `font-semibold`   | 600    | `leading-snug` (1.375) | Geist         |
| Body     | `text-sm`   | 14  | `font-normal`     | 400    | `leading-relaxed` (1.625) | Geist       |
| Badge    | `text-xs`   | 12  | `font-semibold`   | 600    | `leading-normal` (1.5) | Geist — badge/chip labels only, not prose |

Prose captions use `text-sm text-zinc-400` (same size as Body, muted color signals hierarchy — not size reduction).

**Component exception — StatTile value:** `text-2xl font-semibold font-mono` (24px). This is a data-display element, not a prose typography role — excluded from the 4-size prose scale. StatTile portfolio total is the **primary focal point** of the Portfolio tab; its size is intentionally larger than the heading scale to draw the eye.

Numeric / Geist Mono (not a separate prose role — uses body/label sizes):

| Usage                          | Class                          |
|--------------------------------|--------------------------------|
| Ticker symbols                 | `text-sm font-semibold font-mono` |
| Monetary values (portfolio)    | `text-base font-semibold font-mono` |
| Prices in tables               | `text-sm font-semibold font-mono` |
| Percentage figures             | `text-sm font-semibold font-mono` |
| Quantity / spend columns       | `text-sm font-semibold font-mono` |
| Budget input display           | `text-base font-semibold font-mono` |

Geist Mono (`font-mono`) is mandatory for all numeric and ticker content — not optional.

Exactly 2 font weights in use: 400 (regular) and 600 (semibold). No medium (500) or bold (700).

Source: D-01, D-02, D-03 (CONTEXT.md). Scale consolidated from 5 → 4 prose sizes; Display merged into Heading at `text-xl`; StatTile `text-2xl` declared as component exception, not a prose role.

---

## Color

### 60 / 30 / 10 Split

| Role        | Hex       | CSS var              | Tailwind class      | % coverage | Purpose                                      |
|-------------|-----------|----------------------|---------------------|------------|----------------------------------------------|
| Dominant    | `#1C1C1E` | `--color-base`       | `bg-base`           | 60%        | Page background, table row backgrounds        |
| Secondary   | `#2C2C2E` | `--color-surface`    | `bg-surface`        | 30%        | Card backgrounds (via glassmorphism), sidebar |
| Accent      | `#6366F1` | `--color-accent`     | `bg-accent`, `text-accent` | 10% | Reserved elements — see list below    |
| Accent hover | `#818CF8` | `--color-accent-hover` | —                | —          | Hover state for accent elements               |
| Destructive | `#F87171` | — (Tailwind `red-400`) | `text-red-400`   | <1%        | Delete buttons, error alerts, contradiction badge text |

### Accent Reserved For

Accent (`#6366F1`) is applied **only** to these elements:
1. Active tab indicator fill (pill tab bar)
2. Primary Button background (`bg-accent`)
3. Focus ring (`focus:ring-accent`) on all interactive elements
4. Active/selected star (fill ticker toggle): `text-indigo-400`
5. Edit/link text buttons in accent context: `text-indigo-400 hover:text-indigo-300`
6. Conviction badge — high conviction only: `text-indigo-400 bg-indigo-500/10 border-indigo-500/30`
7. "Save Budget" / "Refresh Prices" primary actions

Accent is **not** used for: informational text, table data, secondary labels, borders (except conviction badge), or decorative purposes.

### Semantic Colors (non-accent)

| Color         | Hex       | Tailwind         | Reserved for                                          |
|---------------|-----------|------------------|-------------------------------------------------------|
| Positive      | `#4ADE80` | `text-green-400` | Price up delta (▲), "Trending bullish" badge text     |
| Warning       | `#FBBF24` | `text-amber-400` | Stale price indicator, "This Month" signal label      |
| Destructive   | `#F87171` | `text-red-400`   | Price down delta (▼), error alerts, "Contradiction" badge text, Delete button |
| Consensus     | `#34D399` | `text-emerald-400` | Consensus badge text (`bg-emerald-500/10 border-emerald-500/30`) |
| Muted         | `#71717A` | `text-zinc-500`  | Captions, "Established" signal label, empty dashes (—) |
| Subdued       | `#A1A1AA` | `text-zinc-400`  | Supporting body copy, secondary labels               |

Existing CSS custom properties (`--color-base`, `--color-accent`, `--color-surface`, `--color-border`, `--color-accent-hover`) in `globals.css` are extended — never removed or replaced.

New additions to `@theme {}` in `globals.css`:
```css
--font-geist: 'Geist', sans-serif;
--font-geist-mono: 'Geist Mono', monospace;
```

Source: D-09 accent fill, existing `globals.css` tokens, CONTEXT.md code_context.

---

## Component Contracts

### 1. Card

Glassmorphism container used for creator cards, All Picks panel, news context panel, and portfolio section wrappers.

```tsx
// pulse/src/components/ui/Card.tsx
interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: 'sm' | 'md'  // sm = p-3, md = p-4 (default)
}
```

CSS class pattern:
```
backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4
```

Style notes:
- `backdrop-filter: blur(24px)` — corresponds to `backdrop-blur-xl`
- `-webkit-backdrop-filter: blur(24px)` — **must be included inline or via CSS** for iOS Safari. Add via `style` prop: `style={{ WebkitBackdropFilter: 'blur(24px)' }}` on the root element.
- Background: `bg-white/5` (white at 3.1% opacity over `#1C1C1E`)
- Border: `border-white/10` (white at 10% opacity)
- Border radius: `rounded-xl` (12px)
- No drop shadow by default; hover lift adds shadow (see Animation Contracts)

Accessibility: Card is a presentational container. No ARIA role needed unless it wraps interactive expand/collapse (then `role="region"` + `aria-label`).

---

### 2. Badge / Chip

Small label component. Replaces all ad-hoc chip implementations in WatchListTab.

```tsx
// pulse/src/components/ui/Badge.tsx
type BadgeVariant =
  | 'high-conviction'   // indigo
  | 'medium-conviction' // zinc
  | 'low-conviction'    // zinc-dark
  | 'consensus'         // emerald
  | 'trending-bullish'  // green, rounded-full
  | 'trending-cautious' // amber, rounded-full
  | 'contradiction'     // red, rounded-full, cursor-help
  | 'no-recent-posts'   // zinc muted, rounded-full
  | 'news-count'        // zinc, rectangular
  | 'this-month'        // amber text only (no background)
  | 'established'       // zinc text only (no background)
  | 'macro-theme'       // zinc-dark with sentiment dot

interface BadgeProps {
  variant: BadgeVariant
  children: React.ReactNode
  title?: string         // tooltip — used by contradiction badge
  sentimentDot?: 'positive' | 'negative' | 'neutral'  // macro-theme only
}
```

CSS class patterns by variant:

| Variant            | Classes                                                                                      |
|--------------------|----------------------------------------------------------------------------------------------|
| high-conviction    | `text-xs font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 rounded px-1.5 py-0.5` |
| medium-conviction  | `text-xs font-semibold text-zinc-400 bg-zinc-700/50 border border-zinc-600/30 rounded px-1.5 py-0.5` |
| low-conviction     | `text-xs font-semibold text-zinc-500 bg-zinc-800/50 border border-zinc-700/30 rounded px-1.5 py-0.5` |
| consensus          | `text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded px-1.5 py-0.5` |
| trending-bullish   | `text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/30 rounded-full px-2 py-0.5` |
| trending-cautious  | `text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5` |
| contradiction      | `text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/30 rounded-full px-2 py-0.5 cursor-help` |
| no-recent-posts    | `text-xs font-semibold text-zinc-500 bg-zinc-700/40 border border-zinc-600/30 rounded-full px-2 py-0.5` |
| news-count         | `text-xs font-semibold text-zinc-400 bg-zinc-700/50 border border-zinc-600/30 rounded px-1.5 py-0.5` |
| this-month         | `text-xs text-amber-400` (text only, no background/border)                                   |
| established        | `text-xs text-zinc-500` (text only, no background/border)                                    |
| macro-theme        | `flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 bg-zinc-800/60 border border-white/10` |

Macro-theme sentiment dot colors: positive → `bg-green-400`, negative → `bg-red-400`, neutral → `bg-zinc-400`. Dot size: `w-1.5 h-1.5 rounded-full flex-shrink-0`.

Accessibility: All badges are `<span>` elements. Contradiction badge uses `title` attribute (existing pattern). Screen-reader-only text added where badge meaning is color-only.

---

### 3. Button

Replaces ad-hoc button styles. Three variants.

```tsx
// pulse/src/components/ui/Button.tsx
type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant  // default: 'primary'
  size?: ButtonSize        // default: 'md'
  loading?: boolean        // shows SpinnerSVG when true
  children: React.ReactNode
}
```

CSS class patterns:

| Variant   | Base classes                                                                                              |
|-----------|-----------------------------------------------------------------------------------------------------------|
| primary   | `bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-md px-4 min-h-[44px] disabled:opacity-75 focus:outline-none focus:ring-2 focus:ring-accent flex items-center gap-2` |
| secondary | `bg-surface border border-border rounded-md text-sm font-semibold text-zinc-300 hover:text-white hover:border-zinc-500 min-h-[44px] px-4 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-accent` |
| ghost     | `border border-border rounded-md text-sm font-semibold text-zinc-400 hover:text-white hover:bg-white/5 min-h-[44px] px-3 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-accent` |

Size modifier:
- `md` (default): `px-4 min-h-[44px]`
- `sm`: `px-3 min-h-[36px] text-xs`

Spinner: inline SVG, `animate-spin h-4 w-4`, aria-hidden. Loading state sets `disabled` automatically.

Accessibility: `type="button"` default unless inside `<form>`. `disabled` attribute propagated. `aria-label` accepted via props spread.

---

### 4. StatTile

KPI display tile. Used for portfolio total and allocation percentages.

```tsx
// pulse/src/components/ui/StatTile.tsx
interface StatTileProps {
  label: string
  value: string          // pre-formatted string (e.g. "£12,450.00")
  delta?: string         // optional delta line (e.g. "+£320 this month")
  deltaPositive?: boolean // true = green, false = red, undefined = zinc
  animate?: boolean      // enable number counting animation (default: true)
  className?: string
}
```

Layout:
```
[label — text-xs font-semibold text-zinc-400 uppercase tracking-wide]
[value — text-2xl font-semibold text-white font-mono]
[delta — text-xs font-semibold text-green-400 | text-red-400 | text-zinc-400]
```

Sparkline slot: NOT included in Phase 15. Existing price data supports it but it is deferred (Phase 15 scope boundary from CONTEXT.md deferred section).

Padding: inherits from parent Card or `p-4` standalone.

Number counting animation: see Animation Contracts — StatTile triggers `useCountUp` when `animate={true}`.

---

## Animation Contracts

All animations require:
```tsx
const { reducedMotion } = useReducedMotion()  // Framer Motion hook
```
When `reducedMotion` is true, all durations collapse to `0` and all `y`/`scale` transforms collapse to identity.

### 1. Number Counting (portfolio total / individual prices)

| Property          | Portfolio Total      | Individual Prices     |
|-------------------|----------------------|-----------------------|
| Hook / technique  | `useMotionValue` + `useTransform` + `animate()` | same |
| Duration          | 800ms                | 400ms                 |
| Easing            | `easeOut`            | `easeOut`             |
| Trigger           | Component mount / data load | Refresh Prices action completes |
| Reduced motion    | Snap to final value, no count | same |

Implementation pattern:
```tsx
const count = useMotionValue(0)
useEffect(() => {
  const controls = animate(count, targetValue, {
    duration: reducedMotion ? 0 : 0.8,  // 0.4 for prices
    ease: 'easeOut',
  })
  return controls.stop
}, [targetValue])
const display = useTransform(count, (v) => formatter(v))
// <motion.span>{display}</motion.span>
```

---

### 2. Tab Transition Wipe

Applied inside `AnimatedTabPanel` wrapper (already exists — upgrade to this spec).

| Property     | Value                                                   |
|--------------|---------------------------------------------------------|
| Outgoing tab | `opacity: 1 → 0`, `x: 0 → -16px`, duration 150ms      |
| Incoming tab | `opacity: 0 → 1`, `x: 16px → 0`, duration 200ms, delay 150ms |
| Easing       | `easeOut` for both                                      |
| Framer props | `AnimatePresence mode="wait"` + `motion.div` with `initial/animate/exit` |
| Reduced motion | `x` = 0, duration = 0 for both                       |

```tsx
// initial:  { opacity: 0, x: 16 }
// animate:  { opacity: 1, x: 0 }
// exit:     { opacity: 0, x: -16 }
// transition: { duration: reducedMotion ? 0 : 0.2, ease: 'easeOut' }
```

---

### 3. Card Stagger on Load (Watch List creator cards)

| Property        | Value                                                |
|-----------------|------------------------------------------------------|
| Parent variant  | `staggerChildren: 0.07` (70ms — midpoint of 60-80ms range) |
| Child initial   | `{ opacity: 0, y: 8 }`                              |
| Child animate   | `{ opacity: 1, y: 0 }`                              |
| Duration        | 250ms per card                                       |
| Easing          | `easeOut`                                            |
| Reduced motion  | All children appear instantly (`duration: 0`, `y: 0`) |

```tsx
const sectionVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: reducedMotion ? 0 : 0.07 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: reducedMotion ? 0 : 8 },
  visible: { opacity: 1, y: 0, transition: { duration: reducedMotion ? 0 : 0.25, ease: 'easeOut' } },
}
```

Note: existing `sectionVariants`/`itemVariants` in `WatchListTab.tsx` use 60ms stagger and `y:8`. Upgrade stagger to 70ms; add `useReducedMotion` guard.

---

### 4. Hover Lift (Card hover)

Applied to all Card instances wrapping interactive content (creator cards, All Picks card).

| Property    | Value                                                         |
|-------------|---------------------------------------------------------------|
| Transform   | `y: -3, scale: 1.01`                                         |
| Transition  | `type: 'spring', stiffness: 300, damping: 20`                |
| Shadow      | `box-shadow: 0 8px 32px rgba(99,102,241,0.12)` on hover      |
| Reduced motion | `y: 0, scale: 1` (no transform)                           |

Framer Motion:
```tsx
<motion.div
  whileHover={reducedMotion ? {} : { y: -3, scale: 1.01 }}
  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
  style={{ willChange: 'transform' }}
>
```

Do NOT apply hover lift to: the news context panel (it is a functional display, not a navigable card), table rows, or button elements.

---

## Mobile Contracts

Breakpoint: `sm` = 640px (Tailwind default). No custom breakpoints.

### Watch List — Mobile (< 640px)

**Creator card layout (< sm):**
- Card stacks full-width: remove `flex-wrap` constraints, cards fill 100% of container width.
- Creator name + signal badges: remain in a single header row, badges wrap below name if needed.
- Budget display: stacks below creator name (column layout, not row).

**Ticker table → summary line (< sm):**
- Per-creator ticker table is **hidden** on mobile: `hidden sm:block` on the table wrapper.
- Replaced by a summary line: `<p class="text-sm text-zinc-400 sm:hidden">Top picks: [T1], [T2] +N more</p>`
- Summary line shows first 2 tickers by name, then "+N more" count.
- "Tap to expand" via `useState` toggle — a `<button>` labeled "Show all picks" / "Hide picks".
- Expanded state reveals the full ticker table (or a simplified list view).

**All Picks table (< sm):**
- Hidden on mobile: `hidden sm:block` on the All Picks card.
- Replace with a flat ticker chip list: `<div class="flex flex-wrap gap-2 sm:hidden">` of ticker symbols only.

**Macro themes strip:** Remains visible on mobile (chips scroll horizontally if needed: `overflow-x-auto`).

---

### Portfolio — Mobile (< 640px)

**Table → mini card collapse:**
- Holdings table (`<table>`) is hidden: `hidden sm:table` on the `<table>` element.
- Each holding renders as a mini card below sm: `sm:hidden` on the card list wrapper.

Mini card layout:
```
[TICKER — text-base font-semibold font-mono text-white]  [△/▽ changePct — text-xs color-coded]
[Holding name — text-xs text-zinc-400]
[Units: N.NN | Value: £N,NNN.NN — text-sm text-zinc-400 font-mono]
[Price: £N.NN — text-sm font-semibold font-mono, amber if stale]
```

Mini card CSS: `backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-3` (sm padding variant of Card).

Action buttons (Edit / Delete / Star / Chart) on mobile: collapse to a horizontal icon-only row at card bottom. Min touch target: `min-h-[44px] min-w-[44px]`. Each icon-only button **must** carry an explicit `aria-label` describing the action and the subject (e.g. `aria-label="Edit AAPL holding"`, `aria-label="Remove AAPL holding"`, `aria-label="Toggle AAPL star"`, `aria-label="Show AAPL chart"`). No label fallback text is rendered visually — aria-label is the sole accessibility label.

---

## Tab Bar Contract

Replaces current underline tab bar (`border-b-2 border-accent`) in `dashboard/page.tsx`.

### Structure

```
<nav> — frosted glass pill container
  └─ relative flex items-center gap-1 p-1 rounded-full backdrop-blur-xl bg-white/5 border border-white/10
      ├─ <motion.div layoutId="tab-indicator"> — sliding accent background
      └─ [per tab] <a> — pill tab links
```

### Spec

| Property          | Value                                                          |
|-------------------|----------------------------------------------------------------|
| Container         | `flex gap-1 p-1 rounded-full backdrop-blur-xl bg-white/5 border border-white/10` |
| Container -webkit | `style={{ WebkitBackdropFilter: 'blur(24px)' }}`             |
| Active indicator  | `motion.div` with `layoutId="tab-indicator"`, `className="absolute inset-0 rounded-full bg-accent"`, `layout` transition spring |
| Active tab text   | `text-sm font-semibold text-white relative z-10`             |
| Inactive tab text | `text-sm font-semibold text-zinc-400 hover:text-zinc-200 relative z-10 transition-colors duration-150` |
| Tab padding       | `px-5 py-2 rounded-full min-h-[36px]`                        |
| Indicator spring  | `transition={{ type: 'spring', stiffness: 400, damping: 30 }}` |
| layoutId name     | `"tab-indicator"` (must be unique per page)                  |
| Reduced motion    | `layoutId` animation collapses via `useReducedMotion` — set `transition={{ duration: 0 }}` |

**Implementation note:** Current `dashboard/page.tsx` tab bar uses `<a href="?tab=...">` (full page navigation). To support the `layoutId` sliding indicator with `AnimatePresence`, the tab bar must be extracted to a Client Component (`TabBar`) that manages `usePathname`/`useSearchParams` to derive active tab — the RSC shell passes `activeTab` as prop.

---

## Copywriting Contract

No financial advice language. All output framed as creator-derived information. Observational only.

| Element                        | Copy                                                                                      |
|--------------------------------|-------------------------------------------------------------------------------------------|
| Tab: Portfolio                 | "Portfolio"                                                                               |
| Tab: Watch List                | "Watch List"                                                                              |
| Primary CTA — Refresh prices   | "Refresh Prices"                                                                          |
| Primary CTA — Add holding      | "Add Holding"                                                                             |
| Primary CTA — Import CSV       | "Import CSV"                                                                              |
| Primary CTA — Save budget      | "Save Budget"                                                                             |
| Primary CTA — Refresh news     | "Refresh News"                                                                            |
| Ghost action — Edit budget     | "Edit Budget"                                                                             |
| Ghost action — Discard changes | "Discard Changes"                                                                         |
| Loading state — Refresh prices | "Refreshing…" (button label replaced while `loading` is true)                            |
| Loading state — Save budget    | "Saving…"                                                                                 |
| Empty state — No holdings      | Heading: "No holdings yet" / Body: "Add your first holding to start tracking your portfolio." |
| Empty state — No creators      | Heading: "No creators tracked" / Body: "Go to the Creators page to track a creator, then refresh them to generate picks." |
| Empty state — No profile       | "Refresh this creator to generate picks"                                                  |
| Empty state — No tickers       | "This creator has not cited specific tickers recently"                                    |
| Empty state — No news context  | "No context yet — click Refresh News to generate your first summary."                    |
| Error — Price fetch fail       | "Could not fetch prices for: [TICKER, ...]"                                               |
| Error — News refresh fail      | (server error message; prepend "News refresh failed — ")                                  |
| Error — Budget save fail       | (server error message passed through)                                                     |
| Delete confirm — prompt        | "Remove [TICKER] from your portfolio?"                                                    |
| Delete confirm — body          | "This will remove [TICKER] from your holdings."                                           |
| Delete confirm — confirm CTA   | "Remove Holding"                                                                          |
| Delete confirm — dismiss       | "Keep Holding"                                                                            |
| Stale price indicator          | "[N] hour[s] ago — refresh to update" (tooltip on price cell)                            |
| Stale news indicator           | "Last updated: [relative time] — stale" (amber color)                                    |
| Watch List mobile summary      | "Top picks: [T1], [T2] +[N] more"                                                        |
| Watch List mobile expand       | "Show all picks" / "Hide picks"                                                           |
| Signal — established           | "Established"                                                                             |
| Signal — this month            | "This Month"                                                                              |
| Badge — consensus              | "Consensus"                                                                               |
| Badge — trending bullish       | "Trending bullish"                                                                        |
| Badge — trending cautious      | "Trending cautious"                                                                       |
| Badge — contradiction          | "Contradiction" (tooltip: contradiction reason from AI)                                  |
| Badge — no recent posts        | "No recent posts"                                                                         |
| Disclaimer footer              | "Watch list picks are derived from creator content and are not financial advice. Always do your own research." |
| News disclaimer                | "News is sourced from public feeds and AI cross-referencing. Not financial advice."       |

---

## Registry Safety

| Registry          | Blocks / Packages Used                                      | Safety Gate                          |
|-------------------|-------------------------------------------------------------|--------------------------------------|
| npm — framer-motion | `motion`, `AnimatePresence`, `useReducedMotion`, `useMotionValue`, `useTransform`, `animate`, `useSpring`, `layoutId` | Already installed — no new registry call. Verified in existing `package.json`. |
| npm — next (next/font) | `next/font/google` for Geist + Geist Mono                | Next.js built-in — no third-party registry. |
| npm — tailwindcss v4 | `@theme {}` extension in `globals.css`                   | Already installed — no new package. CSS-first config, no `tailwind.config.ts`. |
| shadcn            | None — shadcn not initialized, not used                     | Not applicable.                      |
| Third-party registries | None declared                                          | Not applicable — vetting gate not triggered. |

No new npm packages are required for Phase 15. All animation, font, and styling infrastructure is already present.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-05-20

---

*Sources: 15-CONTEXT.md D-01–D-12, REQUIREMENTS.md VIS-01–VIS-05 / MOB-01–MOB-03, globals.css @theme tokens, WatchListTab.tsx badge/chip inventory, PortfolioTab.tsx holdings table, dashboard/page.tsx tab bar current state.*
