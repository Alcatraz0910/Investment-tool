---
phase: 6
slug: dashboard-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-07
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + React Testing Library |
| **Config file** | `pulse/vitest.config.ts` (Wave 0 installs if absent) |
| **Quick run command** | `cd pulse && npx vitest run --reporter=verbose 2>&1 | tail -20` |
| **Full suite command** | `cd pulse && npx vitest run 2>&1` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd pulse && npx vitest run --reporter=verbose 2>&1 | tail -20`
- **After every plan wave:** Run `cd pulse && npx vitest run 2>&1`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 6-00-01 | 06-00 | 0 | UI-01 | — | N/A | unit | `cd pulse && npx vitest run src/__tests__/design-system.test.tsx` | ❌ W0 | ⬜ pending |
| 6-00-02 | 06-00 | 0 | UI-03 | — | N/A | unit | `cd pulse && npx vitest run src/__tests__/RoadmapView.test.tsx` | ❌ W0 | ⬜ pending |
| 6-00-03 | 06-00 | 0 | UI-02 | — | disclaimer visible | unit | `cd pulse && npx vitest run src/__tests__/BuyListTable.test.tsx` | ❌ W0 | ⬜ pending |
| 6-00-04 | 06-00 | 0 | UI-04 | — | N/A | unit | `cd pulse && npx vitest run src/__tests__/ContributionCalculator.test.tsx` | ❌ W0 | ⬜ pending |
| 6-00-05 | 06-00 | 0 | UI-05 | — | N/A | unit | `cd pulse && npx vitest run src/__tests__/StrategyCard.test.tsx` | ❌ W0 | ⬜ pending |
| 6-02-01 | 06-02 | 2 | UI-02 | — | disclaimer string present | unit | `cd pulse && npx vitest run src/__tests__/BuyListTable.test.tsx` | ❌ W0 | ⬜ pending |
| 6-03-01 | 06-03 | 3 | UI-03 | — | divergence formula correct | unit | `cd pulse && npx vitest run src/__tests__/RoadmapView.test.tsx` | ❌ W0 | ⬜ pending |
| 6-04-01 | 06-04 | 2 | UI-05 | — | N/A | unit | `cd pulse && npx vitest run src/__tests__/StrategyCard.test.tsx` | ❌ W0 | ⬜ pending |
| 6-05-01 | 06-05 | 4 | UI-04 | — | N/A | unit | `cd pulse && npx vitest run src/__tests__/ContributionCalculator.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements (Plan 06-00)

- [ ] `pulse/src/__tests__/design-system.test.tsx` — stubs for UI-01 (token existence, glassmorphism classes)
- [ ] `pulse/src/__tests__/RoadmapView.test.tsx` — stubs for UI-03 (trajectory rendering, divergence)
- [ ] `pulse/src/__tests__/BuyListTable.test.tsx` — stubs for UI-02 (disclaimer visible, ticker renders)
- [ ] `pulse/src/__tests__/ContributionCalculator.test.tsx` — stubs for UI-04 (slider, real-time update)
- [ ] `pulse/src/__tests__/StrategyCard.test.tsx` — stubs for UI-05 (confidence score, lastRefreshedAt, contradiction badge)
- [ ] `pulse/vitest.config.ts` — update with jsdom environment + RTL setup if not already present
- [ ] RTL install: `cd pulse && npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Framer Motion transitions play on mount | UI-01 | Animation timing not easily testable in jsdom | Load dashboard in browser; observe card fade-in and stagger on first render |
| Contribution Calculator slider has no visible lag | UI-04 | Perceptual latency requires human judgment | Drag slider rapidly; Buy List should update within 1 frame (~16ms) |
| Glassmorphism backdrop-blur renders correctly | UI-01 | CSS backdrop-filter not supported in jsdom | Open in Chromium; verify frosted-glass effect on cards over background |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
