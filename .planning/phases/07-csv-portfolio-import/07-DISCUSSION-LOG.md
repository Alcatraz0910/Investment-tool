# Phase 7: CSV Portfolio Import - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 7-CSV Portfolio Import
**Areas discussed:** Import flow container, Drop zone placement, Merge behaviour, Column mapping UX

---

## Import Flow Container

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-step modal | New `ImportCSVModal` component, consistent with `HoldingModal`. Each step replaces modal body. | ✓ |
| Inline slide-down panel | Expandable accordion section within PortfolioTab. | |
| Separate page/route | `/dashboard/import` dedicated route. | |

**User's choice:** Multi-step modal

---

| Option | Description | Selected |
|--------|-------------|----------|
| Silent skip to preview | HL/AJ Bell detected → small banner → jump to preview step. | ✓ |
| Show read-only mapping | Display pre-filled mapping table before proceeding. | |

**User's choice:** Silent skip — jump straight to preview

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — step indicator at top | "Step N of M" breadcrumb in modal header. | ✓ |
| No — just a heading per step | Descriptive heading per step, no explicit numbering. | |

**User's choice:** Yes — step indicator at the top

---

## Drop Zone Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Button next to 'Add Holding' | 'Import CSV' button in Holdings header row; opens modal. | ✓ |
| Always-visible drop zone above list | Dashed panel always present on Portfolio tab. | |
| Empty-state only | Drop zone shown only when no holdings exist. | |

**User's choice:** Button next to 'Add Holding'

---

| Option | Description | Selected |
|--------|-------------|----------|
| Dashed border box with drag + click | Standard drop zone with icon and "Drag CSV here or click to browse". | ✓ |
| Just a styled file input button | No drag-and-drop, just a file picker button. | |

**User's choice:** Dashed border box with icon + 'Drag CSV here or click to browse'

---

| Option | Description | Selected |
|--------|-------------|----------|
| Reject non-.csv files only | Validate extension/MIME; show error for wrong format. | ✓ |
| Validate file size too | Reject files over N MB. | |

**User's choice:** Initially asked for PDF to also be accepted — redirected as scope creep. Decision: .csv only, with clear error for other file types. PDF noted for backlog.

---

## Merge Behaviour

| Option | Description | Selected |
|--------|-------------|----------|
| Overwrite quantity and value | CSV row replaces existing holding's qty + currentValue; isFillTicker preserved. | ✓ |
| Additive only — skip existing | Existing tickers skipped; only new tickers inserted. | |
| Sum quantities | Add CSV qty to existing qty and recalculate. | |

**User's choice:** Overwrite quantity and value (preserves isFillTicker)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Delete holdings not in CSV | Replace = wipe all user holdings, then insert CSV rows. Preview warns about deletions. | ✓ |
| Preserve holdings not in CSV | Only CSV rows written; absent holdings kept. | |

**User's choice:** Delete them (true replace semantics)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Skip bad rows, import the rest | Invalid rows shown with warning in preview; valid rows proceed. | ✓ |
| Block import until all rows valid | Require clean CSV before proceeding. | |

**User's choice:** Skip bad rows, import the rest

**Notes:** User again asked whether PDF support could be added — redirected. PDF deferred to backlog.

---

## Column Mapping UX

| Option | Description | Selected |
|--------|-------------|----------|
| Table: one row per CSV column with dropdown | Left: CSV header. Right: assign to Ticker / Quantity / Value / Category / Skip. | ✓ |
| Drag-and-drop column assignment | Visual drag from CSV headers to Pulse fields. | |

**User's choice:** Table with dropdowns

---

| Option | Description | Selected |
|--------|-------------|----------|
| Default to 'Stocks', user edits after | Unmapped rows get 'Stocks' category; user can fix via Edit modal. | ✓ |
| Require category column to be mapped | Block import without category mapping. | |
| Show a category picker in step 2 | Single dropdown for default category before preview. | |

**User's choice:** Default to 'Stocks', user can edit after import

---

| Option | Description | Selected |
|--------|-------------|----------|
| Ticker / Qty / Value (£) / Category / Status | Status = Valid / Duplicate / Invalid. GBX conversion reflected in Value. | ✓ |
| Ticker / Qty / Raw value / Converted value (£) / Status | Shows before/after GBX conversion explicitly. | |

**User's choice:** Ticker / Qty / Value (£) / Category / Status

---

## Claude's Discretion

- Exact modal sizing, backdrop, and close-on-Escape behaviour — match `HoldingModal`
- Animation for step transitions — Framer Motion slide/fade, consistent with AnimatedTabPanel
- Empty state when all preview rows are invalid — "No valid rows to import" + Back button
- Exact wording on step indicator, banner text, merge/replace toggle labels

## Deferred Ideas

- **PDF broker statement import** — user asked twice for PDF support alongside CSV. Needs dedicated extraction pipeline. Deferred to v1.2+.
- **Freetrade CSV (transaction history)** — already tracked as v1.2 SYNC-02 in REQUIREMENTS.md.
