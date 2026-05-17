---
status: complete
phase: 07-csv-portfolio-import
source: [07-VERIFICATION.md]
started: 2026-05-15
updated: 2026-05-17
---

## Pre-Test: Run Migration

Before testing, run this in the Supabase SQL editor (Dashboard → SQL Editor):

```sql
ALTER TABLE public.holdings ADD COLUMN IF NOT EXISTS name TEXT;
```

Required for HL CSV imports that include the Description column. Safe to re-run (IF NOT EXISTS).

## Tests

### 1. Full generic CSV import flow (with AI suggestions)
expected: Upload a generic .csv → "Claude analyzing…" spinner shows → column mapping dropdowns pre-filled with AI suggestions (AI badge on suggested rows) → review/adjust → Next → preview table → Merge mode → Confirm Import → spinner → modal closes → holdings updated
result: PASS — 2026-05-17

### 2. HL CSV auto-detect + broker banner
expected: Upload an HL export → broker banner shows "Hargreaves Lansdown format detected" → mapping step skipped → preview shown → confirm → DB updated correctly
result: PASS — 2026-05-17
notes: Fixed HL preset during UAT — requiredHeaders updated to ['Code', 'Units held'], nameCol to 'Stock', and getCol gained encoding fallback to handle Windows-1252 £ sign corruption.

### 3. AJ Bell auto-detect flow
expected: Upload an AJ Bell export → mapping step skipped (columns auto-filled) → preview shown → confirm import → holdings updated
result: PASS — 2026-05-17 (tested with synthetic CSV; real AJ Bell export to verify when available)

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0
