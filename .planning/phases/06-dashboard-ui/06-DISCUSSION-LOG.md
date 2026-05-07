# Phase 6: Dashboard UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-07
**Phase:** 6-dashboard-ui
**Areas discussed:** Glassmorphism depth, Roadmap View chart, Ticker rationale panel, Animation scope

---

## Glassmorphism depth

### Q1: Palette migration scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full palette swap | Replace zinc-900/800/700 with Space Grey hex values project-wide. All cards become glassmorphism. | ✓ |
| Cards only — keep zinc for nav | Glassmorphism only on content cards; tab bar and nav stay zinc. | |
| You decide | Claude picks the most coherent approach. | |

**User's choice:** Full palette swap
**Notes:** Every component gets the Space Grey + Electric Indigo treatment. Tailwind v4 wires via CSS custom properties in globals.css.

---

### Q2: Layout width

| Option | Description | Selected |
|--------|-------------|----------|
| Widen to max-w-4xl (~896px) | One layout change in page.tsx; all tabs benefit. | ✓ |
| Stay at max-w-2xl | Consistent with existing pages; tighter for Roadmap View. | |
| Per-tab width | Different widths per tab; more complex. | |

**User's choice:** Widen to max-w-4xl
**Notes:** Single change in page.tsx wrapper div.

---

### Q3: Roadmap View placement

| Option | Description | Selected |
|--------|-------------|----------|
| Section within Plan tab | Below Buy List, scrollable. No navigation change. | ✓ |
| Separate Roadmap tab | 4th tab added to nav. | |

**User's choice:** Section within Plan tab
**Notes:** Three-tab nav (Portfolio | Creators | Plan) unchanged.

---

## Roadmap View chart

### Q1: Chart library

| Option | Description | Selected |
|--------|-------------|----------|
| Install recharts | LineChart with two series, ~20 lines JSX, ~450KB bundle. | ✓ |
| Pure SVG | No new deps, full control, more build time. | |
| CSS progress bars | Simpler, but doesn't show time-trajectory. | |

**User's choice:** Install recharts

---

### Q2: Time horizon

| Option | Description | Selected |
|--------|-------------|----------|
| 12 months (current tax year) | Today → 5 April. Natural ISA boundary. | ✓ |
| 24 months | Longer view, more complex ISA reset handling. | |
| Until target reached | Variable horizon. | |

**User's choice:** 12 months (current tax year)

---

### Q3: Y-axis

| Option | Description | Selected |
|--------|-------------|----------|
| Portfolio value (£) over time | Two lines: flat contributions vs target-weighted contributions. | ✓ |
| Allocation % per category | Multiple lines, one per category. Busier. | |

**User's choice:** Portfolio value (£) over time
**Notes:** "Your Current Path" = current value + monthly contributions flat. "Creator's Vision" = same contributions weighted to blended target allocation.

---

## Ticker rationale panel

### Q1: Where rationale appears

| Option | Description | Selected |
|--------|-------------|----------|
| Expandable inline row | Accordion in-place, matches ContradictionDiff pattern. | ✓ |
| Modal dialog | Matches HoldingModal pattern, better for longer content. | |
| Side drawer | Premium feel, no existing pattern. | |

**User's choice:** Expandable inline row
**Notes:** Uses Framer Motion AnimatePresence. Reuses ContradictionDiff accordion pattern.

---

### Q2: Rationale content

| Option | Description | Selected |
|--------|-------------|----------|
| Category + gap data + amount breakdown | All in BuyListItem already. No new API calls. | ✓ |
| Creator attribution too | Which creator drove the target. Needs BlendSummary data passed down. | |

**User's choice:** Category + gap data + amount breakdown

---

## Animation scope

### Q1: Animation breadth

| Option | Description | Selected |
|--------|-------------|----------|
| Cards + tab content on mount | Staggered card mount + tab content fade. 2 patterns. | ✓ |
| Mount only — cards fade in | Minimal. Meets SC literally. | |
| Full motion system | 4–5 patterns: mount + tabs + calculator + rationale + chart draw-in. | |

**User's choice:** Cards + tab content on mount
**Notes:** 50ms stagger between cards; AnimatePresence on tab content panel.

---

### Q2: Tab navigation model

| Option | Description | Selected |
|--------|-------------|----------|
| Keep server-side URL links | Current pattern. Works with App Router. AnimatePresence on content panel. | ✓ |
| Convert to client-side state | Instant transitions but breaks deep-linking. | |

**User's choice:** Keep server-side URL links

---

## Claude's Discretion

- Exact easing curves and durations for Framer Motion variants (stay within 150–400ms)
- Recharts tooltip and axis styling to match glassmorphism palette
- Empty state for Roadmap View (no holdings or budget)
- ISA warning placement (banner vs footer note) within PlanTab

## Deferred Ideas

- Creator attribution in the ticker rationale panel (which creator drove a category target)
- Separate Roadmap tab as a dedicated navigation item
