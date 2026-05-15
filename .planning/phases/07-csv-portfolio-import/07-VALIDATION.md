---
phase: 7
slug: csv-portfolio-import
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-15
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.x (already configured in pulse/) |
| **Config file** | `pulse/jest.config.js` (existing) |
| **Quick run command** | `cd pulse && npx jest src/lib/csv --no-coverage` |
| **Full suite command** | `cd pulse && npx jest --no-coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd pulse && npx jest src/lib/csv --no-coverage`
- **After every plan wave:** Run `cd pulse && npx jest --no-coverage`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|--------|
| 7-01-01 | 01 | 1 | CSV-03 | detectBroker returns correct preset for HL headers | unit | `npx jest src/lib/csv/parser` | ⬜ pending |
| 7-01-02 | 01 | 1 | CSV-03 | detectBroker returns null for unknown headers | unit | `npx jest src/lib/csv/parser` | ⬜ pending |
| 7-01-03 | 01 | 1 | CSV-06 | GBX→£: new Decimal('19800').div(100) = '198.00' | unit | `npx jest src/lib/csv/parser` | ⬜ pending |
| 7-01-04 | 01 | 1 | CLAUDE.md | sanitiseTicker strips .L suffix | unit | `npx jest src/lib/csv/parser` | ⬜ pending |
| 7-01-05 | 01 | 1 | CSV-04 | classifyRow: empty ticker → 'invalid' | unit | `npx jest src/lib/csv/parser` | ⬜ pending |
| 7-01-06 | 01 | 1 | CSV-04 | classifyRow: existing ticker → 'duplicate' | unit | `npx jest src/lib/csv/parser` | ⬜ pending |
| 7-02-01 | 02 | 1 | CSV-05 | importHoldings replace: unauthenticated → error | unit | `npx jest src/app/dashboard/actions` | ⬜ pending |
| 7-02-02 | 02 | 1 | CSV-05 | importHoldings: 0 valid rows → error | unit | `npx jest src/app/dashboard/actions` | ⬜ pending |
| 7-03-01 | 03 | 2 | CSV-01 | ImportCSVModal compiles without TS errors | compile | `npx tsc --noEmit 2>&1 \| grep ImportCSVModal → 0` | ⬜ pending |
| 7-04-01 | 04 | 2 | CSV-01 | PortfolioTab renders Import CSV button | unit | `npx jest src/components/PortfolioTab` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `pulse/src/lib/csv/__tests__/parser.test.ts` — unit tests for parser utilities (CSV-03, CSV-04, CSV-06) — created in Plan 07-01 Task 2

*Note: ImportCSVModal verification uses TypeScript compilation + grep acceptance_criteria (no render test — Jest DOM setup not confirmed in this project). Existing Jest infrastructure in pulse/ covers parser and action tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag `.csv` file onto drop zone opens import modal | CSV-01 | Requires browser drag-and-drop interaction | Open Portfolio tab, drag a .csv file onto the drop zone |
| Non-.csv drag shows inline error | CSV-01 | Browser file API | Drag a .png file — expect "Please upload a .csv file" |
| HL CSV auto-detects and shows broker banner | CSV-03 | Requires real HL export or mock file | Upload an HL-format CSV — expect "Hargreaves Lansdown format detected" banner |
| Generic CSV shows column mapping table | CSV-02 | Visual UI interaction | Upload an unrecognised CSV — expect column mapping step |
| Preview table shows Valid/Duplicate/Invalid with colours | CSV-04 | Visual colour check | Upload CSV with mix of new/existing/invalid tickers |
| Replace warning shows count of non-CSV holdings | CSV-05 | Requires live holdings in DB | Upload CSV with fewer holdings than DB contains |
| Merge preserves isFillTicker on matched ticker | D-07 | Requires DB state check | Import CSV for existing fill ticker; verify isFillTicker unchanged |
| Portfolio refreshes after import (no page reload) | revalidatePath | RSC revalidation | Confirm holdings list updates after confirming import |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or manual test instructions
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all parser test stubs
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
