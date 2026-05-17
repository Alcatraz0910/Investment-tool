---
status: partial
phase: 08-live-price-data
source: [08-VERIFICATION.md]
started: 2026-05-17T00:00:00.000Z
updated: 2026-05-17T00:00:00.000Z
---

## Current Test

Awaiting human testing — run the app with the SQL migration applied.

**Pre-requisite:** Run the migration in Supabase SQL Editor before testing:
```sql
ALTER TABLE public.holdings
  ADD COLUMN IF NOT EXISTS current_price NUMERIC,
  ADD COLUMN IF NOT EXISTS price_fetched_at TIMESTAMPTZ;
```

## Tests

### 1. Refresh Prices updates Portfolio tab
expected: Click "Refresh Prices" on Portfolio tab — spinner appears, prices populate in the Price column, As-of timestamps appear. Stale prices (>24h) show in amber.
result: [pending]

### 2. Buy List Refresh Prices shows current ticker prices
expected: Generate a buy list, click "Refresh Prices" above it — Price column populates with £-formatted prices for each ticker in the list. Prices are ephemeral (don't persist on page reload).
result: [pending]

### 3. TradingView chart toggle per holding
expected: Click the chart icon on a holding row — an animated TradingView chart expands below it. Clicking again collapses it. Only one chart open at a time.
result: [pending]

### 4. Error handling — network failure
expected: With network disconnected, click Refresh Prices — error message appears with role="alert" styling (red text), no crash.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
