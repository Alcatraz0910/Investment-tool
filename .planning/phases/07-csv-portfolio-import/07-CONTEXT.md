# Phase 7: CSV Portfolio Import - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 7 delivers CSV bulk-import for portfolio holdings. Users can drag-and-drop or pick a CSV file, see auto-detected column mappings (HL / AJ Bell presets), review a row-level preview, choose merge or replace, and confirm import — all without leaving the Portfolio tab. Parsing is entirely client-side via PapaParse.

Phase ends when all 6 requirements (CSV-01 through CSV-06) pass:
1. Drag-and-drop or file picker on Portfolio tab opens import modal
2. HL and AJ Bell CSVs auto-detect and skip the mapping step
3. Generic CSVs show a table-based column mapping UI
4. Preview table shows parsed rows with status indicators before DB write
5. User can merge (overwrite existing tickers) or replace all holdings
6. GBX (pence) values are silently converted to £ using decimal.js

**Out of scope for Phase 7:**
- PDF broker statement parsing (noted for backlog)
- XLS/Excel format
- Freetrade CSV transaction history (aggregation logic — deferred to v1.2)
- Average cost / cost basis column (not in existing holdings schema)

</domain>

<decisions>
## Implementation Decisions

### Import Flow Container
- **D-01:** The entire import flow (Upload → Map Columns → Preview → Confirm) lives in a **multi-step modal**, consistent with the existing `HoldingModal` pattern. New component: `ImportCSVModal`.
- **D-02:** Modal shows a **step indicator** at the top (e.g. "Step 1 of 3" or "Step 2 of 3" for auto-detected brokers). Steps are: 1. Upload, 2. Map Columns (skipped for HL/AJ Bell), 3. Preview + Confirm.
- **D-03:** When HL or AJ Bell format is detected after upload, step 2 is **silently skipped** — a banner "Hargreaves Lansdown format detected" is shown momentarily, then the modal advances directly to the preview step.

### Drop Zone / Entry Point
- **D-04:** The entry point is an **"Import CSV" button** in the Holdings section header, placed next to the existing "Add Holding" button. Clicking it opens `ImportCSVModal`.
- **D-05:** Inside step 1 of the modal, a **dashed-border drop zone** with an icon and the text "Drag CSV here or click to browse" is shown. Clicking activates the native file picker.
- **D-06:** File validation before advancing: **`.csv` files only**. Non-.csv files show an inline error "Please upload a .csv file". No size limit enforced (broker exports are small).

### Merge Behaviour
- **D-07:** **Merge** = ticker-match overwrites `quantity` and `currentValue` on the existing holding. `isFillTicker` and `category` are **preserved** on matched rows (not overwritten by CSV).
- **D-08:** **Replace all** = DELETE all existing holdings for the user, then INSERT all valid CSV rows. The preview step must clearly warn: "X holding(s) not in this CSV will be removed."
- **D-09:** Invalid rows (empty ticker, non-numeric quantity/value) are **skipped silently** — shown with a warning icon in the preview table, but do not block import of valid rows.

### Column Mapping UX
- **D-10:** For generic (non-preset) CSVs, step 2 shows a **table with one row per CSV column**. Left cell: CSV column header. Right cell: dropdown — assign to Ticker / Quantity / Value / Category / Skip. Required fields (Ticker, Quantity) are flagged if left unmapped.
- **D-11:** If **no category column is present or mapped**, all imported rows default to **"Stocks"**. User can edit individual holdings after import via the existing Edit modal.
- **D-12:** The **preview table** (step 3) columns: Ticker | Qty | Value (£) | Category | Status. Status values: Valid / Duplicate (ticker exists in current portfolio) / Invalid (bad ticker or missing required field). GBX→£ conversion is already reflected in the Value column — no raw pence column needed.

### GBX Conversion (locked requirement CSV-06)
- **D-13:** GBX detection is tied to the HL preset. When HL format is detected, all value columns are divided by 100 using `decimal.js` before display in the preview. This is **silent** — no user toggle. If a user has an HL CSV with £-denominated values, they should use the generic mapper and assign the value column manually.

### Claude's Discretion
- Exact modal sizing, backdrop, and close-on-Escape behaviour — match `HoldingModal` patterns.
- Animation for step transitions — a simple slide or fade between steps (Framer Motion, consistent with AnimatedTabPanel).
- Empty-state for step 3 if all rows are invalid — show "No valid rows to import" and a Back button.
- Exact wording on the step indicator and merge/replace choice (step 3 bottom).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Requirements
- `.planning/PROJECT.md` — project goals, constraints, out-of-scope items
- `.planning/REQUIREMENTS.md` — CSV-01 through CSV-06 requirements for this phase
- `.planning/ROADMAP.md` §Phase 7 — 5 success criteria; canonical spec

### Critical Constraints
- `CLAUDE.md` — no "advice/recommend/suggest" language; `decimal.js` for ALL £ arithmetic; bare tickers only (no .L suffix stored)

### Existing Code (read before planning)
- `pulse/src/components/PortfolioTab.tsx` — existing Portfolio tab; "Import CSV" button and modal mount go here
- `pulse/src/components/HoldingModal.tsx` — modal pattern to replicate for `ImportCSVModal`
- `pulse/src/app/dashboard/actions.ts` — `addHolding`, `updateHolding`, `deleteHolding` server actions; new bulk import action needed
- `pulse/src/types/index.ts` — `Holding` and `ClientHolding` types; `AssetCategory` enum

### Prior Phase Decisions
- `.planning/phases/06-dashboard-ui/06-CONTEXT.md` — glassmorphism card style, step indicator pattern (AnimatedTabPanel), Framer Motion variants

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `HoldingModal.tsx` — multi-field modal with `useActionState`, focus management, Escape-key close, focus-return on close. `ImportCSVModal` should replicate this structure.
- `actions.ts` `addHolding` / `deleteHolding` — patterns for Supabase INSERT and DELETE with user-scoped RLS. New bulk import server action follows same shape.
- `AnimatedTabPanel.tsx` — Framer Motion step transitions; reference for animating between modal steps.

### Established Patterns
- **Server Component → Client Component boundary:** `page.tsx` (RSC) fetches holdings and passes plain objects to `PortfolioTab` (Client Component). After import, a `router.refresh()` or `revalidatePath` call is needed so the parent re-fetches updated holdings.
- **`decimal.js` for money:** All GBX→£ conversion must use `new Decimal(gbxValue).div(100)`. No native `/` on floats.
- **Glassmorphism card:** `backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl` — apply to modal overlay card.
- **PapaParse (client-side):** Must be `import`ed with `bom: true` to handle Excel-generated CSVs with BOM characters on the first column header.

### Integration Points
- `PortfolioTab.tsx` — add "Import CSV" button to the Holdings header row (alongside "Add Holding"); mount `ImportCSVModal` in the same component.
- `actions.ts` — add `importHoldings(rows, mode: 'merge' | 'replace')` server action (or split into two). Called from within `ImportCSVModal` on step 3 confirm.
- Supabase `holdings` table — merge uses `upsert` on `(user_id, ticker)`; replace uses `delete` + `insert`.

</code_context>

<specifics>
## Specific Ideas

- Drop zone: dashed border, icon, "Drag CSV here or click to browse" — minimalist, matches glassmorphism palette
- Step indicator at modal top: "Step 1 of 3" / "Step 2 of 3" / "Step 3 of 3"
- HL detection banner: small inline note "Hargreaves Lansdown format detected" before auto-advancing to preview
- Preview status column: green "Valid", amber "Duplicate", red "Invalid" — clear at a glance
- Merge/Replace toggle lives in step 3 (preview), not as a separate step — user sees what they're about to do before picking the mode

</specifics>

<deferred>
## Deferred Ideas

- **PDF broker statement import** — user requested support for PDF files alongside CSV. PDF parsing requires a dedicated extraction pipeline (PDF.js or server-side) with broker-specific layout handling. Belongs in its own phase (v1.2+).
- **Freetrade CSV (transaction history)** — already in REQUIREMENTS.md as v1.2 SYNC-02. Requires aggregation logic to compute current holdings from transaction rows.

</deferred>

---

*Phase: 7-CSV Portfolio Import*
*Context gathered: 2026-05-13*
