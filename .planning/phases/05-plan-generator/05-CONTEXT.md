# Phase 5: Plan Generator - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 delivers the computation layer that turns data into action: `PlanGenerator.ts` (pure TS function) produces an ISA-capped Buy List from portfolio + budget + blended strategy; an API route stores the plan; and a Contribution Calculator slider recomputes the plan client-side in real time. No AI calls in this phase — pure arithmetic and existing data.

**In scope:**
- `PlanGenerator.ts` pure function (portfolio + budget + strategy + ISA remaining → Buy List)
- ISA allowance guard (truncate + warn when budget > remaining)
- Preferred fill-ticker setup on the Holdings tab (mark one holding per category)
- API route `/api/plan/generate` (upsert to `buy_lists` table)
- Contribution Calculator slider (inline on dashboard, client-side recompute, no network)

**Out of scope:**
- Glassmorphism design polish (Phase 6)
- Historical plan comparison
- Automatic plan regeneration on trust-weight change (user triggers via page reload)

</domain>

<decisions>
## Implementation Decisions

### Ticker Selection Algorithm
- **D-01:** User designates one **preferred fill ticker** per category on the Holdings tab (e.g., star or radio button next to a holding). PlanGenerator always tops up the preferred ticker when a category is underweight.
- **D-02:** Schema change needed — add a mechanism to mark one holding per category as the fill ticker. Planner to decide between a boolean column on `portfolio_holdings` (`is_fill_ticker`) or a separate `user_category_fill_tickers (user_id, category, ticker)` table. Migration via Supabase SQL editor (D-03 from Phase 1).
- **D-03:** If no preferred ticker is marked for a category that has holdings, **skip that category** in the Buy List and show an inline prompt: "Mark a preferred holding for [Category] to include it in your plan."
- **D-04:** If the blended strategy targets a category the user has **zero holdings in**, show the gap as informational — "You're X% underweight in Bonds — add a holding to get started" — but don't recommend a ticker. No purchase row emitted.

### Generation Trigger & Empty States
- **D-05:** Buy List **auto-generates on page load** — no explicit "Generate" button. The dashboard server component fetches portfolio + latest blended strategy and calls PlanGenerator at render time.
- **D-06:** No blended strategy exists yet (creators not refreshed): show a **placeholder card** — "Refresh a creator to generate your first Buy List."
- **D-07:** Plan storage is **upsert / always overwrite** — one current Buy List per user. No plan history in v1.
- **D-08:** Holdings and strategy exist but no preferred tickers are marked anywhere: show **category gap rows only** (no ticker rows) plus a top-level banner — "Mark preferred holdings to get specific buy suggestions."

### Contribution Calculator
- **D-09:** Calculator lives **inline on the dashboard** — slider above the Buy List table. Phase 6 will restyle it; Phase 5 wires the functional component.
- **D-10:** Slider is **free drag + numeric input** (not snapping to £50 steps). User can drag or type any integer value in £200–£1,000.
- **D-11:** Slider initialises to the user's saved **`monthly_budget`** from the DB (from `users.monthly_budget`, already populated by Portfolio settings in Phase 2). Falls back to £500 if null.
- **D-12:** Recompute is **client-side only** — PlanGenerator is a pure TS function with no server-only deps, importable in a Client Component. Strategy and portfolio data are passed as props from the server component on initial load; the calculator uses these cached values for every recalculation without a network call.

### Claude's Discretion
- Layout and styling of the Buy List table and category-gap rows (within existing Tailwind conventions). Phase 6 will redesign the full UI; Phase 5 just needs it functional and readable.
- Exact column layout of the Buy List table (ticker | category | amount | gap closed %).
- Whether the ISA warning renders as a banner above the table or as a footer note below it.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Requirements
- `.planning/PROJECT.md` — Core value, constraints (decimal.js, info-only framing, ISA rules)
- `.planning/REQUIREMENTS.md` — PLAN-01, PLAN-02, PLAN-03, PLAN-04, ISA-02 (full requirement text)

### Critical Constraints
- `CLAUDE.md` §Critical Constraints — decimal.js mandatory for all £ arithmetic; no "advice"/"recommend" in user-facing text; ISA tax year 6 Apr–5 Apr; RAG pattern (not relevant here); manual-first
- `CLAUDE.md` §Key Domain Knowledge — asset allocation categories (8), ISA allowance mechanics

### Schema
- `.planning/phases/01-foundation/schema.sql` — `portfolio_holdings`, `buy_lists`, `isa_contributions` table definitions; RLS policies; Phase 5 requires a new migration for preferred fill ticker (D-02)

### Prior Phase Decisions
- `.planning/phases/04-strategy-extraction-blending/04-CONTEXT.md` — `blender.ts` outputs plain `number` (not Decimal); PlanGenerator wraps in `new Decimal()` on use
- `.planning/phases/04-strategy-extraction-blending/04-05-SUMMARY.md` — BlendSummary + strategy data shapes passed from `page.tsx`

### Existing Code (read before planning)
- `pulse/src/types/index.ts` — `BuyList`, `BuyListItem`, `Holding`, `ISAContribution`, `AssetCategory` (8 categories), `BlendedStrategy` already defined
- `pulse/src/lib/strategy/blender.ts` — `blendStrategies(input: BlendInput): BlendedStrategy` — the input to PlanGenerator
- `pulse/src/app/dashboard/page.tsx` — server component that will call PlanGenerator at render time; already fetches portfolio + strategy data
- `pulse/src/app/dashboard/creators-tab.tsx` — pattern for client components receiving strategy props
- `pulse/src/app/actions.ts` (or `pulse/src/app/dashboard/actions.ts`) — `saveCreatorWeight` pattern to follow for any new server actions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `blendStrategies()` in `pulse/src/lib/strategy/blender.ts` — PlanGenerator takes its `BlendedStrategy` output directly as input
- `BuyList` / `BuyListItem` types in `pulse/src/types/index.ts` — already defined with `budgetGbp: Decimal` and `allocationGapPct`; PlanGenerator just needs to populate them
- `Holding` type in `pulse/src/types/index.ts` — input type for PlanGenerator portfolio arg
- `ISAContribution` type — for computing `isa_remaining` before calling PlanGenerator
- `createClient()` / `createServiceClient()` pattern from Phase 3/4 — API route uses service client for the `buy_lists` upsert

### Established Patterns
- **Pure function + server action** — `blender.ts` / `extractor.ts` are pure TS, no I/O; PlanGenerator follows the same pattern
- **decimal.js everywhere** — all £ amounts in `new Decimal()` before any arithmetic; `BuyListItem.amount_gbp` is `Decimal` in types
- **No CLI migrations** — schema changes (preferred fill ticker column) run via Supabase SQL editor (Phase 1 D-03)
- **Server component fetches + client component recomputes** — page.tsx fetches on load; ContributionCalculator is a Client Component that recomputes in browser

### Integration Points
- `page.tsx` calls PlanGenerator server-side at render time → passes `BuyList` as prop to the Buy List display component + `ContributionCalculator`
- `ContributionCalculator` (Client Component) receives `portfolio`, `strategy`, `isaBudget`, `initialBudget` as props from `page.tsx`; runs PlanGenerator in-browser on slider change
- `/api/plan/generate` route upserts to `buy_lists` table; called by `page.tsx` server component (or server action) after computing the plan
- Holdings tab extended to support marking a preferred fill ticker (new UI + server action to update DB)

</code_context>

<specifics>
## Specific Ideas

- Contribution Calculator: free-drag slider + numeric input field side by side, initialises from `users.monthly_budget`, £200–£1,000 range
- Buy List table shows a "gap closed %" progress bar per row (already in `BuyListItem.allocationGapPct`)
- Category-gap-only rows (no preferred ticker) rendered differently from full buy rows — lighter styling, setup-prompt link
- Disclaimer: "Creator-derived information — not financial advice" rendered below the Buy List table (PLAN-04)

</specifics>

<deferred>
## Deferred Ideas

- Plan history / "compare this month vs last month" — v2 feature
- Automatic plan regeneration on trust-weight slider change (would require real-time blending; v2)
- Exporting the Buy List as CSV/PDF

</deferred>

---

*Phase: 5-plan-generator*
*Context gathered: 2026-05-07*
