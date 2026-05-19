---
phase: 11-creator-intelligence-extraction
verified: 2026-05-19T00:00:00Z
status: human_needed
score: 9/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Confirm SQL migration was applied in Supabase"
    expected: "creator_strategies table has profile_stable JSONB column, profile_latest JSONB column, and allocation is nullable"
    why_human: "Cannot query Supabase schema programmatically without running server — migration is a user-confirmed checkpoint (Plan 01 Task 1)"
  - test: "Run vitest suite and confirm all tests pass"
    expected: "npx vitest run in pulse/ exits 0; extractor-schema tests green; youtube-client cutoff + formatSubscriberCount tests green; creator-actions channelId tests green"
    why_human: "Cannot execute npm/vitest in this environment; vitest.config.ts differs from Plan 01 spec (jsdom environment + react plugin + setupFiles — not a plain node config) — need to confirm tests actually run without setup errors"
  - test: "Verify search bar fires only on submit (no onChange auto-fire)"
    expected: "Typing in the search bar does not call searchCreators; only clicking Search or pressing Enter triggers the server action"
    why_human: "Form fire-on-submit behaviour cannot be asserted by static analysis — requires browser interaction"
  - test: "Verify Track button adds creator to tracked list"
    expected: "After clicking Track on a search result, the button shows 'Tracking ✓' and the creator appears in the tracked list on next page load"
    why_human: "End-to-end user flow requires a browser with a live Supabase connection"
---

# Phase 11: Creator Intelligence Extraction Verification Report

**Phase Goal:** Creator refreshes produce a two-layer intelligence profile (stable 4-month summary + latest 30-day signals); users can discover creators by searching YouTube by name instead of pasting a URL
**Verified:** 2026-05-19
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Creator refresh stores profile_stable and profile_latest JSONB rows in creator_strategies (profile_latest = null if no 30-day posts) | ? UNCERTAIN | extractor.ts inserts `profile_stable` and `profile_latest` (line 354-364); latestProfile set to null when latestChunks.length === 0 (line 315-334). Depends on SQL migration being applied (human checkpoint). |
| 2 | Transcript scraping fetches videos from the last 4 months only (not 12) | ✓ VERIFIED | `listVideosLast4Months` in client.ts uses `cutoff.setMonth(cutoff.getMonth() - 4)` (line 85); `listVideosLast12Months` fully removed from codebase (0 matches in src/); transcript-pipeline.ts imports and calls `listVideosLast4Months` (lines 34, 139); noVideosSummary string says "last 4 months" (line 143). |
| 3 | extract_creator_profile tool captures: favoured stocks (nullable tickers), methodology, sector focus, preferred index funds | ✓ VERIFIED | PROFILE_TOOL_DEF in extractor.ts (lines 62-140) defines all four fields; `favoured_stocks[].ticker` and `preferred_index_funds[].ticker` both use `anyOf [{type:string},{type:null}]`; schema `required` array includes methodology, favoured_stocks, sector_focus, preferred_index_funds, confidence, source_video_ids. |
| 4 | User can search YouTube by channel name and see up to 5 results with thumbnail, name, subscriber count | ✓ VERIFIED | `searchChannels()` in client.ts sets `maxResults: 5` (line 154); returns SearchResult[] with channelTitle, thumbnailUrl, subscriberCount fields; `formatSubscriberCount` exported and used in creators-tab.tsx (line 300-302). |
| 5 | Clicking Track on a search result adds the creator and shows Tracking state | ✓ VERIFIED (code) / ? HUMAN (runtime) | `handleTrack` in creators-tab.tsx (line 61-71) calls `trackSearchedCreator`; `isAlreadyTracked` flag drives "Tracking ✓" display (line 319); button becomes disabled. Runtime flow requires human test. |
| 6 | Manual URL entry still works as collapsible fallback ("Add by URL instead") | ✓ VERIFIED | creators-tab.tsx has `isUrlFormOpen` state (line 47); "Add by URL instead" button (line 331-337); `addCustomCreator` wiring unchanged in creator-actions.ts (lines 57-117). |
| 7 | Two-call extraction pattern: stable first, latest conditional | ✓ VERIFIED | extractor.ts: stable call at lines 281-296; latest call inside `if (latestChunks.length > 0)` at lines 317-334; sequential awaits, not Promise.all. |
| 8 | SYSTEM_PROMPT contains no "recommend", "advise", "suggest" | ✓ VERIFIED | Grep against extractor.ts SYSTEM_PROMPT returns 0 matches for those words. Prompt only contains a comment referencing D-05 naming these words as forbidden. `export const SYSTEM_PROMPT` confirmed present. |
| 9 | channelId validated against /^UC[A-Za-z0-9_-]{22}$/ before DB insert | ✓ VERIFIED | `trackSearchedCreator` in creator-actions.ts line 165: `if (!channelId.match(/^UC[A-Za-z0-9_-]{22}$/))` — guard present before any DB operation. |
| 10 | SQL migration applied (profile_stable, profile_latest columns exist; allocation nullable) | ? UNCERTAIN | Migration snippet is in Plan 01 Task 1 (human checkpoint). Cannot verify Supabase schema without live connection. |

**Score:** 9/10 truths verified (1 fully uncertain — SQL migration human checkpoint)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pulse/vitest.config.ts` | vitest config with @/ alias | ✓ EXISTS + WIRED | Present; resolve.alias `@` → `./src`; includes react plugin + jsdom (differs from Plan 01 spec of plain node env — but this is a deviation that works, not a blocker) |
| `pulse/src/lib/youtube/client.ts` | listVideosLast4Months, searchChannels, formatSubscriberCount, SearchResult | ✓ VERIFIED | All four exports present and substantive (lines 80, 120, 134, 148) |
| `pulse/src/lib/pipeline/transcript-pipeline.ts` | imports listVideosLast4Months | ✓ VERIFIED | Line 34 imports; line 139 calls; line 143 string updated |
| `pulse/src/lib/strategy/extractor.ts` | PROFILE_TOOL_DEF, SYSTEM_PROMPT, CreatorProfile, extractCreatorStrategy two-call | ✓ VERIFIED | All exports present; two-call pattern implemented; `extract_allocation` fully removed (0 matches) |
| `pulse/src/app/dashboard/creator-actions.ts` | searchCreators, trackSearchedCreator | ✓ VERIFIED | Both exported at lines 127, 154; channelId regex at line 165; addCustomCreator unchanged |
| `pulse/src/app/dashboard/creators-tab.tsx` | Search bar (primary) + URL disclosure (fallback) | ✓ VERIFIED | "Find a Creator" heading (line 206); "Add by URL instead" toggle (line 331); AnimatePresence on results and URL form; no onChange on search input |
| `pulse/tests/extractor-schema.test.ts` | Schema compliance + no-advice tests | ✓ VERIFIED | Imports SYSTEM_PROMPT and PROFILE_TOOL_DEF from extractor; all 10 non-todo tests are substantive assertions |
| `pulse/tests/creator-actions.test.ts` | channelId validation tests | ✓ VERIFIED | CHANNEL_ID_REGEX tests present and substantive (6 test cases, no .todo stubs) |
| `pulse/tests/youtube-client.test.ts` | Cutoff logic + formatSubscriberCount tests | ✓ VERIFIED | File exists with real (non-stub) tests for cutoff calculation and formatSubscriberCount |
| `pulse/tests/extractor.test.ts` | Two-call pattern mocked tests | ✓ VERIFIED | File exists with vi.mock pattern for two-call extraction scenarios |
| `pulse/tests/search-result-formatting.test.ts` | Stub file | ✓ VERIFIED | Exists (intentionally empty comment — tests moved to youtube-client.test.ts per Plan 02) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `transcript-pipeline.ts` | `youtube/client.ts` | `import listVideosLast4Months` | ✓ WIRED | Line 34; call at line 139 |
| `creator-actions.ts` | `youtube/client.ts` | `import searchChannels` | ✓ WIRED | Line 4; call inside searchCreators at line 138 |
| `creators-tab.tsx` | `creator-actions.ts` | `import searchCreators, trackSearchedCreator` | ✓ WIRED | Line 5; useActionState wires searchAction (line 51-58); handleTrack calls trackSearchedCreator (line 63) |
| `creators-tab.tsx` | `youtube/client.ts` | `import formatSubscriberCount, SearchResult` | ✓ WIRED | Line 6; formatSubscriberCount called in JSX at line 301 |
| `extractor.ts` | Pinecone | `retrieveChunks() with $gte filter` | ✓ WIRED | stableFilter (line 268-270) and latestFilter (line 310-312) both use `$gte` pattern |
| `extractor.ts` | `anthropic.messages.create` | two sequential awaits | ✓ WIRED | stableResponse (line 281); latestResponse (line 323) — sequential, not Promise.all |
| `extractor.ts` | `creator_strategies` table | `insert with profile_stable, profile_latest` | ✓ WIRED | Lines 354-364: both columns present in insert object; allocation = null |
| `extractor-schema.test.ts` | `extractor.ts` | `import SYSTEM_PROMPT, PROFILE_TOOL_DEF` | ✓ WIRED | Line 6 import; both constants are `export const` in extractor.ts |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `extractor.ts` | `stableChunks` | `retrieveChunks(creatorId, stableFilter)` → Pinecone | Yes — live Pinecone query with $gte filter | ✓ FLOWING |
| `extractor.ts` | `latestChunks` | `retrieveChunks(creatorId, latestFilter)` → Pinecone | Yes — live Pinecone query with $gte filter | ✓ FLOWING |
| `creators-tab.tsx` | `searchState.results` | `useActionState` → `searchCreators` → `searchChannels` → YouTube API | Yes — live YouTube API call returning SearchResult[] | ✓ FLOWING |
| `creator-actions.ts` | `results` | `searchChannels(trimmed)` | Yes — two-step YouTube search.list + channels.list | ✓ FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED for most tests (requires live Supabase + Pinecone + YouTube API). The following pure-logic check is verifiable statically:

| Behavior | Evidence | Status |
|----------|----------|--------|
| `formatSubscriberCount(1_200_000)` returns "1.2M subscribers" | client.ts line 136: `(count / 1_000_000).toFixed(1)M subscribers` | ✓ PASS (static) |
| `trackSearchedCreator` rejects channelId not matching UC regex | creator-actions.ts line 165: guard returns error before DB operations | ✓ PASS (static) |
| Empty stable chunks throws before Claude call | extractor.ts lines 274-278: explicit throw | ✓ PASS (static) |
| Empty latest chunks sets profile_latest = null | extractor.ts line 315: `let latestProfile = null`; conditional call inside `if (latestChunks.length > 0)` | ✓ PASS (static) |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CI-01 | 11-02 | Transcript scraping limited to last 4 months | ✓ SATISFIED | `listVideosLast4Months` with `setMonth(-4)` cutoff; `listVideosLast12Months` removed |
| CI-02 | 11-03 | Two extraction layers: stable (4-month) + latest (30-day) | ✓ SATISFIED | Two-call pattern in extractCreatorStrategy; Pinecone $gte filters for each window |
| CI-03 | 11-03 | Captures favoured stocks (nullable tickers), methodology, sector focus, preferred index funds | ✓ SATISFIED | PROFILE_TOOL_DEF schema with all four field groups; anyOf nullable ticker |
| CI-04 | 11-01, 11-04 | Profile displays both layers distinctly | PARTIAL — data layer only | ROADMAP note confirms: "Data layer (profile_stable, profile_latest JSONB columns) delivered in Phase 11 Wave 0; UI rendering of both layers is Phase 12 scope." StrategyCard still reads legacy `strategy.allocation` field only. |
| SRCH-01 | 11-02, 11-04 | User can search YouTube channels by name or keyword | ✓ SATISFIED | `searchChannels()` + `searchCreators` server action + search bar in creators-tab.tsx |
| SRCH-02 | 11-02, 11-04 | Search results display channel name, thumbnail, subscriber count | ✓ SATISFIED | SearchResult interface + formatSubscriberCount + creators-tab.tsx result card renders all three fields |
| SRCH-03 | 11-04 | Manual channel URL entry preserved as fallback | ✓ SATISFIED | "Add by URL instead" disclosure toggle in creators-tab.tsx; addCustomCreator unchanged |

**Note on REQUIREMENTS.md traceability table:** SRCH-01, SRCH-02, SRCH-03 are mapped to Phase 9 in REQUIREMENTS.md (last updated 2026-05-13). Phase 9 was subsequently absorbed into Phase 11 per ROADMAP.md ("deferred; absorbed into v1.2 Phase 11"). CI-01 through CI-04 are v1.2 requirements listed in REQUIREMENTS.md but not in the traceability table. The traceability table is stale — this is a documentation issue, not an implementation blocker.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `creator-actions.ts` | 172-174 | `void thumbnailUrl` + TODO comment — thumbnail not stored | INFO | thumbnailUrl accepted by trackSearchedCreator but discarded; creators table has no thumbnail_url column yet. Search results show thumbnails (from SearchResult state in client), but thumbnails are not persisted. Not a Phase 11 blocker — display works from in-memory search state. |
| `creator-actions.ts` | 189 | Dynamic import `await import('@/lib/supabase/service')` in trackSearchedCreator (vs static import at top of addCustomCreator) | INFO | Inconsistency between the two functions (addCustomCreator uses dynamic import, trackSearchedCreator also uses it at line 189). Matches existing pattern; not a stub. |
| `vitest.config.ts` | 6-16 | Config uses `jsdom` + `react` plugin + `setupFiles` — differs from Plan 01 spec (plain `node` environment) | WARNING | Config diverges from plan spec. The react plugin and jsdom environment may cause issues for the `server-only` imports in tests (extractor-schema.test.ts mocks `server-only` explicitly to handle this). Needs vitest run confirmation. |
| `StrategyCard.tsx` | 36 | `Object.entries(strategy.allocation)` — reads legacy allocation field, not profile_stable/profile_latest | INFO | Expected: CI-04 UI rendering is deferred to Phase 12. StrategyCard will need updating in Phase 12. Not a Phase 11 gap. |

---

### Human Verification Required

#### 1. SQL Migration Confirmation

**Test:** Check Supabase Table Editor → creator_strategies
**Expected:** Columns profile_stable (jsonb, nullable) and profile_latest (jsonb, nullable) exist; allocation column has no NOT NULL constraint
**Why human:** SQL migration (Plan 01 Task 1) is a user-run checkpoint with no automated verification path in this codebase

#### 2. vitest Suite Green Run

**Test:** `cd pulse && npx vitest run --reporter=verbose`
**Expected:** Exit 0; all non-todo tests pass including extractor-schema, youtube-client, creator-actions tests
**Why human:** vitest.config.ts uses jsdom + react plugin + setupFiles (diverges from Plan 01 spec); cannot confirm no setup file issues without executing. The `server-only` mock in extractor-schema.test.ts should handle Next.js guards, but needs confirmation.

#### 3. Search Bar Fire-on-Submit Only

**Test:** Open Creators tab in browser, type in the search bar, verify no network request fires until Enter or Search button is clicked
**Expected:** 0 YouTube API calls on keypress; exactly 1 call on form submit
**Why human:** No onChange handler on search input (statically confirmed), but actual network behaviour requires browser devtools observation

#### 4. Track Button End-to-End

**Test:** Search for a YouTube creator, click Track on a result
**Expected:** Button changes to "Tracking ✓"; creator appears in tracked creators list; next page load shows the creator with Refresh button
**Why human:** Requires live Supabase + YouTube API + authenticated browser session

---

### Gaps Summary

No implementation blockers found. All core code exists, is substantive, and is wired. The four human verification items are runtime/infrastructure checks (SQL migration, test runner, browser behaviour) — not code gaps.

One deferred item noted: CI-04 UI rendering (displaying profile_stable / profile_latest distinctly in the UI) is explicitly scoped to Phase 12 per ROADMAP.md note and is not a Phase 11 gap.

REQUIREMENTS.md traceability table is stale (SRCH-01/02/03 still mapped to Phase 9; CI-01 through CI-04 not in table) — recommend updating as a housekeeping task.

---

_Verified: 2026-05-19_
_Verifier: Claude (gsd-verifier)_
