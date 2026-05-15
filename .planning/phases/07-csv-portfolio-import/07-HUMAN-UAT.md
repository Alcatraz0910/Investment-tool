---
status: partial
phase: 07-csv-portfolio-import
source: [07-VERIFICATION.md]
started: 2026-05-15
updated: 2026-05-15
---

## Current Test

[awaiting human testing — requires live Supabase connection]

## Tests

### 1. Full generic CSV import flow
expected: Upload a generic .csv → map Ticker + Quantity columns → see preview table → select Merge mode → Confirm Import → spinner shows → modal closes → holdings table updates with imported rows → focus returns to "Import CSV" button
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
