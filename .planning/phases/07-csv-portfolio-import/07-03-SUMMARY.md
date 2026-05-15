---
plan: "07-03"
status: complete
completed: 2026-05-15
---

# Summary: ImportCSVModal Component

## What was built

A multi-step modal component (`ImportCSVModal.tsx`) implementing the full CSV import flow: drag-and-drop upload with auto-broker detection (HL/AJ Bell skip mapping step), column mapping UI for generic CSVs, and a preview table with merge/replace mode and confirmation via `importHoldings`. All Framer Motion animations, PapaParse BOM handling, focus trap, and forbidden-word constraints applied.

## Tasks completed

- Task 1: Modal shell + step indicator + step 1 upload drop zone — PapaParse with `bom: true`/`dynamicTyping: false`/`skipEmptyLines: true`, auto-detect banner (1.5s then advance), Escape close, focus return to trigger
- Task 2: Step 2 column mapping table — one row per CSV header, Ticker*/Quantity* required validation, error message on missing required fields
- Task 3: Step 3 preview table — row status indicators (valid/duplicate/invalid), merge/replace toggle with tooltips, replace-all amber warning banner, `importHoldings` called via `useTransition`, loading state "Importing…", empty-state when all rows invalid

## Files created/modified

- `pulse/src/components/ImportCSVModal.tsx`: new 355-line component covering all 3 steps

## Issues encountered

- `@types/papaparse` omits `bom` from `ParseLocalConfig` type — bypassed with `eslint-disable any` cast on the config object (Rule 1 auto-fix: type error blocking Task 1 completion)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PapaParse `bom` option missing from @types/papaparse**
- **Found during:** Task 1
- **Issue:** `bom: true` is a valid PapaParse runtime option but absent from `ParseLocalConfig` TypeScript types, causing `TS2769: No overload matches this call`
- **Fix:** Extracted config object typed as `any` with eslint-disable comment; `Papa.parse<Record<string, string>>(selectedFile, parseConfig)` call remains typed
- **Files modified:** `pulse/src/components/ImportCSVModal.tsx`
- **Commit:** fad92c6

## Acceptance criteria met

- `bom: true` present (1 match)
- `dynamicTyping: false` present (1 match)
- `skipEmptyLines: true` present (1 match)
- Framer Motion imported from `'framer-motion'` only (0 matches for `'motion/react'`)
- `useTransition` used (2 occurrences: import + usage)
- `useActionState` absent (0 matches)
- "Drag CSV here or click to browse" present (1 match)
- "Hargreaves Lansdown format detected" present (1 match)
- "AJ Bell format detected" present (1 match)
- "Assign CSV columns" present (1 match)
- "Ticker and Quantity columns are required" present (1 match)
- "* Required" present (1 match)
- "No valid rows to import" present (1 match)
- "Review Import" present as modal title (1 match)
- "Confirm Import" present (2 matches: button text + loading branch)
- "Importing…" present (1 match)
- "will be removed from your portfolio" present (1 match)
- "Updates existing tickers" present in tooltip (1 match)
- `importHoldings` called (2 matches: import + usage)
- Forbidden words (advice/recommend/suggest/financial guidance): 0 matches
- TypeScript: 0 errors in ImportCSVModal
