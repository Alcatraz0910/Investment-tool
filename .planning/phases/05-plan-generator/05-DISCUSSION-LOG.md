# Phase 5: Plan Generator - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-07
**Phase:** 5-plan-generator
**Areas discussed:** Ticker selection algorithm, Generation trigger & empty states, Contribution Calculator scope

---

## Ticker Selection Algorithm

| Option | Description | Selected |
|--------|-------------|----------|
| Most underweight holding in the category | Pick the holding furthest below its proportional target | |
| Split proportionally across all holdings | Distribute category budget across all holdings in the category | |
| User picks one preferred ticker per category | User nominates one 'fill' ticker per category on the Holdings tab | ✓ |
| Category-level only — no specific ticker | Show 'Buy £250 of Tech' without naming a stock | |

**User's choice:** User picks one preferred ticker per category

---

| Option | Description | Selected |
|--------|-------------|----------|
| On Holdings tab — mark one holding as preferred | Star or radio button next to holdings; PlanGenerator uses starred holding | ✓ |
| During plan generation — one-time setup screen | First-time setup flow before first Buy List | |
| Auto-pick largest holding in category | No setup; largest by value is always used | |

**User's choice:** On Holdings tab — mark one holding as preferred

---

| Option | Description | Selected |
|--------|-------------|----------|
| Skip + prompt (no preferred set) | Skip category, show 'Mark a preferred holding for [Category]' | ✓ |
| Auto-pick largest as fallback | Use highest-value holding silently | |

**User's choice:** Skip + prompt

---

| Option | Description | Selected |
|--------|-------------|----------|
| Category gap row + 'add a holding' prompt | Show 'X% underweight in Bonds — add a holding to get started' | ✓ |
| Setup prompt only (block plan) | Don't show plan until category is resolved | |

**User's choice:** Show category gap info without a ticker row

---

## Generation Trigger & Empty States

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-generate on page load | Dashboard fetches and renders Buy List on every visit | ✓ |
| Manual 'Generate Plan' button | User triggers generation explicitly | |
| Auto + regenerate button | Auto-load with manual override | |

**User's choice:** Auto-generate on page load

---

| Option | Description | Selected |
|--------|-------------|----------|
| Placeholder card: 'Refresh a creator...' | Clear CTA pointing to Creators tab | ✓ |
| Skeleton UI with message | Preview of Buy List layout in loading-skeleton style | |
| Hide section entirely | Don't show until data exists | |

**User's choice:** Placeholder card

---

| Option | Description | Selected |
|--------|-------------|----------|
| Always overwrite — one current plan per user | Upsert single row in buy_lists | ✓ |
| Keep history — new row each time | Append rows, most recent is current | |

**User's choice:** Always overwrite

---

| Option | Description | Selected |
|--------|-------------|----------|
| Category gap rows + banner | Show gaps without tickers, top banner to prompt setup | ✓ |
| Block plan until at least one preferred ticker set | Require setup before showing any plan | |

**User's choice:** Show category gaps + banner

---

## Contribution Calculator Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Inline on dashboard — slider above Buy List | Functional, testable before Phase 6 polish | ✓ |
| Separate 'Plan' tab | Own tab alongside Portfolio/Creators/ISA | |
| Below Blend Summary on Creators tab | Co-located with strategy data | |

**User's choice:** Inline on dashboard

---

| Option | Description | Selected |
|--------|-------------|----------|
| £50 steps | Clean snap points | |
| Free drag + numeric input | Any value, type or drag | ✓ |

**User's choice:** Free drag + numeric input

---

| Option | Description | Selected |
|--------|-------------|----------|
| DB monthly_budget as default | Slider initialises to user's saved budget | ✓ |
| Fixed £500 default | Always starts at £500 | |

**User's choice:** DB monthly_budget

---

## Claude's Discretion

- Layout and styling of Buy List table (column order, row styles) — Phase 6 redesigns this
- Exact styling of category-gap-only rows vs full buy rows
- Whether ISA warning renders as banner above table or footer below

## Deferred Ideas

- Plan history / "compare this month vs last month" — v2
- Auto-regeneration on trust-weight slider change — v2
- CSV/PDF export of Buy List — v2
