---
status: partial
phase: 07-csv-portfolio-import
source: [07-VERIFICATION.md]
started: 2026-05-15
updated: 2026-05-15
---

## Pre-Test: Run Migration

Before testing, run this in the Supabase SQL editor (Dashboard → SQL Editor):

```sql
ALTER TABLE public.holdings ADD COLUMN IF NOT EXISTS name TEXT;
```

Required for HL CSV imports that include the Description column. Safe to re-run (IF NOT EXISTS).

## Current Test

[awaiting human testing — requires live Supabase connection]

## Tests

### 1. Full generic CSV import flow (with AI suggestions)
expected: Upload a generic .csv → "Claude analyzing…" spinner shows → column mapping dropdowns pre-filled with AI suggestions (AI badge on suggested rows) → review/adjust → Next → preview table → Merge mode → Confirm Import → spinner → modal closes → holdings updated
result: [pending]

### 2. HL CSV auto-detect + GBX preview rendering
expected: Upload an HL export (headers: Stock, Units Held, Value (p)) → broker banner shows "Hargreaves Lansdown detected" → mapping step skipped → preview shows £-denominated values (e.g. 19800p displays as £198.00) → confirm → DB updated correctly
result: [pending]

### 3. AJ Bell auto-detect flow
expected: Upload an AJ Bell export → mapping step skipped (columns auto-filled) → preview shown → confirm import → holdings updated
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

All gaps are environment-only — code fully implemented. Blocked by Supabase ENOTFOUND in dev environment.
