---
phase: 12
slug: watch-list-per-creator-budget
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-19
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `pulse/vitest.config.ts` |
| **Quick run command** | `cd pulse && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd pulse && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd pulse && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd pulse && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 0 | WL-03 | — | N/A | unit | `cd pulse && npx vitest run tests/watch-budget.test.ts` | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 1 | WL-01 | — | N/A | unit | `cd pulse && npx vitest run tests/watchlist-generator.test.ts` | ❌ W0 | ⬜ pending |
| 12-02-02 | 02 | 1 | WL-04 | — | decimal.js used for £ qty calc | unit | `cd pulse && npx vitest run tests/watchlist-generator.test.ts` | ❌ W0 | ⬜ pending |
| 12-03-01 | 03 | 2 | WL-02 | — | N/A | unit | `cd pulse && npx vitest run tests/watch-actions.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `pulse/tests/watch-budget.test.ts` — stubs for WL-03 (monthly budget CRUD)
- [ ] `pulse/tests/watchlist-generator.test.ts` — stubs for WL-01, WL-04 (pick extraction, quantity calculation)
- [ ] `pulse/tests/watch-actions.test.ts` — stubs for WL-02 (price-enriched watch list server action)

*Existing vitest infrastructure covers all phase requirements — no new framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Watch list tab renders picks with live prices | WL-02 | Requires live Supabase + yahoo-finance2 network call | Open dashboard, navigate to Watch List tab, confirm prices shown |
| Budget input persists per creator | WL-03 | Requires live Supabase write | Set £500/month for a creator, refresh, confirm value retained |
| ISA tab is no longer visible | WL-05 | Requires browser DOM inspection | Open dashboard, confirm ISA tab is absent from tab bar |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
