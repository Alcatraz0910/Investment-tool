---
phase: 4
slug: strategy-extraction-blending
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-07
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (not yet installed — Wave 0 installs) |
| **Config file** | `pulse/vitest.config.ts` — Wave 0 creates |
| **Quick run command** | `cd pulse && npx vitest run` |
| **Full suite command** | `cd pulse && npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd pulse && npx vitest run`
- **After every plan wave:** Run `cd pulse && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 0 | — | — | N/A | infra | `cd pulse && npx vitest run` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | STRAT-01 | T-04-01 | API key never in client bundle | unit | `cd pulse && npx vitest run src/lib/strategy/extractor.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | STRAT-02 | — | N/A | unit | `cd pulse && npx vitest run src/lib/strategy/extractor.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 1 | STRAT-03 | — | N/A | unit | `cd pulse && npx vitest run src/lib/strategy/extractor.test.ts` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 1 | STRAT-04 | — | N/A | unit | `cd pulse && npx vitest run src/lib/strategy/contradiction.test.ts` | ❌ W0 | ⬜ pending |
| 04-04-01 | 04 | 2 | BLEND-01 | T-04-02 | Ownership check before weight update | integration | `cd pulse && npx vitest run src/app/dashboard/actions.test.ts` | ❌ W0 | ⬜ pending |
| 04-05-01 | 05 | 2 | BLEND-02 | — | N/A | unit | `cd pulse && npx vitest run src/lib/strategy/blender.test.ts` | ❌ W0 | ⬜ pending |
| 04-05-02 | 05 | 2 | BLEND-03 | — | N/A | unit | `cd pulse && npx vitest run src/lib/strategy/blender.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `pulse/vitest.config.ts` — framework config (install: `cd pulse && npm install -D vitest @vitest/ui`)
- [ ] `pulse/src/lib/strategy/contradiction.test.ts` — stubs for STRAT-04 (pure function, no mocks needed)
- [ ] `pulse/src/lib/strategy/blender.test.ts` — stubs for BLEND-02, BLEND-03 (pure function)
- [ ] `pulse/src/lib/strategy/extractor.test.ts` — stubs for STRAT-01, STRAT-02, STRAT-03 (mock @anthropic-ai/sdk + Supabase)
- [ ] `pulse/src/app/dashboard/actions.test.ts` — stub for BLEND-01 (mock Supabase)
- Framework install: `cd pulse && npm install -D vitest @vitest/ui`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Extracting strategy..." step visible in refresh UI during extraction | STRAT-01 | Step-status is real-time UI state | Click Refresh on a creator with transcripts; confirm step-status shows "Extracting strategy..." before completion |
| Amber "⚠ Strategy shift detected" badge appears on creator card after >15% shift | STRAT-04 | Requires two real extraction runs with >15% delta | Run extraction on a creator, manually insert a prior strategy row with >15% delta, re-run extraction, confirm badge appears |
| Trust weight slider saves with green tick on release | BLEND-01 | Interactive slider UX | Set global slider to any value, release, confirm green tick appears briefly then disappears |
| Setting creator weight to 0 excludes from Blend Summary | BLEND-02 | Requires live strategy data | Set one creator to 0%, verify Blend Summary shows 0% influence for that creator |
| Non-blocking extraction failure shows warning (not failure) | STRAT-01/D-02 | Requires simulated Claude failure | Temporarily set invalid ANTHROPIC_API_KEY, run Refresh, confirm "Transcripts refreshed. Strategy extraction failed — try again later" warning, not an error state |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
