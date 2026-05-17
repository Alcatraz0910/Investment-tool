---
phase: 8
slug: live-price-data
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-17
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 + jsdom |
| **Config file** | `pulse/vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` (from `pulse/`) |
| **Full suite command** | `npx vitest run` (from `pulse/`) |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 8-01-01 | 01 | 1 | PRICE-01 | — | N/A | unit | `npx vitest run src/app/dashboard/__tests__/price-actions.test.ts` | ❌ Wave 0 | ⬜ pending |
| 8-01-02 | 01 | 1 | PRICE-03 | — | N/A | unit | `npx vitest run src/app/dashboard/__tests__/price-actions.test.ts` | ❌ Wave 0 | ⬜ pending |
| 8-02-01 | 02 | 2 | PRICE-01 | — | N/A | unit | `npx vitest run src/__tests__/PortfolioTab.test.tsx` | ❌ Wave 0 | ⬜ pending |
| 8-02-02 | 02 | 2 | PRICE-04 | — | N/A | unit | `npx vitest run src/__tests__/TradingViewWidget.test.tsx` | ❌ Wave 0 | ⬜ pending |
| 8-03-01 | 03 | 2 | PRICE-02 | — | N/A | unit | `npx vitest run src/__tests__/BuyListTable.test.tsx` | ✅ (extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `pulse/src/__tests__/PortfolioTab.test.tsx` — covers PRICE-01 (price column display, staleness amber color, `—` dash for null)
- [ ] `pulse/src/app/dashboard/__tests__/price-actions.test.ts` — covers PRICE-03 (mock yahooFinance, partial failure isolation, GBp/GBP currency check)
- [ ] `pulse/src/__tests__/TradingViewWidget.test.tsx` — covers PRICE-04 (script tag injection, correct `LSE:{TICKER}` symbol format, double-mount prevention)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Refresh Prices button triggers fetch and updates UI without full page reload | PRICE-03 | Requires real Supabase connection and network call to Yahoo Finance | Click Refresh Prices on Portfolio tab; confirm price columns populate and timestamp updates |
| TradingView chart expands/collapses per holding row | PRICE-04 | Requires browser rendering of injected TradingView iframe | Click chart icon on a holding row; confirm iframe expands; click again to collapse |
| Staleness amber coloring at 24h threshold | PRICE-07 | Requires DB timestamp manipulation | Manually set `price_fetched_at` to 25 hours ago in Supabase SQL Editor; refresh page; confirm timestamp turns amber |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
