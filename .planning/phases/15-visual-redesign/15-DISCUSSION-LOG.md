# Phase 15: Visual Redesign - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 15-visual-redesign
**Areas discussed:** Typography & font, Motion philosophy, Component extraction, Mobile layout approach

---

## Typography & font

| Option | Description | Selected |
|--------|-------------|----------|
| Geist | Vercel's geometric typeface, technical feel, dark UI pairing, Next.js 15 default | ✓ |
| DM Sans | Warm, modern geometric sans; used in fintech (Revolut, Freetrade) | |
| Space Grotesk | Distinctive, startup-fintech feel; heavy at small sizes | |
| Inter (system) | Safe, neutral, no personality risk or gain; no font load | |

**User's choice:** Geist (proportional) for UI text, Geist Mono for tickers/prices/numbers

| Option | Description | Selected |
|--------|-------------|----------|
| Geist Mono for tickers/prices | Columns align, numbers stable width | ✓ |
| Proportional Geist everywhere | Simpler — one family | |

**User's choice:** Geist Mono for financial data

| Option | Description | Selected |
|--------|-------------|----------|
| Tight & dense | text-sm headings, max data visibility | |
| Generous & airy | text-xl/2xl headings, premium feel, more whitespace | ✓ |

**User's choice:** Generous & airy — personal tool, premium feel prioritised

---

## Motion philosophy

| Option | Description | Selected |
|--------|-------------|----------|
| Purposeful & subtle | Fade-in, smooth tab transitions, hover lifts only | |
| Expressive & cinematic | Entrance animations, number counting, tab wipe | ✓ |
| Minimal | CSS transitions only, no Framer Motion | |

**User's choice:** Expressive & cinematic

**Specific effects selected:**
- Number counting on prices/totals — yes
- Tab transition wipe — yes
- Card stagger on load — yes
- Hover lift on cards — yes

| Option | Description | Selected |
|--------|-------------|----------|
| Respect prefers-reduced-motion | useReducedMotion() guard on all animations | ✓ |
| Animations always on | Simpler but fails accessibility | |

**User's choice:** Respect prefers-reduced-motion

---

## Component extraction

| Option | Description | Selected |
|--------|-------------|----------|
| New pulse/src/components/ui/ folder | Shared Card, Badge, Button, StatTile primitives | ✓ |
| Refactor in-place per tab | Touch each component individually, no shared folder | |
| Install shadcn/ui | Pre-built components — conflicts with Tailwind v4 CSS-first | |

**User's choice:** pulse/src/components/ui/ with bespoke primitives

**Primitives selected:** Card, Badge/Chip, Button, StatTile (all four)

| Option | Description | Selected |
|--------|-------------|----------|
| Pill-style tab bar with animated indicator | Frosted glass pill, accent fill for active, layoutId slide | ✓ |
| Keep current tab structure | Restyle content only | |

**User's choice:** Pill-style tab bar redesign

---

## Mobile layout approach

| Option | Description | Selected |
|--------|-------------|----------|
| Stack full-width, collapse ticker table to summary | Clean, readable on phone; expand on tap | ✓ |
| Horizontal scroll within cards | Familiar but awkward on touch | |
| Separate mobile component tree | Most control, doubles maintenance surface | |

**User's choice:** Stack full-width, collapse ticker table to "Top picks: AAPL, TSLA +3 more" summary with expand

| Option | Description | Selected |
|--------|-------------|----------|
| Collapse to mini cards per holding | Consistent with Watch List card treatment | ✓ |
| Horizontal scroll on the table | Poor UX on phones | |

**User's choice:** Mini cards — one card per holding on mobile

| Option | Description | Selected |
|--------|-------------|----------|
| sm: 640px and md: 768px only | Standard Tailwind, two breakpoints sufficient | |
| Mobile-first with xs: 480px | More granular, adds complexity | |
| Desktop-first (current approach) | Preserve existing markup order, overlay sm: overrides | ✓ |

**User's choice:** Desktop-first — preserve existing markup, add sm: overrides

---

## Claude's Discretion

- Exact glassmorphism values (blur radius, opacity, border opacity)
- Spacing rhythm tokens (gap sizes, padding scale)
- StatTile sparkline slot — only if supported by existing price data without new server actions
- Number counting animation duration and easing

## Deferred Ideas

- Dark/light mode toggle — dark-first only for v1.2; toggle is a future phase
- Custom xs: 480px breakpoint — not needed with current desktop-first approach
- Sparkline charts in portfolio mini cards — possible future enhancement
