# Phase 15: Visual Redesign - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 15 delivers a comprehensive UI overhaul of all dashboard tabs and the shared component layer. It introduces a cohesive design system (Geist typography, refined colour palette, spacing rhythm, Framer Motion animations), extracts shared UI primitives into `pulse/src/components/ui/`, applies glassmorphism/dark-first aesthetic consistently, redesigns the tab bar, and delivers mobile-responsive layout for both the Portfolio and Watch List tabs (absorbing deferred Phase 10 scope).

Phase ends when:
- All dashboard tabs use the new design system primitives
- `pulse/src/components/ui/` contains Card, Badge/Chip, Button, StatTile components
- Geist (proportional) + Geist Mono (tickers/prices) loaded via `next/font`
- Pill-style animated tab bar implemented
- All four motion effects active with `useReducedMotion()` guard
- Portfolio tab collapses to per-holding mini cards on mobile (< 640px / sm breakpoint)
- Watch List creator cards stack full-width on mobile with collapsed ticker summary
- TypeScript clean (`npx tsc --noEmit` exits 0)

**Out of scope for Phase 15:**
- Any new data functionality (no new server actions, DB queries, or business logic)
- Dark/light mode toggle (dark-first only)
- Additional tabs or pages beyond the existing dashboard
- Creator strategy extraction or plan generation logic

</domain>

<decisions>
## Implementation Decisions

### Typography
- **D-01:** Primary typeface: **Geist** (proportional) — loaded via `next/font/google` or `next/font/local`. Used for all UI text, labels, headings.
- **D-02:** Monospace typeface: **Geist Mono** — applied to ticker symbols, monetary values, percentages, and numeric data columns. Ensures columns align and numbers don't shift width on update.
- **D-03:** Heading scale: **generous & airy** — tab section headings at `text-xl`/`text-2xl`, section labels at `text-base`, supporting copy at `text-sm`. More whitespace around sections; this is a personal tool and premium feel is prioritised over maximum data density.

### Motion
- **D-04:** Motion philosophy: **expressive & cinematic** — Framer Motion used broadly, not just for micro-interactions.
- **D-05:** Specific effects to implement:
  - **Number counting** — portfolio total and individual prices count up from 0 on first load / on refresh
  - **Tab transition wipe** — outgoing tab content fades/slides out before incoming content fades in
  - **Card stagger on load** — Watch List creator cards reveal with 60-80ms staggerChildren delay
  - **Hover lift** — cards translate up 2-4px and scale slightly on hover, with shadow bloom
- **D-06:** All animations gated behind `useReducedMotion()` (Framer Motion hook). When reduced motion is preferred, animations degrade gracefully to instant transitions.

### Component Extraction
- **D-07:** Shared UI primitives live in **`pulse/src/components/ui/`** — extracted from ad-hoc implementations in tab files. All tabs import from this shared source.
- **D-08:** Primitives to extract/create:
  - `Card` — glassmorphism card (backdrop-blur, border, subtle shadow, `-webkit-backdrop-filter` for iOS Safari)
  - `Badge` / `Chip` — small label component replacing ad-hoc chip implementations across tabs (Consensus chip, signal badges, news count badge)
  - `Button` — primary, secondary, ghost variants (covers Refresh, Expand, Save buttons across tabs)
  - `StatTile` — KPI tile: label + big number + optional delta arrow (portfolio total, allocation %, price change)
- **D-09:** Tab bar redesign: pill-style container with frosted glass background. Active tab has accent fill (`--color-accent: #6366F1`), inactive tabs are ghost. Animated sliding indicator transitions between tabs using Framer Motion `layoutId`.

### Mobile Layout
- **D-10:** Breakpoint strategy: **desktop-first** — existing markup order is preserved; mobile overrides applied via `sm:` (640px) and `md:` (768px) Tailwind prefixes. No new bespoke breakpoints.
- **D-11:** Watch List on mobile (< sm): creator cards stack **full-width**. The embedded ticker table is replaced by a summary line ("Top picks: AAPL, TSLA +3 more"). Tap/click to expand into the full ticker detail.
- **D-12:** Portfolio holdings on mobile (< sm): each table row collapses into a **mini card** showing ticker, units, current value, and a slot for price delta. Consistent card aesthetic with Watch List treatment.

### Claude's Discretion
- Exact glassmorphism values (blur radius, opacity, border opacity) — match Phase 12/13 established feel; adjust if needed for legibility
- Spacing rhythm tokens (gap sizes, padding scale) — follow Tailwind default scale unless it conflicts with generous heading intent
- Whether StatTile shows a sparkline slot (Phase 15 scope allows it if existing price data supports it without new server actions)
- Number counting animation duration and easing — suggested 800ms ease-out for totals, 400ms for individual prices

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Constraints
- `CLAUDE.md` — decimal.js rule, RAG pattern, no-advice framing, ISA constraints
- `.planning/PROJECT.md` — glassmorphism aesthetic, dark-first, Framer Motion in stack

### Design System Baseline
- `pulse/src/app/globals.css` — existing CSS custom properties (`--color-base`, `--color-accent`, `--color-surface`, `--color-border`); Tailwind v4 `@theme {}` config
- `.planning/phases/12-watch-list-per-creator-budget/12-CONTEXT.md` — glassmorphism card pattern origin; `-webkit-backdrop-filter` iOS pitfall
- `.planning/phases/14-creator-signals-housekeeping/14-CONTEXT.md` — signal badge visual language (Consensus chip, sentiment trend, Contradiction badge, No recent posts badge); follow for Badge primitive design

### Existing Components to Redesign
- `pulse/src/app/dashboard/components/WatchListTab.tsx` — largest component; contains creator cards, All Picks table, news panel, signal badges
- `pulse/src/app/dashboard/components/PortfolioTab.tsx` — holdings table, price columns, Refresh button
- `pulse/src/app/dashboard/page.tsx` — tab bar, top-level layout

### Prior Phase Context (integration consistency)
- `.planning/phases/13-market-news-integration/13-CONTEXT.md` — news badge/chip pattern; macro themes strip styling

### No external UI specs — requirements fully captured in decisions above

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `globals.css @theme {}` — 5 CSS custom properties already defined; extend, don't replace
- Phase 12/13 badge implementations in `WatchListTab.tsx` — source material for the shared `Badge` primitive
- Framer Motion already installed — no new dependencies needed for animation
- `next/font` already available in Next.js 15 — use for Geist font loading (no CDN)

### Established Patterns
- Glassmorphism: `backdrop-blur`, `bg-white/5`, border with low-opacity — established in Phase 12; carry into Card primitive
- `-webkit-backdrop-filter` alongside `backdrop-filter` — iOS Safari pitfall; must be in Card primitive
- Tailwind v4 CSS-first config via `@theme {}` — no `tailwind.config.ts` needed; add design tokens to `globals.css`
- Dark-first: `--color-base: #1C1C1E` background; all text on dark — no need for `dark:` variant classes

### Integration Points
- New `pulse/src/components/ui/` primitives consumed by all dashboard tab components
- Tab bar redesign sits in `pulse/src/app/dashboard/page.tsx` (RSC) — tab switching logic may need to move to a Client Component wrapper if Framer Motion tab indicator is needed
- Mobile layout: Watch List expand/collapse for ticker summary needs `useState` in `WatchListTab.tsx` (already a Client Component)

</code_context>

<specifics>
## Specific Ideas

- Pill-style tab bar with `layoutId` animated indicator (Framer Motion shared layout) — sliding accent fill follows active tab
- Creator cards: staggerChildren with 60-80ms delay on initial mount
- Portfolio total: `useSpring` or `animate` counting from 0 to final value on load (800ms ease-out)
- Individual prices: 400ms count-up on refresh trigger
- Hover lift: `whileHover={{ y: -3, scale: 1.01 }}` with `transition={{ type: 'spring', stiffness: 300 }}`

</specifics>

<deferred>
## Deferred Ideas

- Dark/light mode toggle — not in Phase 15 scope; dark-first only for v1.2
- Custom xs: 480px breakpoint — desktop-first with sm/md is sufficient for this phase
- Sparkline charts in portfolio mini cards — possible if existing price data supports it, but not a Phase 15 requirement

</deferred>

---

*Phase: 15-Visual Redesign*
*Context gathered: 2026-05-20*
