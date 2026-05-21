---
phase: 15
slug: visual-redesign
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-21
---

# Phase 15 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `pulse/vitest.config.ts` |
| **Quick run command** | `cd pulse && npx vitest run src/__tests__/phase-15-visual-redesign.test.ts` |
| **Full suite command** | `cd pulse && npx vitest run` |
| **Estimated runtime** | ~5 seconds |

## Sampling Rate

All 8 requirements have automated or manual-only verification.
Nyquist threshold met: no 3+ consecutive tasks without automated coverage.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | VIS-02 | globals.css has `--color-base`, `--color-accent`, `--color-surface`, `--color-border` CSS vars | automated (file-scan) | `cd pulse && npx vitest run src/__tests__/design-system.test.tsx` | ✅ | ✅ green |
| 15-01-02 | 01 | 1 | VIS-02 | layout.tsx imports Geist + Geist Mono; no Inter | automated (file-scan) | `cd pulse && npx vitest run src/__tests__/design-system.test.tsx` | ✅ | ✅ green |
| 15-02-01 | 02 | 1 | VIS-02 | ui/ primitives: Card, Badge, Button, StatTile all exist | automated (file-scan) | `cd pulse && npx vitest run src/__tests__/phase-15-visual-redesign.test.ts` | ✅ | ✅ green |
| 15-02-02 | 02 | 1 | VIS-04 | No `bg-indigo-500` or `focus:ring-indigo-500` in WatchListTab, PortfolioTab, TabBar | automated (file-scan) | `cd pulse && npx vitest run src/__tests__/phase-15-visual-redesign.test.ts` | ✅ | ✅ green |
| 15-03-01 | 03 | 2 | VIS-01 | TabBar has `backdrop-blur`, `layoutId="tab-indicator"`, `bg-accent`, `useRouter` | automated (file-scan) | `cd pulse && npx vitest run src/__tests__/phase-15-visual-redesign.test.ts` | ✅ | ✅ green |
| 15-03-02 | 03 | 2 | VIS-05 | AnimatedTabPanel renders children with provided tabKey | automated (render) | `cd pulse && npx vitest run src/__tests__/AnimatedTabPanel.test.tsx` | ✅ | ✅ green |
| 15-03-03 | 03 | 2 | VIS-03 | Glassmorphism applied (WebkitBackdropFilter + bg-white/5 on Card) | manual | visual inspection | — | ⬜ manual |
| 15-04-01 | 04 | 3 | MOB-03 | PortfolioTab has `sm:hidden` mini-card block + `hidden sm:` desktop table | automated (file-scan) | `cd pulse && npx vitest run src/__tests__/phase-15-visual-redesign.test.ts` | ✅ | ✅ green |
| 15-04-02 | 04 | 3 | VIS-03 | PortfolioTab does not use `bg-indigo-500` or `focus:ring-indigo-500` | automated (file-scan) | `cd pulse && npx vitest run src/__tests__/phase-15-visual-redesign.test.ts` | ✅ | ✅ green |
| 15-05-01 | 05 | 4 | MOB-01 | WatchListTab has `aria-expanded` + `tickersExpanded` ticker toggle | automated (file-scan) | `cd pulse && npx vitest run src/__tests__/phase-15-visual-redesign.test.ts` | ✅ | ✅ green |
| 15-05-02 | 05 | 4 | MOB-02 | WatchListTab has ≥ 2 `min-h-[44px]` touch target instances | automated (file-scan) | `cd pulse && npx vitest run src/__tests__/phase-15-visual-redesign.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

## Wave 0 Requirements

No Wave 0 installs needed — vitest was pre-installed from earlier phases.
React Testing Library also pre-installed.

All test files already exist at time of validation:
- `pulse/src/__tests__/design-system.test.tsx` (pre-existing)
- `pulse/src/__tests__/AnimatedTabPanel.test.tsx` (pre-existing)
- `pulse/src/__tests__/phase-15-visual-redesign.test.ts` (created by Nyquist auditor 2026-05-21)

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Glassmorphism visual rendering (backdrop blur, frosted glass depth) | VIS-03 | CSS visual effects cannot be asserted in jsdom — no real rendering engine | Open app in browser; inspect TabBar nav and creator Card — should appear frosted/translucent with depth |
| Animation smoothness: tab-indicator slides, creator cards stagger, hover lift | VIS-05 | Animation timing and feel cannot be unit-tested | Switch tabs — indicator should slide (not jump). Open Watch List — cards should stagger in with 70ms delay |
| `hover:text-indigo-300` on ticker links (lines 368, 628 of WatchListTab.tsx) | VIS-04 note | Two residual `hover:text-indigo-300` text-color (not bg/ring) instances remain — accepted as minor hover tint, not a structural VIS-04 violation | Verify hover color is acceptable purple-ish tint on ticker text |

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or manual-only designation
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all references (N/A — vitest pre-installed)
- [x] No watch-mode flags in any command
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-21

## Validation Audit 2026-05-21

| Metric | Count |
|--------|-------|
| Input state | B (SUMMARY exists, no prior VALIDATION.md) |
| Gaps found | 5 |
| Resolved (automated) | 5 |
| Escalated to manual-only | 0 |
| Pre-existing tests reused | 2 (design-system, AnimatedTabPanel) |
| New test file | `pulse/src/__tests__/phase-15-visual-redesign.test.ts` |
| Total tests passing | 15/15 |
