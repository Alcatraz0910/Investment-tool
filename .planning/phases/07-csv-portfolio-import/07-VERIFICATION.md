---
phase: 07-csv-portfolio-import
verified: 2026-05-15T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Full import flow — generic CSV"
    expected: |
      1. 'Import CSV' button visible in Holdings header next to 'Add Holding'.
      2. Click opens modal at Step 1 of 3 with drop zone.
      3. Drag a non-.csv file — error 'Please upload a .csv file' appears inline.
      4. Drag a generic .csv — advances to 'Map Columns' (Step 2 of 3).
      5. Leave Ticker unmapped, click Next — error 'Ticker and Quantity columns are required'.
      6. Map Ticker + Quantity, click Next — 'Review Import' (Step 3 of 3) with preview table.
      7. Toggle 'Replace all' — amber banner appears with count of holdings to be removed.
      8. Toggle back to 'Merge' — amber banner disappears.
      9. Click 'Confirm Import' — button shows 'Importing…', modal closes on success, holdings update without page reload.
      10. Press Escape — modal closes, focus returns to 'Import CSV' button.
    why_human: Requires live Supabase instance (ENOTFOUND in dev) and browser interaction. Supabase round-trip for merge/replace DB writes cannot be verified statically.
  - test: "HL CSV auto-detect flow"
    expected: |
      Upload a CSV with headers 'Stock', 'Units Held', 'Value (p)'.
      Green banner 'Hargreaves Lansdown format detected' appears on Step 1.
      Modal auto-advances to Step 2 of 2 (Preview) after ~1.5s without showing mapping UI.
      Value column shows £ amounts (e.g. 198.00 for 19800p), not raw pence.
    why_human: Requires browser and a real HL-format CSV file. GBX conversion is verified statically (decimal.js path confirmed) but the rendered £ value in the preview table must be confirmed visually.
  - test: "AJ Bell auto-detect flow"
    expected: |
      Upload a CSV with headers 'Ticker/ISIN', 'Quantity', 'Market value'.
      Green banner 'AJ Bell format detected' appears.
      Modal auto-advances to preview, gbx=false so values are used as-is.
    why_human: Requires browser and an AJ Bell-format CSV file.
---

# Phase 7: CSV Portfolio Import — Verification Report

**Phase Goal:** Users can populate or update their portfolio holdings by uploading a broker CSV, eliminating manual row-by-row entry.
**Verified:** 2026-05-15T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can drag a CSV file onto the Portfolio page (or use file picker) and see a column-mapping UI appear | VERIFIED | `ImportCSVModal.tsx` lines 159–165 (handleDrop), 289–329 (drop zone div with onDrop/onDragOver), 323–329 (hidden file input). Step 2 column mapping table renders at lines 363–423 when `detectedBroker === null`. |
| 2 | When uploading an HL or AJ Bell export, column headers are pre-filled without manual mapping | VERIFIED | `parser.ts` BROKER_PRESETS registry (lines 17–33) with `requiredHeaders`. `detectBroker()` returns matching preset. `ImportCSVModal.tsx` processFile() (lines 112–156): when broker detected, `totalSteps` set to 2 and preview built directly from preset column names — column mapping step skipped entirely. |
| 3 | User can review a preview table of parsed rows before any data is written to the database | VERIFIED | `ImportCSVModal.tsx` lines 425–548: preview step renders table with Ticker/Qty/Value(£)/Category/Status columns. `handleConfirm()` (lines 191–203) is the only code path that calls `importHoldings` — preview is always shown first. |
| 4 | User can choose to merge new rows into existing holdings or replace all holdings, then confirm import | VERIFIED | `ImportCSVModal.tsx` lines 487–507: Merge/Replace toggle buttons with `mergeMode` state. Lines 510–514: amber warning banner when `mergeMode === 'replace'`. `handleConfirm()` passes `mergeMode` to `importHoldings`. `actions.ts` lines 115–175: replace branch DELETEs then INSERTs; merge branch SELECTs existing, UPDATEs matched, INSERTs new. |
| 5 | GBX-denominated prices (HL pence exports) are silently converted to £ so portfolio values are correct after import | VERIFIED | `parser.ts` lines 96–98: `convertGbxToGbp` uses `new Decimal(gbxStr.trim()).div(100).toFixed(2)` — no native float division (confirmed: zero `/ 100` matches in parser.ts). `parseRows()` line 147 applies conversion when `mapping.gbx === true`. HL BROKER_PRESET has `gbx: true`. `ImportCSVModal.tsx` processFile() constructs mapping from broker preset including `gbx: broker.gbx`. Preview renders `£{row.value}` — the already-converted value. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pulse/src/lib/csv/parser.ts` | Pure CSV utility: detectBroker, sanitiseTicker, convertGbxToGbp, classifyRow, parseRows | VERIFIED | 156 lines, all 5 functions exported, uses decimal.js, no 'use client'/'use server' directive |
| `pulse/src/lib/csv/__tests__/parser.test.ts` | Unit tests covering all 4 describe blocks | VERIFIED | File exists at expected path |
| `pulse/src/app/dashboard/actions.ts` | importHoldings server action with ImportRow/ImportResult types | VERIFIED | importHoldings at line 103; ImportRow at line 83; ImportResult at line 90; revalidatePath('/dashboard') at line 177 |
| `pulse/src/app/dashboard/__tests__/import-actions.test.ts` | Auth-guard unit tests (3 cases) | VERIFIED | File exists at expected path |
| `pulse/src/components/ImportCSVModal.tsx` | Multi-step modal: upload, column mapping, preview+confirm | VERIFIED | 555 lines, all 3 steps implemented, all acceptance criteria strings present |
| `pulse/src/components/PortfolioTab.tsx` | ImportCSVModal wired, 'Import CSV' button present | VERIFIED | Line 5: import; line 37: importModalOpen state; lines 161–167: 'Import CSV' button; lines 277–282: modal mount with existingTickers |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `PortfolioTab.tsx` | `ImportCSVModal` | import + conditional render | WIRED | Line 5 imports; lines 277–282 mount with `existingTickers={new Set(holdings.map(h => h.ticker))}` |
| `ImportCSVModal.tsx` | `importHoldings` | useTransition + handleConfirm | WIRED | Line 12 imports from actions; line 196 `await importHoldings(importRows, mergeMode)` inside `startTransition` |
| `ImportCSVModal.tsx` | `detectBroker` / `parseRows` | import from parser.ts | WIRED | Lines 6–11 import; detectBroker called line 133, parseRows called via buildPreview line 107 |
| `ImportCSVModal.tsx` | PapaParse | `bom: true`, `dynamicTyping: false`, `skipEmptyLines: true` | WIRED | Lines 123–128; BOM handling confirmed to prevent header corruption |
| `importHoldings` | Supabase holdings table | merge: SELECT+UPDATE+INSERT; replace: DELETE+INSERT | WIRED | Actions.ts lines 115–175; DELETE scoped `.eq('user_id', user.id)` |
| `convertGbxToGbp` | decimal.js | `new Decimal().div(100)` | WIRED | parser.ts line 97; zero native `/` float division confirmed |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ImportCSVModal.tsx` preview table | `previewRows` | `parseRows(rawRows, mapping, existingTickers)` called via `buildPreview()` | Yes — populated from PapaParse output of the uploaded CSV | FLOWING |
| `importHoldings` (merge) | `existing` | `supabase.from('holdings').select('id, ticker').eq('user_id', user.id)` | Yes — real DB query; return value used to build `existingMap` | FLOWING (requires live Supabase for runtime verification) |
| `importHoldings` (replace) | DELETE + INSERT | `supabase.from('holdings').delete().eq('user_id', user.id)` then bulk insert | Yes — parameterised queries; no static returns | FLOWING (requires live Supabase for runtime verification) |

### Behavioral Spot-Checks

Step 7b: SKIPPED for Supabase-dependent flows (live DB required). Static checks below substitute where possible.

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| `convertGbxToGbp('19800')` returns '198.00' | Code trace: `new Decimal('19800').div(100).toFixed(2)` | '198.00' | PASS (static trace) |
| `detectBroker(['Stock', 'Units Held'])` returns HL preset | BROKER_PRESETS[0].requiredHeaders matches | Returns HL preset, gbx:true | PASS (static trace) |
| `sanitiseTicker('LLOY.L')` returns 'LLOY' | `.replace(/\.L$/, '')` anchored regex | 'LLOY' | PASS (static trace) |
| No native float division in GBX path | `grep '/ 100' parser.ts` | 0 matches | PASS |
| Forbidden words in modal | `grep -i 'advice\|recommend\|suggest' ImportCSVModal.tsx` | 0 matches | PASS |
| isFillTicker absent from UPDATE payload | grep isFillTicker in actions.ts | 1 match — in comment only, not in update object | PASS |
| DB round-trip (merge mode) | Requires live Supabase | Not tested | SKIP |
| DB round-trip (replace mode) | Requires live Supabase | Not tested | SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CSV-01 | 07-03, 07-04 | Drag-and-drop or file picker on Portfolio page | SATISFIED | Drop zone in ImportCSVModal.tsx; 'Import CSV' button in PortfolioTab.tsx wires it to the page |
| CSV-02 | 07-03 | Column mapping UI (ticker, quantity, average cost) | SATISFIED | Step 2 mapping table with Ticker*/Quantity*/Value(£)/Category/Skip dropdowns |
| CSV-03 | 07-01, 07-03 | Auto-detect HL and AJ Bell before falling back to manual mapping | SATISFIED | detectBroker() + BROKER_PRESETS; auto-detected brokers skip step 2 entirely |
| CSV-04 | 07-03 | Preview of parsed holdings rows before confirming | SATISFIED | Step 3 preview table with status indicators (valid/duplicate/invalid) |
| CSV-05 | 07-02, 07-03 | Merge or replace existing holdings | SATISFIED | mergeMode state + toggle; importHoldings merge/replace branches |
| CSV-06 | 07-01, 07-03 | GBX (pence) auto-converted to £ using decimal.js | SATISFIED | convertGbxToGbp uses new Decimal().div(100); HL preset gbx:true; no native float division |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ImportCSVModal.tsx` | 123 | `eslint-disable @typescript-eslint/no-explicit-any` cast on PapaParse config | Info | Required workaround: @types/papaparse omits `bom` from ParseLocalConfig. The `any` cast is scoped to the config object only; the Papa.parse call remains typed. Not a stub — bom:true is a valid runtime option confirmed working. |

No blockers. No stubs. No forbidden words. No `return null` / empty placeholders.

### Human Verification Required

#### 1. Full import flow — generic CSV

**Test:** In a browser with Supabase accessible, navigate to Dashboard > Portfolio tab.

1. Confirm 'Import CSV' button is visible in the Holdings header, next to 'Add Holding'.
2. Click it — modal opens at Step 1 of 3 with the drop zone.
3. Drag a non-.csv file — inline error 'Please upload a .csv file' appears.
4. Drag/browse a generic .csv (e.g., Symbol,Shares,Price) — advances to 'Map Columns' (Step 2 of 3).
5. Leave Ticker unmapped, click Next — error 'Ticker and Quantity columns are required'.
6. Map Ticker and Quantity, click Next — 'Review Import' (Step 3 of 3) with preview table (Ticker/Qty/Value(£)/Category/Status).
7. Toggle 'Replace all' — amber banner appears: "N holding(s) not in this CSV will be removed from your portfolio."
8. Toggle back to 'Merge' — amber banner disappears.
9. Click 'Confirm Import' — button shows 'Importing…', modal closes on success, holdings list refreshes without page reload.
10. Press Escape — modal closes; focus returns to 'Import CSV' button.

**Expected:** All 10 steps succeed.
**Why human:** Requires live Supabase instance (ENOTFOUND in dev environment) and real browser interaction.

#### 2. HL CSV auto-detect + GBX conversion

**Test:** Upload a CSV with headers: `Stock,Units Held,Value (p),Cost` and at least one data row where Value (p) is a pence value (e.g., 19800).

**Expected:**
- Green banner 'Hargreaves Lansdown format detected' appears on Step 1.
- Modal auto-advances to Step 2 of 2 (Preview) after ~1.5s — column mapping step NOT shown.
- Value column in preview shows £198.00 (not 19800).
- Import completes via Confirm Import button.

**Why human:** Requires browser, an HL-format CSV file, and live Supabase. GBX division path is confirmed correct statically but the rendered output in the preview table requires visual confirmation.

#### 3. AJ Bell auto-detect

**Test:** Upload a CSV with headers: `Ticker/ISIN,Quantity,Market value,Description`.

**Expected:**
- Green banner 'AJ Bell format detected' appears.
- Modal auto-advances to preview (no mapping step). Values used as-is (gbx:false).

**Why human:** Requires browser and an AJ Bell-format CSV file.

### Gaps Summary

No gaps. All 5 success criteria are verifiable from static analysis. All 6 requirements are satisfied by implemented code. The only unresolved items are live-environment smoke tests that require a running Supabase instance and browser — these are routed to human verification per the phase instructions.

---

_Verified: 2026-05-15T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
