# Phase 6: Dashboard UI - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 delivers the visual layer. All functional components (PlanTab, BuyListTable, ContributionCalculator, StrategyCard, BlendSummary, TrustWeightSlider, ContradictionDiff) exist and work from Phases 4–5. This phase:
1. Migrates the entire dashboard to the Space Grey + Electric Indigo glassmorphism design system
2. Wires Framer Motion animations (card mount stagger + tab content fade)
3. Builds the Roadmap View chart (Recharts LineChart, 2 trajectory lines)
4. Adds expandable ticker rationale rows to BuyListTable

Phase ends when all 5 UI success criteria pass: glassmorphism renders, Action Plan shows with disclaimer, Roadmap View shows two trajectory lines, creator cards show strategy + confidence sliders, Contribution Calculator updates Buy List in real time.

**Out of scope for Phase 6:**
- New data logic or computation changes (all in Phases 4–5)
- Historical plan comparison
- Multi-creator attribution in the rationale panel (deferred)
- Separate Roadmap tab (Roadmap View is a section within Plan tab)
- Client-side tab state (keep URL-based navigation)

</domain>

<decisions>
## Implementation Decisions

### Design System Migration
- **D-01:** Full palette swap — replace `bg-zinc-900/800/700` with Space Grey hex values (`#1C1C1E` base, `#2C2C2E` surface, `#3A3A3C` border) and Electric Indigo (`#6366F1` primary, `#818CF8` hover) project-wide. Applied to every component: page background, cards, nav, inputs, buttons.
- **D-02:** All content cards become glassmorphism: `backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl`. Applied to StrategyCard, BlendSummary, PlanTab card wrapper, Roadmap View card.
- **D-03:** Palette wired via CSS custom properties in `pulse/src/app/globals.css` (Tailwind v4 pattern — no `tailwind.config.ts`). Use `@theme` or `--color-*` custom properties for the new tokens.
- **D-04:** Layout widened from `max-w-2xl` to `max-w-4xl` (~896px) in `page.tsx`. Single change; all tabs benefit.

### Roadmap View Chart
- **D-05:** Install `recharts` as a dependency. Use `LineChart` with two `Line` series.
- **D-06:** Roadmap View is a section within the **Plan tab**, below the Buy List — not a separate tab. Three-tab navigation (Portfolio | Creators | Plan) unchanged.
- **D-07:** Time horizon = 12 months covering the current UK tax year (today → 5 April). Use `getCurrentTaxYear()` from `lib/tax-year.ts`.
- **D-08:** Y-axis = **£ allocated to the largest-gap category** (the category with the biggest deficit between current allocation and blended target). Two lines:
  - **"Your Current Path"** — £ in that category grows only from proportional contributions (current mix, no rebalancing)
  - **"Creator's Vision"** — £ in that category grows as if each month's budget follows the blended target allocation (closes the gap faster)
  - Both lines plotted monthly across the 12-month horizon. All arithmetic uses `decimal.js`. This formula produces visible divergence for success criterion 3: a user with 0% Tech and a 60% Tech target shows Tech holdings growing on the Creator's Vision line while staying flat on Your Current Path. *(Updated 2026-05-07: original "total portfolio value" Y-axis was changed because both lines would be identical with no growth model.)*

### Ticker Rationale Panel
- **D-09:** Expandable inline row — clicking a ticker row in BuyListTable toggles an expanded section in-place. Uses Framer Motion `AnimatePresence` + `motion.div` with height animation. Matches the `ContradictionDiff` accordion pattern already in the codebase.
- **D-10:** Expanded content shows: category, current allocation %, target allocation %, gap %, and the £amount as "closes X% of gap." All data already present in `BuyListItem` — no new API calls required.

### Animation
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Requirements
- `.planning/PROJECT.md` — project goals, constraints, out-of-scope items
- `.planning/REQUIREMENTS.md` — UI-01 through UI-05 requirements for this phase
- `.planning/ROADMAP.md` §Phase 6 — 5 plans and 5 success criteria; canonical spec for every panel

### Critical Constraints
- `CLAUDE.md` — no "advice/recommend/suggest" language; disclaimer required on Buy List; decimal.js for all £; UK tax year definition

### Prior Phase Decisions
- `.planning/phases/05-plan-generator/05-CONTEXT.md` — ContributionCalculator design (free-drag slider + numeric input, £200–£1,000, client-side, initialises from `users.monthly_budget`)
- `.planning/phases/04-strategy-extraction-blending/04-CONTEXT.md` — zinc dark theme patterns, contradiction diff accordion, trust weight slider, StrategyCard data shape

### Existing Code (read before planning)
- `pulse/src/app/dashboard/page.tsx` — current layout, tab structure, data fetching, existing component imports
- `pulse/src/app/dashboard/components/PlanTab.tsx` — current Plan tab; Phase 6 extends this
- `pulse/src/app/dashboard/components/BuyListTable.tsx` — ticker row component; D-09 adds expandable rationale here
- `pulse/src/app/dashboard/components/ContradictionDiff.tsx` — accordion pattern to reuse for ticker rationale
- `pulse/src/app/dashboard/components/StrategyCard.tsx` — creator card; glassmorphism applied here
- `pulse/src/app/dashboard/components/ContributionCalculator.tsx` — slider; already functional, Phase 6 reskins
- `pulse/src/app/dashboard/components/BlendSummary.tsx` — blend summary card; glassmorphism applied here
- `pulse/src/lib/tax-year.ts` — `getCurrentTaxYear()` for Roadmap View 12-month horizon
- `pulse/src/types/index.ts` — `BuyListItem` type with `allocationGapPct`, `amount_gbp`, `category`
- `pulse/src/app/globals.css` — Tailwind v4 theme config; D-03 adds Space Grey + Electric Indigo tokens here

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ContradictionDiff.tsx` — accordion expand/collapse pattern with AnimatePresence; reuse directly for ticker rationale rows (D-09)
- `TrustWeightSlider.tsx` — already uses Framer Motion; reference for animation variant patterns
- `HoldingModal.tsx` — modal pattern; considered for rationale but accordion chosen instead
- `getCurrentTaxYear()` in `lib/tax-year.ts` — returns tax year boundaries; use for Roadmap View x-axis

### Established Patterns
- **Dark theme zinc baseline:** All existing components use `bg-zinc-800 border border-zinc-700 rounded-xl`. D-01 replaces this globally with Space Grey palette.
- **Server component + Client component split:** `page.tsx` (Server Component) fetches data and passes as props; `ContributionCalculator` (Client Component) recomputes client-side. Roadmap View data (portfolio value projections) can be computed server-side and passed as props.
- **decimal.js everywhere:** All £ arithmetic must use `new Decimal()`. Roadmap View trajectory computation is no exception.
- **No tailwind.config.ts:** Tailwind v4 — theme customisation via CSS `@theme` block or `--color-*` vars in `globals.css`.
- **framer-motion v12:** Installed. Use `motion.div`, `AnimatePresence`, `variants` + `staggerChildren` for card lists.

### Integration Points
- `page.tsx` passes `buyList`, `blendedStrategy`, `holdings`, `isaContributions`, `profile` to PlanTab — Roadmap View receives `holdings`, `profile.monthlyBudget`, and `blendedStrategy` as props from same fetch
- `BuyListTable` receives `BuyListItem[]`; expandable rationale rows are internal to this component (no prop changes needed from parent)
- recharts `LineChart` is a Client Component (uses browser APIs) — wrap Roadmap View in `'use client'`

</code_context>

<specifics>
## Specific Ideas

- Glassmorphism card: `backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl` — exact classes from ROADMAP.md plan 1
- Space Grey palette: `#1C1C1E` (page bg), `#2C2C2E` (card surface), `#3A3A3C` (border)
- Electric Indigo: `#6366F1` (primary / active tab underline), `#818CF8` (hover)
- Recharts `LineChart` with two `Line` series: `stroke="#6366F1"` (Creator's Vision) and `stroke="#818CF8"` (Your Current Path)
- Card stagger: `staggerChildren: 0.05` (50ms) in parent `variants`; children use `initial={{ opacity: 0, y: 8 }}` → `animate={{ opacity: 1, y: 0 }}`
- Contribution Calculator: free-drag `<input type="range">` + `<input type="number">` side by side; £200–£1,000 range; no Framer Motion needed on the slider itself (already functional)

</specifics>

<deferred>
## Deferred Ideas

- **Creator attribution in rationale** — showing which creator drove a category target in the ticker rationale panel. Belongs in a future enhancement; would require passing BlendSummary breakdown down to BuyListTable.
- **Separate Roadmap tab** — user confirmed Roadmap View stays in Plan tab section; a dedicated tab is a future navigation refactor if needed.

</deferred>

---

*Phase: 6-Dashboard UI*
*Context gathered: 2026-05-07*
