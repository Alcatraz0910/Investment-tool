---
phase: 11
slug: creator-intelligence-extraction
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-19
audited: 2026-05-21
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest v4.1.5 |
| **Config file** | `pulse/vitest.config.ts` (jsdom env, `@/` → `src/`) |
| **Quick run command** | `cd pulse && npx vitest run tests/extractor.test.ts tests/extractor-schema.test.ts tests/youtube-client.test.ts tests/creator-actions.test.ts` |
| **Full suite command** | `cd pulse && npx vitest run` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 0 | CI-01, CI-02, CI-03 | — | vitest + config installed | infra | `cd pulse && npx vitest run` | ✅ exists | ✅ green |
| 11-02-01 | 02 | 1 | CI-01 | — | listVideosLast4Weeks cutoff = 120 days (4 months) | unit | `cd pulse && npx vitest run tests/youtube-client.test.ts` | ✅ exists | ✅ green |
| 11-02-02 | 02 | 1 | SRCH-01 | T-input-validation | searchChannels returns ≤5 results; channelId regex-validated | unit | `cd pulse && npx vitest run tests/youtube-client.test.ts` | ✅ exists | ✅ green |
| 11-02-03 | 02 | 1 | SRCH-02 | — | Subscriber count formatted (1.2M, 500K) | unit | `cd pulse && npx vitest run tests/youtube-client.test.ts` | ✅ exists | ✅ green |
| 11-03-01 | 03 | 2 | CI-02, CI-03 | T-advice-language | Two-call extraction; profile_latest null when 0 30-day chunks | unit | `cd pulse && npx vitest run tests/extractor.test.ts` | ✅ exists | ✅ green |
| 11-03-02 | 03 | 2 | CI-03 | T-advice-language | System prompt contains no "recommend/advise/suggest"; ticker null-discipline | unit | `cd pulse && npx vitest run tests/extractor-schema.test.ts` | ✅ exists | ✅ green |
| 11-04-01 | 04 | 3 | SRCH-01 | — | trackSearchedCreator inserts valid channelId | unit | `cd pulse && npx vitest run tests/creator-actions.test.ts` | ✅ exists | ✅ green |
| 11-04-02 | 04 | 3 | SRCH-03 | — | URL input visible when disclosure toggle open | manual | — | manual-only | ⬜ pending |
| 11-04-03 | 04 | 2 | SRCH-01, SRCH-02 | — | Search bar fires on Enter/button only; results render correctly | manual smoke | — | manual-only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `pulse/vitest.config.ts` — installed and configured
- [x] `pulse/tests/extractor.test.ts` — CI-02 two-call pattern + schema constants (5 tests green)
- [x] `pulse/tests/extractor-schema.test.ts` — CI-03 schema compliance, no-advice language (10 tests green)
- [x] `pulse/tests/youtube-client.test.ts` — CI-01 cutoff, SRCH-01 searchChannels, SRCH-02 formatting (13 tests green)
- [x] `pulse/tests/creator-actions.test.ts` — SRCH-01 channelId validation (6 tests green)
- [x] `pulse/tests/search-result-formatting.test.ts` — redirect to youtube-client.test.ts (1 intentional skip)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| URL input visible when disclosure toggle open | SRCH-03 | DOM interaction; no unit test can verify collapse/expand | Open Creators tab, click "Add by URL instead" toggle, verify URL input appears |
| Search bar fires on Enter/button only (no auto-fire) | SRCH-01 | Quota protection; requires browser + network observation | Type 3+ chars, wait 2s, verify no API call; then press Enter/button, verify API call fires |
| Two-layer profile rendered correctly post-refresh | CI-04 | Requires real Supabase + Claude + Pinecone end-to-end | Run refresh on a tracked creator, verify creator card shows both stable and latest sections |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-21

---

## Validation Audit 2026-05-21

| Metric | Count |
|--------|-------|
| Gaps found | 6 (it.todo items) |
| Resolved (automated) | 6 — Pinecone mock added to extractor.test.ts; googleapis mock added to youtube-client.test.ts |
| Escalated to manual-only | 0 |
| Final result | 31 passing, 1 intentional skip (search-result-formatting redirect) |
