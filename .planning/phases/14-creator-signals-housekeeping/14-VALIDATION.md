---
phase: 14
slug: creator-signals-housekeeping
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-20
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (`tsc --noEmit`) — primary automated gate |
| **Config file** | `pulse/tsconfig.json` |
| **Quick run command** | `cd pulse && npx tsc --noEmit` |
| **Full suite command** | `cd pulse && npx tsc --noEmit` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd pulse && npx tsc --noEmit`
- **After every plan wave:** Run `cd pulse && npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green (exits 0)
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 0 | Housekeeping | TS errors do not re-introduce unsafe type casts | automated | `cd pulse && npx tsc --noEmit` | ✅ | ⬜ pending |
| 14-02-01 | 02 | 1 | SIG-03 | `contradiction.ts` no-advice language (deterministic strings, no Claude) | automated | `cd pulse && npx tsc --noEmit` | ✅ | ⬜ pending |
| 14-02-02 | 02 | 1 | SIG-02 | Sentiment badge logic compiles; no float arithmetic | automated | `cd pulse && npx tsc --noEmit` | ✅ | ⬜ pending |
| 14-03-01 | 03 | 2 | SIG-01 | Consensus chip renders for creators.length ≥ 2 | smoke (visual) | `cd pulse && npx tsc --noEmit` | ✅ | ⬜ pending |
| 14-03-02 | 03 | 2 | SIG-02 | Sentiment badge shows correctly on creator cards | smoke (visual) | `cd pulse && npx tsc --noEmit` | ✅ | ⬜ pending |
| 14-03-03 | 03 | 2 | SIG-03 | Contradiction badge + tooltip renders | smoke (visual) | `cd pulse && npx tsc --noEmit` | ✅ | ⬜ pending |
| 14-03-04 | 03 | 2 | SIG-04 | Cadence badge + 80% opacity when profile_latest null | smoke (visual) | `cd pulse && npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `cd pulse && npx tsc --noEmit` passes for `creator-actions.ts` (TS2353/TS2339 fixed)

*No new test files needed — signals are pure UI derivations; contradiction logic is deterministic and verifiable by inspection. TS compiler is the primary automated gate.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Consensus chip visible on tickers backed by 2+ creators | SIG-01 | Visual rendering; no test runner | Open Watch List tab with 2 creators tracking the same ticker; confirm "Consensus" chip appears |
| Sentiment badge correct for drift | SIG-02 | Requires real or mock profile data | Ensure creator has sector_focus in both stable/latest with stance drift; confirm badge label and colour |
| Contradiction badge + hover tooltip | SIG-03 | Hover interaction | Ensure creator has a ticker in stable high conviction missing from latest; hover badge; confirm reason text |
| Cadence badge + 80% opacity | SIG-04 | Visual; requires profile_latest = null | Track a creator with no 30-day chunks; confirm badge and opacity |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
