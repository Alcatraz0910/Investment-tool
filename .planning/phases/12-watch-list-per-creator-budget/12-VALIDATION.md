---
phase: 12
slug: watch-list-per-creator-budget
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-21
---

# Phase 12 — Validation Strategy

> Per-phase validation contract. Reconstructed 2026-05-21 from PLAN and SUMMARY artifacts (no VALIDATION.md existed at execution time).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest v4.1.5 |
| **Config file** | `pulse/vitest.config.ts` |
| **Quick run command** | `cd pulse && npx vitest run tests/watch-budget.test.ts tests/watchlist-generator.test.ts tests/watch-actions.test.ts` |
| **Full suite command** | `cd pulse && npx vitest run` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run Phase 12 quick run command
- **After every plan wave:** Run full suite
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 0 | WL-03 | T-12-01 | SQL migration additive-only (ADD COLUMN IF NOT EXISTS) | human | SQL Editor run | N/A | ✅ green |
| 12-01-02 | 01 | 0 | WL-01, WL-04 | — | N/A | stub | `cd pulse && npx vitest run tests/watchlist-generator.test.ts` | ✅ exists | ✅ green |
| 12-01-03 | 01 | 0 | WL-03 | — | N/A | stub | `cd pulse && npx vitest run tests/watch-budget.test.ts` | ✅ exists | ✅ green |
| 12-01-04 | 01 | 0 | WL-02 | — | N/A | stub | `cd pulse && npx vitest run tests/watch-actions.test.ts` | ✅ exists | ✅ green |
| 12-02-01 | 02 | 1 | WL-01, WL-04 | T-12-04 | buildWatchLists filters null tickers before yahoo-finance2 | unit | `cd pulse && npx vitest run tests/watchlist-generator.test.ts` | ✅ exists | ✅ green |
| 12-02-02 | 02 | 1 | WL-03 | T-12-02, T-12-03 | saveCreatorMonthlyBudget: range validation + IDOR ownership check (user_id) | unit | `cd pulse && npx vitest run tests/watch-budget.test.ts` | ✅ exists | ✅ green |
| 12-03-01 | 03 | 2 | WL-02 | T-12-06 | fetchTickerPrices: ticker validation via TICKER_RE; prices in GBP | unit | `cd pulse && npx vitest run tests/watch-actions.test.ts` | ✅ exists | ✅ green |
| 12-03-02 | 03 | 2 | WL-01, WL-02, WL-03, WL-04 | T-12-07, T-12-08 | WatchListTab: no dangerouslySetInnerHTML; no advice language; IDOR via server-built map | tsc | `cd pulse && npx tsc --noEmit` | ✅ existing | ✅ green |
| 12-03-03 | 03 | 2 | WL-05 | — | ISA tab removed; no isa_contributions query | structural | `cd pulse && npx vitest run tests/watch-actions.test.ts` | ✅ exists | ✅ green |
| 12-03-04 | 03 | 2 | WL-01–05 | — | Full vitest suite green | unit | `cd pulse && npx vitest run` | ✅ existing | ✅ green |
| 12-03-05 | 03 | 2 | WL-01–04 | — | Visual render + browser flows | visual | see Manual-Only below | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

Test stubs created in Plan 01:
- [x] `pulse/tests/watch-budget.test.ts` — stubs for WL-03
- [x] `pulse/tests/watchlist-generator.test.ts` — stubs for WL-01 + WL-04
- [x] `pulse/tests/watch-actions.test.ts` — stubs for WL-02

All three files existed before Wave 1 implementation. All stubs were filled and green.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| WatchListTab renders per-creator cards with Established/This Month layer pills | WL-01 | Visual rendering; requires live profile data | Open `/dashboard`, click Watch List tab; confirm creator cards appear with layer pill badges if profiles exist |
| Refresh Prices button populates Price, Qty, Spend columns | WL-02 | Live yahoo-finance2 call; requires real tickers in DB | Click "Refresh Prices"; confirm spinner then price/qty/spend columns populate |
| Budget edit flow: Edit → enter value → Save Budget → display updates | WL-03 | Interactive UI flow; requires browser and DB | Click Edit, enter 500, click Save Budget; confirm display shows £500 / month on reload |
| ISA tab absent from tab bar | WL-05 | Visual/structural | Tab bar must show only Portfolio · Creators · Watch List — ISA absent |

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** retroactive 2026-05-21 — 24/24 automated tests green; 4 visual/browser items documented as manual-only

---

## Validation Audit 2026-05-21

| Metric | Count |
|--------|-------|
| Gaps found | 1 (WL-05 had no automated test) |
| Resolved (automated) | 24 tests across 3 files (3 new WL-05 structural tests added to watch-actions.test.ts) |
| Escalated to manual-only | 4 (visual render, live prices, budget save flow, ISA tab visual check) |
| New test files created | 0 (all existed from execution) |
