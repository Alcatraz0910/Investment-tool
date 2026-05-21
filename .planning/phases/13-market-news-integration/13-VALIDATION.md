---
phase: 13
slug: market-news-integration
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-20
audited: 2026-05-21
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.5 |
| **Config file** | `pulse/vitest.config.ts` |
| **Quick run command** | `cd pulse && npx vitest run tests/news-cache.test.ts tests/news-context.test.ts` |
| **Full suite command** | `cd pulse && npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd pulse && npx vitest run tests/news-cache.test.ts tests/news-context.test.ts`
- **After every plan wave:** Run `cd pulse && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 0 | NEWS-01, NEWS-02 | — | N/A | stub | `npx vitest run tests/news-cache.test.ts` | ✅ | ✅ green |
| 13-01-02 | 01 | 0 | NEWS-03, NEWS-04 | — | N/A | stub | `npx vitest run tests/news-context.test.ts` | ✅ | ✅ green |
| 13-02-01 | 02 | 1 | NEWS-01 | T-13-03 | FINNHUB_API_KEY only accessed server-side | unit (mock fetch) | `npx vitest run tests/news-cache.test.ts` | ✅ | ✅ green |
| 13-02-02 | 02 | 1 | NEWS-02 | T-13-04 | RSS URLs are static constants; no user input | unit (mock rss-parser) | `npx vitest run tests/news-cache.test.ts` | ✅ | ✅ green |
| 13-02-03 | 02 | 1 | NEWS-06, NEWS-07 | T-13-01 | news_cache RLS: auth.uid() = user_id | unit (TTL logic) | `npx vitest run tests/news-cache.test.ts` | ✅ | ✅ green |
| 13-02-04 | 02 | 1 | NEWS-03, NEWS-04 | T-13-05 | context_summary must not contain advice language | unit (tool schema + guard) | `npx vitest run tests/news-context.test.ts` | ✅ | ✅ green |
| 13-03-01 | 03 | 2 | NEWS-04, NEWS-05 | — | N/A | tsc + visual | `cd pulse && npx tsc --noEmit` | ✅ | ✅ green |
| 13-03-02 | 03 | 2 | NEWS-06 | — | N/A | tsc + visual | `cd pulse && npx tsc --noEmit` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `pulse/tests/news-cache.test.ts` — stubs for NEWS-01, NEWS-02, NEWS-06, NEWS-07
- [x] `pulse/tests/news-context.test.ts` — stubs for NEWS-03, NEWS-04
- [x] `cd pulse && npm install rss-parser` — new dependency for RSS parsing

*Existing infrastructure (vitest, @anthropic-ai/sdk, Supabase) covers all other requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| News badge shows count on WatchListTab ticker rows | NEWS-04 | Requires live Finnhub API key + network | Run `npm run dev`, open Watch List tab, click Refresh News, verify badge appears on ticker rows |
| Context summary renders in Watch List header | NEWS-06 | Requires live Claude + Finnhub + RSS calls | Verify "This Month's Context" panel appears with 3-4 sentence summary after Refresh News |
| Cache staleness indicator shows amber on stale data | NEWS-07 | Requires >24h-old cache row | Manually update `fetched_at` in Supabase to yesterday; verify amber indicator |
| Refresh News button disabled during pending state | NEWS-04 | UI interaction | Click Refresh News; verify button disables while in-flight |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** passed 2026-05-21

---

## Validation Audit 2026-05-21

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Tests run | 21 |
| Tests passed | 21 |
| tsc errors | 0 |

All 8 tasks COVERED. No auditor spawn required. Phase is Nyquist-compliant.
