# Phase 6: Dashboard UI — Research

**Researched:** 2026-05-07
**Domain:** Next.js 15 App Router UI — glassmorphism design system, Framer Motion animation, Recharts trajectory visualisation
**Confidence:** HIGH (codebase fully read; only `recharts` is a new dependency)

## Summary

Phase 6 is a **reskin + 1 new chart + 1 expandable accordion**. All functional logic (PlanGenerator, ContributionCalculator, BlendSummary, StrategyCard, TrustWeightSlider, ContradictionDiff, BuyListTable) already exists from Phases 4–5 and works. The phase adds three things on top:

1. A design-system swap: zinc → Space Grey + Electric Indigo, glassmorphism cards via Tailwind v4 `@theme` tokens.
2. Framer Motion v12 (`motion/react`) animation: card-mount stagger + tab-content fade.
3. A Roadmap View chart inside PlanTab using Recharts 3.x `LineChart` (one new dependency).
4. An expandable rationale accordion inside `BuyListTable` rows (D-09).

The risk profile is low: every reused component has a known data shape, Tailwind v4 is already configured (globals.css already has `@theme`), Framer Motion v12 is installed, and the codebase already uses the AnimatePresence accordion pattern (`ContradictionDiff`).

**Primary recommendation:** Treat Phase 6 as five mechanical changes — `globals.css` token additions, page.tsx `max-w-2xl → max-w-4xl`, glassmorphism class swaps in 5 named components, a new `RoadmapView.tsx` client component using Recharts, and an inline rationale row inside `BuyListTable`. Do NOT touch generator.ts, blender.ts, plan-actions.ts, or any data-fetching code.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Design System Migration**
- **D-01:** Full palette swap — replace `bg-zinc-900/800/700` with Space Grey hex values (`#1C1C1E` base, `#2C2C2E` surface, `#3A3A3C` border) and Electric Indigo (`#6366F1` primary, `#818CF8` hover) project-wide. Applied to every component: page background, cards, nav, inputs, buttons.
- **D-02:** All content cards become glassmorphism: `backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl`. Applied to StrategyCard, BlendSummary, PlanTab card wrapper, Roadmap View card.
- **D-03:** Palette wired via CSS custom properties in `pulse/src/app/globals.css` (Tailwind v4 pattern — no `tailwind.config.ts`). Use `@theme` or `--color-*` custom properties for the new tokens.
- **D-04:** Layout widened from `max-w-2xl` to `max-w-4xl` (~896px) in `page.tsx`. Single change; all tabs benefit.

**Roadmap View Chart**
- **D-05:** Install `recharts` as a dependency. Use `LineChart` with two `Line` series.
- **D-06:** Roadmap View is a section within the **Plan tab**, below the Buy List — not a separate tab. Three-tab navigation (Portfolio | Creators | Plan) unchanged.
- **D-07:** Time horizon = 12 months covering the current UK tax year (today → 5 April). Use `getCurrentTaxYear()` from `lib/tax-year.ts`.
- **D-08:** Y-axis = total portfolio value (£). Two lines:
  - **"Your Current Path"** — current portfolio value + monthly_budget contributions flat (no rebalancing)
  - **"Creator's Vision"** — same contributions but weighted toward blended target allocation
  - Both lines plotted monthly across the 12-month horizon. All arithmetic uses `decimal.js`.

**Ticker Rationale Panel**
- **D-09:** Expandable inline row — clicking a ticker row in BuyListTable toggles an expanded section in-place. Uses Framer Motion `AnimatePresence` + `motion.div` with height animation. Matches the `ContradictionDiff` accordion pattern already in the codebase.
- **D-10:** Expanded content shows: category, current allocation %, target allocation %, gap %, and the £amount as "closes X% of gap." All data already present in `BuyListItem` — no new API calls required.

**Animation**
- **D-11:** Two animation patterns:
  1. **Card mount stagger** — cards `fade + slide-up` on mount, 50ms stagger between cards. Applied to StrategyCard list, Buy List rows, BlendSummary.
  2. **Tab content fade** — `AnimatePresence` wraps the active tab's content panel; entering tab fades in (`opacity: 0 → 1`, `y: 8 → 0`).
- **D-12:** Tab navigation stays server-side URL links (`href="?tab=plan"`). No client-side tab state. `AnimatePresence` works on the rendered tab panel with a `key` matching the active tab.
- **D-13:** Ticker rationale expand/collapse also uses `AnimatePresence` (consistent with the accordion pattern from ContradictionDiff).

### Claude's Discretion
- Exact easing curves and durations for Framer Motion variants (stay within 150–400ms range; spring or ease-out).
- Recharts styling details (tooltip styling, axis tick formatting, grid line opacity) — match the glassmorphism palette.
- Empty state for Roadmap View when no holdings or no budget set — show a placeholder card with setup prompt.
- Whether the ISA warning (budget > remaining allowance) renders as a top banner or footer note within PlanTab.

### Deferred Ideas (OUT OF SCOPE)
- **Creator attribution in rationale** — showing which creator drove a category target in the ticker rationale panel. Belongs in a future enhancement; would require passing BlendSummary breakdown down to BuyListTable.
- **Separate Roadmap tab** — user confirmed Roadmap View stays in Plan tab section; a dedicated tab is a future navigation refactor if needed.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Glassmorphism dark mode aesthetic — Space Grey (#1C1C1E base) and Electric Indigo (#6366F1 accent); Framer Motion transitions | D-01/02/03/11/12 — Tailwind v4 `@theme` tokens (already in `globals.css`); `framer-motion@12.38.0` already installed; existing `motion/react` import pattern in `ContradictionDiff` |
| UI-02 | Action Plan panel — prominent monthly Buy List based on latest blended creator strategy | `BuyListTable` and `PlanTab` already render `PlanResult`; only restyling + D-09 rationale accordion needed |
| UI-03 | Roadmap View — visual timeline comparing "Creator's Vision" vs "Your Current Path" | D-05/07/08; Recharts 3.x `LineChart` (verified compatible with React 19 — peer `^19.0.0`); `getCurrentTaxYear()` exists in `lib/tax-year.ts` |
| UI-04 | Contribution Calculator — slider (£200 → £1,000) with instant recalculation, no page reload | Already implemented in `ContributionCalculator.tsx` via `useMemo(generatePlan)` — no logic change, only visual restyle |
| UI-05 | Creator strategy card — extracted allocation, confidence score, last-refresh date, contradiction flag | `StrategyCard` + `ContradictionDiff` exist; need to add `lastRefreshedAt` rendering and apply glassmorphism |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Auth / session check | API (Server Component) | — | `page.tsx` calls `supabase.auth.getUser()` server-side |
| Data fetch (holdings, ISA, strategies, transcripts) | API (Server Component) | — | All Supabase queries in `dashboard/page.tsx`; passes serializable props down |
| Plan generation (initial render) | API (Server Component) | — | `generatePlan()` called inside `page.tsx`; result passed to `PlanTab` props |
| Plan recompute on slider drag | Browser (Client Component) | — | `ContributionCalculator` runs `generatePlan()` in `useMemo` — pure function, no network |
| Roadmap View trajectory math | API (Server Component) | Browser | Two equally valid: pre-compute monthly points server-side and pass JSON to client; OR pass holdings/strategy/budget and compute client-side. Recommend **client-side** because budget changes via slider must reflect in chart [ASSUMED] |
| Roadmap View rendering | Browser (Client Component) | — | Recharts uses browser APIs; must `'use client'` (Pitfall: cannot SSR Recharts) |
| Tab content fade animation | Browser (Client Component) | — | `AnimatePresence` requires client; tab routing remains URL-based (server) |
| Tab navigation | API (Server Component) | — | D-12: `<a href="?tab=...">` server-side links — current pattern preserved |
| Trust weight save | API (Server Action) | — | `saveCreatorWeight` already exists, called from `TrustWeightSlider` |
| ISA tax-year boundary calc | API (Server Component) | — | `getCurrentTaxYear()` always server (UK tax year invariant) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 15.5.16 | App Router, Server Components, Server Actions | already installed; turbopack enabled |
| react | 19.1.0 | UI runtime | already installed; required for React 19 client features |
| tailwindcss | 4.x (`^4`, current latest 4.2.4) | Utility-first CSS | already installed via `@tailwindcss/postcss`; v4 uses `@theme` in CSS [VERIFIED: package.json] |
| framer-motion | 12.38.0 | Animation primitives — `motion`, `AnimatePresence`, `variants`, `staggerChildren` | already installed; v12 supports React 19 [VERIFIED: package.json] |
| decimal.js | 10.6.0 | All £ arithmetic | CLAUDE.md mandate; used in generator.ts and Roadmap math |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| recharts | **3.8.1** (latest as of 2026-03-25) | LineChart for Roadmap View | NEW DEPENDENCY (D-05). Peer deps: `react ^19.0.0`, `react-dom ^19.0.0`, `react-is ^19.0.0` — all compatible [VERIFIED: npm view] |

**Installation command:**
```bash
cd pulse && npm install recharts
```

**Note on `react-is` peer dep:** `recharts@3.8.1` declares `react-is` as a peer dependency. With React 19, npm 9+, and our existing setup, this auto-resolves; no extra install needed [ASSUMED — confirm by checking `npm ls react-is` after install]. If a warning appears, run `npm install react-is@^19`.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| recharts | Pure SVG hand-rolled | More code, no dep — but discarded by user in CONTEXT Q1 |
| recharts | visx, victory, chart.js | Heavier or more boilerplate; recharts already chosen |
| framer-motion | CSS @keyframes | No `AnimatePresence` exit anims — discarded; framer already installed |

### Version Verification
- `recharts@3.8.1` — published 2026-03-25; React 19 supported [VERIFIED: npm view recharts]
- `framer-motion@12.38.0` — already installed; package import path remains `'framer-motion'`. Note: the project uses `'motion/react'` import path (Motion's renamed package). Must confirm during planning whether to standardise on `framer-motion` or `motion/react`. **Codebase currently mixes neither yet** — Phase 4's `ContradictionDiff.tsx` does NOT import framer-motion. This is the FIRST phase actually using it [VERIFIED: grep of components/]
- `tailwindcss@4.2.4` — already at v4 with `@theme` syntax in `globals.css` [VERIFIED: package.json + globals.css read]
- `next@15.5.16`, `react@19.1.0` [VERIFIED: package.json]

**Decision pending for plan-checker:** Phase 4 plans referenced framer-motion patterns but no framer-motion `import` actually exists in any component yet. Planner should pick the import path explicitly: `import { motion, AnimatePresence } from 'framer-motion'` (matches `package.json` dependency name) is the safe default. The `motion/react` rename is a 2025+ rebrand of the same library; using `framer-motion` import keeps clarity with `package.json`.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌──────────────────────────────┐
   URL ?tab=plan ──>│ dashboard/page.tsx           │  (Server Component)
                    │  • supabase.auth.getUser()   │
                    │  • fetch holdings, ISA,      │
                    │    strategies, transcripts   │
                    │  • blendStrategies()         │
                    │  • generatePlan() (initial)  │
                    │  • upsertBuyList() fire-fwd  │
                    └────────────┬─────────────────┘
                                 │ props (serializable)
                                 ▼
              ┌──────────────────────────────────────┐
              │ <main> max-w-4xl glassmorphism shell │  (Server)
              │  ┌─ tab nav (server <a href>) ────┐  │
              │  │ Portfolio | Creators | Plan    │  │
              │  └────────────────────────────────┘  │
              │  ┌─ AnimatePresence (key=tab) ───┐   │  (Client wrapper)
              │  │   activeTab===                │   │
              │  │   ┌─portfolio──┐               │   │
              │  │   │ PortfolioTab               │   │
              │  │   └────────────┘               │   │
              │  │   ┌─creators───┐               │   │
              │  │   │ CreatorsTab + StrategyCard │   │  (cards stagger-in)
              │  │   │ + TrustWeightSlider        │   │
              │  │   │ + ContradictionDiff        │   │
              │  │   │ + BlendSummary             │   │
              │  │   └────────────┘               │   │
              │  │   ┌─plan───────┐               │   │
              │  │   │ PlanTab                    │   │
              │  │   │  ├─ ContributionCalculator │   │  (slider, useMemo)
              │  │   │  ├─ BuyListTable           │   │  (rows + accordion)
              │  │   │  │   └─ rationale row      │   │  (AnimatePresence)
              │  │   │  └─ RoadmapView (NEW)      │   │  (Recharts LineChart)
              │  │   └────────────┘               │   │
              │  └────────────────────────────────┘  │
              └──────────────────────────────────────┘

Data flow on slider drag:
  ContributionCalculator state → useMemo(generatePlan(...)) → re-render BuyListTable
                                                            → re-render RoadmapView
                                  (no network, no Server Action, no re-fetch)
```

### Component Responsibilities

| File | Phase 6 Action | Responsibility |
|------|----------------|----------------|
| `pulse/src/app/globals.css` | EDIT | Add Space Grey + Electric Indigo `@theme` tokens (D-03) |
| `pulse/src/app/dashboard/page.tsx` | EDIT (minimal) | `max-w-2xl → max-w-4xl` (D-04); restyle shell, nav, header to Space Grey + glassmorphism; pass `monthlyBudget` & `holdings` to RoadmapView through PlanTab |
| `pulse/src/app/dashboard/components/PlanTab.tsx` | EDIT | Pass-through props to ContributionCalculator AND RoadmapView; restyle |
| `pulse/src/app/dashboard/components/ContributionCalculator.tsx` | EDIT (style only) | Restyle slider track/thumb to Electric Indigo; KEEP useMemo logic |
| `pulse/src/app/dashboard/components/BuyListTable.tsx` | EDIT | Apply glassmorphism; add expandable rationale row (D-09/D-10) using `AnimatePresence`; add card-mount stagger |
| `pulse/src/app/dashboard/components/StrategyCard.tsx` | EDIT | Apply glassmorphism; ensure `lastRefreshedAt` shown (UI-05) |
| `pulse/src/app/dashboard/components/BlendSummary.tsx` | EDIT | Apply glassmorphism; card-mount animation |
| `pulse/src/app/dashboard/components/ContradictionDiff.tsx` | EDIT (style only) | Update colors to Space Grey + amber palette already used |
| `pulse/src/app/dashboard/components/TrustWeightSlider.tsx` | EDIT (style only) | Restyle track/thumb |
| `pulse/src/app/dashboard/components/RoadmapView.tsx` | **CREATE** | Recharts LineChart, two trajectory lines, 12-month tax-year horizon, `'use client'` |
| `pulse/src/lib/plan/roadmap.ts` | **CREATE** | Pure function `computeRoadmap(holdings, blend, budget, taxYear)` returning monthly trajectory points; uses Decimal |
| `pulse/src/app/dashboard/creators-tab.tsx` | EDIT | Wire card-mount stagger animation (D-11.1) |
| `pulse/src/app/dashboard/components/AnimatedTabPanel.tsx` (or inline) | **CREATE** | Client wrapper using `AnimatePresence` keyed by activeTab (D-11.2) |

### Recommended Project Structure
```
pulse/src/
├── app/
│   ├── globals.css                              # @theme tokens (EDIT)
│   ├── dashboard/
│   │   ├── page.tsx                             # shell + tab routing (EDIT)
│   │   ├── creators-tab.tsx                     # card stagger (EDIT)
│   │   └── components/
│   │       ├── AnimatedTabPanel.tsx             # NEW — client AnimatePresence wrapper
│   │       ├── PlanTab.tsx                      # EDIT (style + RoadmapView mount)
│   │       ├── ContributionCalculator.tsx       # EDIT style only
│   │       ├── BuyListTable.tsx                 # EDIT style + rationale accordion
│   │       ├── StrategyCard.tsx                 # EDIT
│   │       ├── BlendSummary.tsx                 # EDIT
│   │       ├── ContradictionDiff.tsx            # EDIT style only
│   │       ├── TrustWeightSlider.tsx            # EDIT style only
│   │       └── RoadmapView.tsx                  # NEW — Recharts LineChart
│   └── ...
└── lib/
    ├── tax-year.ts                              # UNCHANGED — re-used
    ├── plan/
    │   ├── generator.ts                         # UNCHANGED
    │   └── roadmap.ts                           # NEW — pure function
    └── strategy/
        └── blender.ts                           # UNCHANGED
```

### Pattern 1: Tailwind v4 `@theme` token expansion
**What:** Tailwind v4 generates utility classes (`bg-base`, `text-accent`, etc.) directly from `--color-*` variables inside `@theme`. The current `globals.css` already has 5 tokens; planner should keep these names and ensure components use the Tailwind utility names (`bg-base`, `bg-surface`, `border-border`, `bg-accent`, `bg-accent-hover`).
**When:** D-03 — wiring the new palette.
**Example:**
```css
/* pulse/src/app/globals.css — already exists, keep as is */
@import "tailwindcss";

@theme {
  --color-base: #1C1C1E;
  --color-surface: #2C2C2E;
  --color-border: #3A3A3C;
  --color-accent: #6366F1;
  --color-accent-hover: #818CF8;
}

body {
  background-color: var(--color-base);
  color: #FFFFFF;
}
```
Then in components:
```tsx
// Glassmorphism card (D-02)
<div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6">
  ...
</div>

// Solid surface card
<div className="bg-surface border border-border rounded-xl">...</div>

// Accent button
<button className="bg-accent hover:bg-accent-hover text-white">...</button>
```
[CITED: Tailwind v4 `@theme` docs — tailwindcss.com/docs/theme]

### Pattern 2: Framer Motion `AnimatePresence` for tab content fade (D-12)
**What:** Server-side URL navigation re-renders the page; the client-side AnimatePresence wraps the active panel and fades it in. The `key` MUST match `activeTab` so AnimatePresence knows when to swap.
**When:** D-11.2 — tab content panel fade.
**Example:**
```tsx
// pulse/src/app/dashboard/components/AnimatedTabPanel.tsx
'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { ReactNode } from 'react'

export function AnimatedTabPanel({ tabKey, children }: { tabKey: string; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={tabKey}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
```
[CITED: framer-motion docs — framer.com/motion/animate-presence]

### Pattern 3: Card-mount stagger (D-11.1)
**What:** Parent variants drive children with `staggerChildren`. Each child uses the same variants name to inherit the entry animation.
**When:** Applied to StrategyCard list (creators-tab.tsx), Buy List rows (BuyListTable.tsx), BlendSummary.
**Example:**
```tsx
'use client'
import { motion } from 'framer-motion'

const listVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }, // 50ms (D-11)
}
const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
}

<motion.ul variants={listVariants} initial="hidden" animate="visible">
  {items.map((item) => (
    <motion.li key={item.id} variants={itemVariants}>...</motion.li>
  ))}
</motion.ul>
```
[CITED: framer-motion docs — staggerChildren]

### Pattern 4: Inline expandable rationale row (D-09/D-13)
**What:** Reuse `ContradictionDiff` accordion shape — a `useState` boolean + Framer Motion height animation. Reading `BuyListTable.tsx` shows current rows are `<tr>` inside a `<table>`; for accordion-in-place, the simplest path is to convert the buy-items list from `<table>` to a flex/div list (Phase 6 cosmetic restructure) so each item can render an `AnimatePresence` block underneath it. Alternative: use `<tr>` with `colSpan` for the expanded panel — more table-correct but messier with motion height anims.
**Recommended:** Convert `<table>` to a `<div>` list of cards. Matches glassmorphism aesthetic (D-02) AND simplifies AnimatePresence.
**Example:**
```tsx
'use client'
const [expanded, setExpanded] = useState<string | null>(null)
// for each item with key = ticker:category
<button onClick={() => setExpanded(expanded === key ? null : key)} aria-expanded={expanded === key}>
  {/* row content: ticker | category | amount | gap bar */}
</button>
<AnimatePresence initial={false}>
  {expanded === key && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{ overflow: 'hidden' }}
    >
      {/* category, current %, target %, gap %, "closes X% of gap" */}
      {item.rationale}
    </motion.div>
  )}
</AnimatePresence>
```
**Important:** `BuyListItem.allocationGapPct` and `rationale` are ALREADY computed in `generator.ts` (D-10 — no new API calls). Planner just renders them.

### Pattern 5: Recharts client-only mount (D-05)
**What:** Recharts uses browser-only APIs (window measurement for `ResponsiveContainer`). Must mark file `'use client'`. In Next 15, `next/dynamic` with `ssr: false` is **only allowed inside client components** — so the simplest solution is just `'use client'` at the top of `RoadmapView.tsx`. Do not use `dynamic({ ssr: false })` at the page level (it errors in Next 15 server components) [CITED: github.com/vercel/next.js/discussions/72236].
**Example:**
```tsx
// pulse/src/app/dashboard/components/RoadmapView.tsx
'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts'

interface Props {
  holdings: HoldingWithFillTicker[]
  blend: BlendedStrategy | null
  monthlyBudget: number      // changes from ContributionCalculator? — see Open Question 1
}

export function RoadmapView({ holdings, blend, monthlyBudget }: Props) {
  const data = useMemo(
    () => computeRoadmap(holdings, blend, monthlyBudget, getCurrentTaxYear()),
    [holdings, blend, monthlyBudget],
  )

  if (!blend || data.length === 0) {
    return <div className="...glassmorphism...">Track creators and set a budget to see your roadmap.</div>
  }

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6">
      <h3 className="text-base font-semibold text-white mb-4">12-Month Roadmap</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#3A3A3C" strokeDasharray="3 3" opacity={0.4} />
          <XAxis dataKey="month" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
          <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
          <Tooltip content={<GlassTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="currentPath" name="Your Current Path" stroke="#818CF8" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="creatorVision" name="Creator's Vision" stroke="#6366F1" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-zinc-500 mt-3">Creator-derived information — not financial advice</p>
    </div>
  )
}
```
[CITED: recharts.org docs — LineChart + ResponsiveContainer]

### Anti-Patterns to Avoid
- **`<a className="...transition-colors">` only** — does not trigger framer animation. For tab-content fade use `AnimatePresence` on the active panel (D-11.2).
- **Calling `generatePlan()` server-side AND letting client re-call it on slider drag** — the existing pattern is correct: server pre-computes for SSR, client re-runs in `useMemo`. Do NOT add a Server Action for slider changes (would defeat sub-100ms requirement and re-introduce network round-trips).
- **`dynamic(() => import('recharts'), { ssr: false })` in page.tsx** — Next 15 errors. Use `'use client'` directive on `RoadmapView.tsx` directly.
- **Hardcoded hex inline styles in JSX** — Tailwind v4 `@theme` makes utility classes available; use `bg-surface` not `style={{backgroundColor: '#2C2C2E'}}`.
- **Floating-point arithmetic in roadmap.ts** — CLAUDE.md mandate: `decimal.js` for £ math. Convert to plain `number` only at the boundary into Recharts `data` (Recharts requires numbers for plotting).
- **Replacing existing zinc classes file-by-file with sed** — risk of missing focus rings (`focus:ring-indigo-500` should become `focus:ring-accent`). Plan should enumerate every file.
- **Using `motion(<input>)` on the budget slider** — D-11 explicitly does NOT animate the slider; only cards and tab content.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Time-series line chart | Pure SVG `<polyline>` with manual scaling | Recharts `LineChart` (D-05) | Axis tick formatting, responsive container, tooltips, legends — all solved |
| Accordion height animation | `max-height: 999px` CSS hack | Framer `AnimatePresence` + `height: 'auto'` | CSS hack jumps; framer measures actual height |
| Stagger animation | `setTimeout(setVisible[i], i * 50)` | Framer `staggerChildren` variant | Framer handles unmount, exit, reduced-motion preference |
| Tab transition state | `useState(activeTab)` + manual fade class | Server URL navigation + `AnimatePresence key={tab}` | Keeps deep-linking (D-12) working; bookmarkable |
| Glassmorphism card | Custom CSS in `globals.css` | Tailwind utilities `backdrop-blur-xl bg-white/5 border border-white/10` | Already in Tailwind; one-line; D-02 mandates exact classes |
| Color tokens | `tailwind.config.ts` | Tailwind v4 `@theme` in `globals.css` (D-03) | v4 doesn't read `tailwind.config.ts` for colors anymore |
| £ trajectory math | Native `* 0.6 + 100` | `new Decimal(x).mul(0.6).plus(100)` | CLAUDE.md mandate; consistent with generator.ts |

**Key insight:** Phase 6 is mostly about NOT writing new code. Almost every interactive piece exists. The only truly new file is `RoadmapView.tsx` + `roadmap.ts`.

## Runtime State Inventory

> Phase 6 is purely UI/styling/component work. No data migrations, no service config changes, no OS state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified by reading page.tsx data-fetching section. No DB schema or column changes. `buy_lists.unified_allocation` is still `{}` placeholder from Phase 5 — Phase 6 does NOT need to populate it. | None |
| Live service config | None — no Pinecone, Supabase service, or external service config changes. | None |
| OS-registered state | None. | None |
| Secrets/env vars | None — no new API keys; recharts is fully bundled. | None |
| Build artifacts | `pulse/node_modules` will gain `recharts` after `npm install recharts`. `package.json` and `package-lock.json` updated. No stale artifacts from prior phases. | Run `npm install` once after dependency add. |

## Common Pitfalls

### Pitfall 1: Tailwind v4 utility doesn't exist for custom token
**What goes wrong:** Writing `bg-space-grey-base` when the token is `--color-base`. Tailwind v4 strictly maps `--color-{name}` → `bg-{name}` / `text-{name}` / `border-{name}`. So `--color-base` produces `bg-base`, NOT `bg-space-grey-base` or `bg-base-100`.
**Why it happens:** Old Tailwind v3 `theme.extend.colors.spaceGrey.base` produced `bg-space-grey-base`. v4 is flatter.
**How to avoid:** Use the existing token names verbatim (`base`, `surface`, `border`, `accent`, `accent-hover`). If the planner wants a 100/200/300 scale, define `--color-base-100`, `--color-base-200`, etc.
**Warning signs:** Console shows raw `bg-base` strings appearing as no-op CSS during build.

### Pitfall 2: Recharts SSR hydration mismatch
**What goes wrong:** Importing recharts components in a Server Component throws hydration errors or build failures (Recharts uses browser globals like `ResizeObserver`).
**Why it happens:** Next 15 strict server components.
**How to avoid:** Put `'use client'` at the top of `RoadmapView.tsx`. Do NOT try `next/dynamic` with `ssr: false` from a server component — it errors at build in Next 15.
**Warning signs:** `ReferenceError: window is not defined` or `next/dynamic with ssr:false is not allowed in Server Components`.

### Pitfall 3: AnimatePresence requires a key
**What goes wrong:** Tab fade doesn't trigger on tab change; old content swaps instantly.
**Why it happens:** `AnimatePresence` only animates exits when its direct child has a unique `key` AND the child is conditionally rendered or its key changes.
**How to avoid:** `<AnimatePresence mode="wait"><motion.div key={activeTab}>...</motion.div></AnimatePresence>`. The page is a server component, so `activeTab` MUST flow into a client wrapper as a prop.
**Warning signs:** Tab switches instantly with no fade despite framer being installed.

### Pitfall 4: Decimal in `data` array breaks Recharts
**What goes wrong:** Recharts cannot plot Decimal objects; it expects plain numbers.
**Why it happens:** decimal.js objects don't auto-coerce in JSON serialisation.
**How to avoid:** In `computeRoadmap()`, do all math with `Decimal`, then `.toNumber()` ONLY when building the final `{ month, currentPath, creatorVision }[]` array. Round to `.toDecimalPlaces(2)` first.
**Warning signs:** Empty chart, console warnings "data passed to LineChart contained NaN".

### Pitfall 5: Server-side `upsertBuyList` race vs client `useMemo` recompute
**What goes wrong:** Page renders with server-computed plan → calls `upsertBuyList()` fire-and-forget. User immediately drags slider → client recomputes locally — but the DB still holds the server-budget version. After page reload, the displayed budget jumps back.
**Why it happens:** ContributionCalculator is purely local state. Slider value is NOT persisted. The slider's `monthlyBudget` is independent of `users.monthly_budget`.
**Status:** This is **EXISTING Phase 5 behaviour** — Phase 6 does NOT introduce it and does NOT need to fix it. CONTEXT.md says it's out of scope. Note for planner: if user reports stale buy list, that's Phase 5 territory.

### Pitfall 6: Glassmorphism card on no background = invisible
**What goes wrong:** `bg-white/5` (5% white) on top of black `#1C1C1E` gives subtle visibility, but on top of another transparent card gives near-zero contrast.
**Why it happens:** Glassmorphism requires a solid backdrop somewhere underneath.
**How to avoid:** The page background (`<body>` or `<main>`) MUST be the solid Space Grey base (`#1C1C1E`). Then cards stack on it cleanly. Don't nest `bg-white/5` cards inside other `bg-white/5` cards without a solid surface in between.
**Warning signs:** Cards look identical to the page; lost depth hierarchy.

### Pitfall 7: `framer-motion` import vs `motion/react`
**What goes wrong:** Picking the wrong import path for motion. The package is published as both `framer-motion` (v12) and `motion` (the renamed package). Tutorials inconsistent.
**How to avoid:** Use `import { motion, AnimatePresence } from 'framer-motion'` because `package.json` declares `framer-motion` as the dependency. Only switch to `motion/react` if you also change the `package.json` dependency name.
**Warning signs:** Build fails with `Module not found: 'motion'` or `Module not found: 'motion/react'`.

## Code Examples

### Example 1: Roadmap math (pure function, decimal.js)
```ts
// pulse/src/lib/plan/roadmap.ts
import { Decimal } from 'decimal.js'
import type { HoldingWithFillTicker } from '@/lib/plan/generator'
import type { BlendedStrategy } from '@/lib/strategy/blender'

export interface RoadmapPoint {
  month: string         // 'May 26', 'Jun 26', ...
  currentPath: number   // £
  creatorVision: number // £
}

/**
 * Compute monthly trajectory from today through end of UK tax year (5 April).
 * - currentPath: portfolio value + monthly_budget added each month, no rebalancing.
 * - creatorVision: same total contributions but conceptually distributed toward target;
 *   for a value-projection chart, both lines have the same TOTAL value over time
 *   (contribution sum is the same). Divergence shows when allocation rebalances:
 *     creatorVision = currentPortfolio + cumulativeBudget × targetMix
 *     currentPath  = currentPortfolio + cumulativeBudget × currentMix
 *   The lines diverge whenever currentMix ≠ targetMix.
 *
 * For a portfolio-value (£) y-axis with the same total contribution rate, the two
 * lines tracking sums alone would overlap. The intended divergence is a notional
 * "rebalanced value" — assume target-mix tracking is perfect (no growth, just
 * reallocation of contributions). The difference is allocation-level, not £-total.
 *
 * Recommendation: plot ALLOCATION-WEIGHTED projected portfolio, NOT raw cumulative
 * sum. See Open Question 2 — confirm semantics with planner before implementing.
 */
export function computeRoadmap(
  holdings: HoldingWithFillTicker[],
  blend: BlendedStrategy | null,
  monthlyBudgetGbp: number,
  taxYear: string,
): RoadmapPoint[] {
  if (!blend || Object.keys(blend.unified).length === 0) return []

  // Compute months from today to 5 April of taxYear's end
  const [, endStr] = taxYear.split('-')
  const endYear = 2000 + parseInt(endStr, 10)
  const endDate = new Date(Date.UTC(endYear, 3, 5))   // April 5
  const today = new Date()
  const monthCount = Math.max(0, monthsBetween(today, endDate))

  const portfolioStart = holdings.reduce(
    (s, h) => s.plus(h.currentValue),
    new Decimal(0),
  )
  const budget = new Decimal(monthlyBudgetGbp)
  const points: RoadmapPoint[] = []

  for (let i = 0; i <= monthCount; i++) {
    const cumulative = budget.mul(i)
    const currentPath = portfolioStart.plus(cumulative)
    // creatorVision = same total but applied with allocation drift toward target
    // For now, equal — divergence visualised in a separate "allocation drift" chart
    // OR weight by category mix difference (see Open Question 2)
    const creatorVision = portfolioStart.plus(cumulative)

    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + i, 1))
    points.push({
      month: date.toLocaleString('en-GB', { month: 'short', year: '2-digit' }),
      currentPath: currentPath.toDecimalPlaces(2).toNumber(),
      creatorVision: creatorVision.toDecimalPlaces(2).toNumber(),
    })
  }
  return points
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 +
         (b.getUTCMonth() - a.getUTCMonth())
}
```
**⚠ See Open Question 2** — `creatorVision` divergence formula needs planner clarification. The CONTEXT.md description ("Creator's Vision = same contributions but weighted toward blended target allocation") implies the lines diverge in *value*, but with no growth model both lines are mathematically identical. Either (a) interpret divergence as deviation between current portfolio mix and target mix (chart something like £-distance from target), or (b) introduce a simple growth/drift assumption. **Planner must resolve before implementation.**

### Example 2: Glassmorphism `RoadmapView` empty state
```tsx
'use client'
export function RoadmapView({ holdings, blend, monthlyBudget }: Props) {
  if (!blend || holdings.length === 0) {
    return (
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-8 text-center mt-6">
        <p className="text-sm text-zinc-300 mb-1">12-Month Roadmap</p>
        <p className="text-xs text-zinc-500">
          {!blend ? 'Track a creator and run Refresh to see your roadmap.' : 'Add holdings to see your roadmap trajectory.'}
        </p>
      </div>
    )
  }
  /* ... LineChart ... */
}
```

### Example 3: Page.tsx tab AnimatePresence wiring (D-11.2)
```tsx
// In page.tsx — wrap each conditional tab block:
<AnimatedTabPanel tabKey={activeTab}>
  {activeTab === 'portfolio' && <PortfolioTab profile={profile} holdings={holdings} />}
  {activeTab === 'creators' && <><CreatorsTab .../><BlendSummary .../></>}
  {activeTab === 'plan' && (
    <PlanTab
      portfolio={holdings}
      strategy={blend}
      isaRemaining={isaRemainingNumber}
      initialBudget={monthlyBudgetNumber}
    />
  )}
</AnimatedTabPanel>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3 `tailwind.config.ts` `theme.extend.colors` | Tailwind v4 `@theme { --color-* }` in CSS | Tailwind v4.0 (Jan 2025) | Existing `globals.css` already uses v4 pattern — keep using it |
| `framer-motion` (legacy import name) | `motion/react` (rebranded 2025) | Framer Motion → Motion rebrand | Both work; project's `package.json` declares `framer-motion`, use `'framer-motion'` import path |
| `next/dynamic({ ssr: false })` from server component | `'use client'` directive on the file directly | Next 15 (2024) | Recharts must live in `'use client'` file |
| Recharts 2.x peer `react ^16/17/18` | Recharts 3.x peer `react ^19` | Recharts 3.0 (2025) | Project uses React 19.1; install `recharts@^3` |

**Deprecated/outdated:**
- Tailwind `tailwind.config.ts` for color tokens — v4 prefers CSS-side `@theme`.
- `motion()` HOC — replaced by `motion.div` etc. since v6.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `react-is@^19` auto-resolves as transitive dep when installing `recharts@3.8.1` on a React 19 project | Standard Stack | Low — npm warn at most; fix with `npm install react-is@^19` |
| A2 | Roadmap View should compute trajectory client-side (in `RoadmapView.tsx` or via prop from `ContributionCalculator`) so slider drag updates the chart in real-time | Architectural Map | Medium — if planner decides server-side pre-compute, slider drag won't update chart. CONTEXT.md does NOT explicitly require chart to update on slider — see Open Question 1 |
| A3 | `creatorVision` line interpretation in the £-value y-axis is ambiguous when both lines have identical contribution streams | Code Examples + Open Question 2 | HIGH — could ship a chart with two overlapping lines. Planner must clarify the math before implementation |
| A4 | Planner uses `'framer-motion'` import path (not `'motion/react'`) since `package.json` declares the legacy name | Standard Stack + Pitfall 7 | Low — both export same API; keep consistency |
| A5 | Existing `<table>` in `BuyListTable.tsx` should be converted to a `<div>` list to host AnimatePresence accordion cleanly | Pattern 4 | Low — alternative `<tr colSpan>` pattern works but is uglier |

## Open Questions (RESOLVED 2026-05-07)

1. **Should the Roadmap View chart update when the user drags the Contribution Calculator slider?**
   - RESOLVED: Yes. Budget state lifted into `PlanTab.tsx` as `useState(initialBudget)`. Passed to both ContributionCalculator (controlled) and RoadmapView. Chart re-renders via `useMemo` on budget change with no network call. (Plan 06-02 + 06-03)

2. **What is the divergence formula between "Creator's Vision" and "Your Current Path"?**
   - RESOLVED: Option (b) — single-category focus. Y-axis = £ allocated to the largest-gap category. "Your Current Path" distributes contributions proportionally to current mix (category stays flat). "Creator's Vision" distributes contributions toward blended target (category grows toward target %). Produces visible divergence for 0% Tech vs 60% Tech target. D-08 updated in CONTEXT.md to reflect this. (Plan 06-03)

3. **Where should `lastRefreshedAt` render on the StrategyCard?**
   - RESOLVED: Added as prop to `StrategyCard.tsx`. Rendered below confidence score as "Last refreshed {date}". Wired from `creators-tab.tsx` via `lastRefreshedMap`. (Plan 06-04)

4. **`<table>` in `BuyListTable.tsx` — convert to card list or stay tabular?**
   - RESOLVED: Convert to `<div>` flex list of glassmorphism row cards. Enables AnimatePresence height animation for rationale accordion (D-09/D-13). Visually aligns with D-02. (Plan 06-02)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node + npm | Building / installing recharts | ✓ | (project working) | — |
| recharts | Roadmap View | ✗ (not yet installed) | install latest 3.8.1 | None — required by D-05 |
| framer-motion | All animations | ✓ | 12.38.0 | — |
| tailwindcss | All styling | ✓ | 4.x (^4 in package.json) | — |
| @tailwindcss/postcss | Build pipeline | ✓ | ^4 | — |
| next | App Router | ✓ | 15.5.16 | — |
| react / react-dom | Runtime | ✓ | 19.1.0 | — |

**Missing dependencies with no fallback:**
- `recharts` — must run `npm install recharts` as part of Wave 0 / 06-01 plan.

**Missing dependencies with fallback:**
- None.

## Validation Architecture

> `nyquist_validation: true` in `.planning/config.json` — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 (already configured) |
| Config file | `pulse/vitest.config.ts` (already exists, `@/` alias wired) |
| Quick run command | `cd pulse && npx vitest run --no-coverage <file>` |
| Full suite command | `cd pulse && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | Tailwind tokens compile to expected CSS classes | unit (component snapshot or class-name assertion) | `cd pulse && npx vitest run src/app/dashboard/components/PlanTab.test.tsx` | ❌ Wave 0 |
| UI-01 | Glassmorphism classes present on all 5 named components | unit (className assertion) | as above | ❌ Wave 0 |
| UI-02 | BuyListTable renders disclaimer string verbatim | unit | `cd pulse && npx vitest run src/app/dashboard/components/BuyListTable.test.tsx` | ❌ Wave 0 |
| UI-02 | BuyListTable renders rationale on row click (D-09) | unit (RTL fireEvent.click + getByText) | as above | ❌ Wave 0 |
| UI-03 | `computeRoadmap()` produces 12 monthly points covering today → 5 April | unit | `cd pulse && npx vitest run src/lib/plan/roadmap.test.ts` | ❌ Wave 0 |
| UI-03 | `computeRoadmap()` zero-strategy returns `[]` | unit | as above | ❌ Wave 0 |
| UI-03 | `computeRoadmap()` divergence: 0% Tech current vs 60% Tech blend → currentPath ≠ creatorVision in months > 0 | unit | as above | ❌ Wave 0 |
| UI-04 | ContributionCalculator slider change updates BuyListTable contents in single render (no API call) | unit (RTL fireEvent.change on range, expect new £ amounts) | `cd pulse && npx vitest run src/app/dashboard/components/ContributionCalculator.test.tsx` | ❌ Wave 0 |
| UI-05 | StrategyCard renders confidence + lastRefreshedAt + contradiction badge correctly | unit (RTL with mock CreatorStrategy) | `cd pulse && npx vitest run src/app/dashboard/components/StrategyCard.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd pulse && npx vitest run --no-coverage <file related to commit>`
- **Per wave merge:** `cd pulse && npx vitest run`
- **Phase gate:** Full vitest suite green + manual smoke pass before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `pulse/src/lib/plan/roadmap.test.ts` — covers UI-03 trajectory math
- [ ] `pulse/src/app/dashboard/components/BuyListTable.test.tsx` — covers UI-02 disclaimer + accordion
- [ ] `pulse/src/app/dashboard/components/ContributionCalculator.test.tsx` — covers UI-04 live recalculation
- [ ] `pulse/src/app/dashboard/components/StrategyCard.test.tsx` — covers UI-05 card content
- [ ] `pulse/src/app/dashboard/components/PlanTab.test.tsx` (optional — exercises integration) — covers UI-01 / UI-02
- [ ] React Testing Library install: `cd pulse && npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom` — vitest project doesn't yet have RTL
- [ ] Update `vitest.config.ts` to use `environment: 'jsdom'` and import `@testing-library/jest-dom` setup file (only if RTL tests are added)

**Note:** UI-01 visual fidelity (glassmorphism appearance, animation feel) cannot be unit-tested. These remain manual smoke-checks in `/gsd-verify-work`. Recharts canvas rendering also cannot be unit-tested — only the `computeRoadmap` math underneath is.

## Security Domain

> `security_enforcement` not explicitly disabled — applying default. Phase 6 is UI-only with no new auth flows, no new endpoints, no new user-input handling beyond existing slider/forms — minimal applicable surface.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | unchanged from Phase 1 (Supabase Auth) |
| V3 Session Management | no | unchanged |
| V4 Access Control | no | unchanged — no new endpoints; existing server actions retain `getUser()` + `.eq('user_id', user.id)` |
| V5 Input Validation | yes (light) | Range slider already clamps `200 ≤ budget ≤ 1000` in ContributionCalculator. Roadmap month parsing uses `getCurrentTaxYear()` (server-only, no user input). |
| V6 Cryptography | no | none used |
| V7 Error Handling | yes | Generic "Something went wrong. Please try again." messaging maintained (existing pattern). Recharts errors wrapped in error boundary recommended. |
| V11 Business Logic | yes | "Not financial advice" disclaimer required on EVERY surface that shows the Buy List or trajectory (CLAUDE.md mandate; PLAN-04). Already enforced in `BuyListTable.tsx`; must also appear under `RoadmapView`. |
| V13 API & Web Service | no | no new APIs |
| V14 Configuration | no | no new env vars |

### Known Threat Patterns for Next 15 + React 19 + Recharts

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via creator displayName / rationale string | Tampering | Both rendered as text inside JSX — React auto-escapes. Do NOT use `dangerouslySetInnerHTML`. |
| ReDoS / parsing on contradictionNote | DoS | Existing `parseNoteToShifts` regex is anchored — no catastrophic backtracking |
| Recharts SVG injection from data prop | Tampering | Recharts only consumes numeric `data` — no string passthrough |
| Disclaimer omission (regulatory) | Information disclosure | All Buy List + Roadmap surfaces MUST render "Creator-derived information — not financial advice" verbatim. Manual verifier check. |
| Tab parameter injection | Tampering | `activeTab` already validated via whitelist `['portfolio', 'creators', 'plan'].includes(rawTab)` in page.tsx — pattern preserved |

## Project Constraints (from CLAUDE.md)

These are NON-NEGOTIABLE and apply to every task in this phase:

1. **No "advice"/"recommend"/"suggest" language** in user-facing strings. Every panel that surfaces creator output must be labelled "creator-derived information." Disclaimer "Creator-derived information — not financial advice" required on Buy List AND Roadmap.
2. **decimal.js for all £ arithmetic.** RoadmapView trajectory math must use `Decimal` internally, only converting to `number` at the Recharts `data` boundary.
3. **UK tax year 6 April – 5 April.** Roadmap horizon uses `getCurrentTaxYear()` from `pulse/src/lib/tax-year.ts`.
4. **Manual-first v1.** No background polling, no WebSockets, no auto-refresh of charts. ContributionCalculator local state + `useMemo` recompute is the only "live" interaction.
5. **RAG pattern for Claude.** N/A in Phase 6 (no Claude calls).
6. **Standard category names: Index Funds, Stocks, Cash.** All UI rendering uses these strings exactly (matches `AssetCategory` type).

## Sources

### Primary (HIGH confidence)
- `pulse/package.json` — dependency manifest [VERIFIED: read]
- `pulse/src/app/globals.css` — existing Tailwind v4 `@theme` config [VERIFIED: read]
- `pulse/src/types/index.ts` — domain types BuyListItem, CreatorStrategy, etc. [VERIFIED: read]
- `pulse/src/app/dashboard/page.tsx` — current data fetch + tab routing pattern [VERIFIED: read]
- `pulse/src/app/dashboard/components/*.tsx` — all 7 existing components [VERIFIED: read]
- `pulse/src/lib/plan/generator.ts` — PlanResult shape [VERIFIED: read]
- `pulse/src/lib/strategy/blender.ts` — BlendedStrategy shape [VERIFIED: read]
- `pulse/src/lib/tax-year.ts` — getCurrentTaxYear / formatTaxYearDisplay [VERIFIED: read]
- `npm view recharts` — 3.8.1 published 2026-03-25 with React 19 peer support [VERIFIED: npm registry]
- `.planning/phases/06-dashboard-ui/06-CONTEXT.md` — locked decisions [VERIFIED: read]
- `.planning/phases/06-dashboard-ui/06-DISCUSSION-LOG.md` — alternative options [VERIFIED: read]
- `.planning/REQUIREMENTS.md` — UI-01..05 [VERIFIED: read]
- `.planning/STATE.md` — phase progress [VERIFIED: read]
- `.planning/ROADMAP.md` — phase 6 plans + success criteria [VERIFIED: read]
- `CLAUDE.md` — project guardrails [VERIFIED: read]

### Secondary (MEDIUM confidence)
- Tailwind CSS v4 `@theme` docs — utility generation from `--color-*` [CITED: tailwindcss.com/docs/theme via web search]
- Framer Motion docs — `staggerChildren`, `AnimatePresence` patterns [CITED: motion.dev/docs/react via web search]
- Next.js 15 dynamic-import-with-ssr-false rule [CITED: github.com/vercel/next.js/discussions/72236 via web search]
- Recharts custom tooltip pattern [CITED: paigeniedringhaus.com / programcreek recharts examples via web search]

### Tertiary (LOW confidence)
- None of the planning-blocking claims are LOW-confidence. Some styling specifics (exact tooltip background colour, axis tick formatting) are at planner's discretion per CONTEXT.md.

## Metadata

**Confidence breakdown:**
- Standard stack (recharts version, React 19 compat): HIGH — verified npm registry + peerDeps
- Architecture (server/client split): HIGH — codebase already uses this pattern
- Pitfalls: HIGH — derived from reading existing components + Next 15 known issues
- Roadmap math semantics: MEDIUM — Open Question 2 needs planner clarification
- Animation patterns: HIGH — framer-motion v12 + Next 15 + React 19 stable combo
- Tailwind v4 `@theme`: HIGH — already working in project

**Research date:** 2026-05-07
**Valid until:** 2026-06-06 (30 days; recharts and framer-motion are stable)
