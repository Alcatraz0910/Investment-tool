---
phase: 11-creator-intelligence-extraction
reviewed: 2026-05-19T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - pulse/src/app/dashboard/creator-actions.ts
  - pulse/src/app/dashboard/creators-tab.tsx
  - pulse/src/lib/pipeline/transcript-pipeline.ts
  - pulse/src/lib/strategy/extractor.ts
  - pulse/src/lib/youtube/client.ts
  - pulse/tests/creator-actions.test.ts
  - pulse/tests/extractor.test.ts
  - pulse/tests/extractor-schema.test.ts
  - pulse/tests/youtube-client.test.ts
findings:
  critical: 3
  warning: 5
  info: 3
  total: 11
status: fixes_applied
---

# Phase 11: Code Review Report

**Reviewed:** 2026-05-19T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 11 introduces YouTube channel search, a two-call Claude extraction pattern (stable 4-month + latest 30-day), and a new `PROFILE_TOOL_DEF` schema with nullable tickers. The implementation is structurally sound but contains three blockers: a logic bug that renders the contradiction check always a no-op, a missing `await` on `handleTrack` that silently drops tracking errors, and unvalidated/unsanitised user-supplied `channelTitle` written to the database. Five warnings cover input-length exposure, a broken duplicate-key detection pattern, a search-result O(n) scan per result, an unguarded `is_embedded` state when Pinecone upsert fails, and a `formatSubscriberCount` boundary edge case.

---

## Critical Issues

### CR-01: Contradiction check is always a no-op — `next` allocation is never the new profile

**File:** `pulse/src/lib/strategy/extractor.ts:350`

**Issue:** The contradiction check is called as:

```ts
const contradiction = runContradictionCheck(prevAllocation, prevAllocation ?? {})
```

Both arguments are `prevAllocation`. The second argument should be the *new* allocation derived from the freshly extracted profile, but because `allocation = null` in Phase 11 rows, the intent appears to be "pass null prev → early return". However when `prevAllocation` is **not** null (i.e. a pre-Phase-11 row exists with a real allocation), the call compares the previous row against itself. Every delta is zero, so `hasContradiction` is always `false` and real allocation shifts are silently suppressed.

The comment reads "Pass empty object as next — safe because prev=null short-circuits before next is read." This is wrong: if any pre-Phase-11 creator_strategies row with a non-null `allocation` exists, `prev` is not null and the comparison proceeds — comparing prev against prev.

**Fix:** If the intent is to always skip contradiction for Phase 11 rows, pass `null` explicitly as `prev` regardless of what the DB returned:

```ts
// Phase 11: allocation is always null in new rows; contradiction check is deferred.
const contradiction = runContradictionCheck(null, {})
```

Or, if real contradiction checking is desired, derive a next allocation and pass it. The current code must not pass `prevAllocation` as both arguments.

---

### CR-02: `handleTrack` missing `await` — tracking errors silently swallowed, no error message shown

**File:** `pulse/src/app/dashboard/creators-tab.tsx:209`

**Issue:** The search form action is:

```tsx
action={(formData) => startT(() => searchAction(formData))}
```

That is correct (wraps in `startT`). But `handleTrack` on line 61 is a plain `async` function called from an `onClick` — it is not wrapped in a transition and it does not surface its error to any visible UI state. When `trackSearchedCreator` returns `{ error }`, the code removes the `channelId` from `trackingIds` (line 66–69) to re-enable the button, but **no error message is displayed to the user**. There is no `setToggleError` call or equivalent. The user clicks Track, the button briefly greys out, and if the server action fails the button becomes clickable again with no explanation.

Additionally, the `onClick` handler calls `handleTrack(result)` without `await` or being wrapped in a transition, so any thrown (as opposed to returned) error from `trackSearchedCreator` would be an unhandled promise rejection.

**Fix:** Expose an error state for search-track failures and call it in `handleTrack`:

```tsx
const [trackError, setTrackError] = useState<string | null>(null)

async function handleTrack(result: SearchResult) {
  setTrackingIds(prev => new Set(prev).add(result.channelId))
  const res = await trackSearchedCreator(result.channelId, result.channelTitle, result.thumbnailUrl)
  if (res.error) {
    setTrackingIds(prev => { const next = new Set(prev); next.delete(result.channelId); return next })
    setTrackError(res.error)
  }
}
```

And render `trackError` near the search results the same way `toggleError` is rendered for curated creators.

---

### CR-03: Unsanitised `channelTitle` from client written directly to `creators.display_name`

**File:** `pulse/src/app/dashboard/creator-actions.ts:196`

**Issue:** `trackSearchedCreator` receives `channelTitle: string` from the client component (line 156). This value originates from the YouTube API response, but it arrives via the client — the server action signature is `'use server'` which means it is a public HTTP endpoint callable with arbitrary payloads. The `channelTitle` is inserted into `creators.display_name` (line 196) with no validation on length or content.

An attacker can call the server action with a `channelTitle` of arbitrary length (e.g. 100 KB) or containing control characters, bypassing the YouTube API entirely. The `channelId` is validated by regex (correct), but `channelTitle` has no guard.

**Fix:** Add a length check before the DB insert:

```ts
if (!channelTitle || channelTitle.trim().length === 0) {
  return { error: 'Invalid channel title.' }
}
const safeTitle = channelTitle.trim().slice(0, 255)  // DB varchar limit guard
```

Apply the trimmed, length-capped value to the insert.

---

## Warnings

### WR-01: Duplicate-key detection uses `.includes('duplicate key')` — fragile string match

**File:** `pulse/src/app/dashboard/creator-actions.ts:21`, `111`, `218`

**Issue:** Three places in `creator-actions.ts` detect UNIQUE constraint violations via:

```ts
if (error && !error.message.includes('duplicate key'))
```

Supabase/PostgREST wraps PostgreSQL error messages and the exact string may differ between versions, locales, or if the error comes back as `error.code === '23505'` (the stable SQLSTATE). The string `'duplicate key'` is present in standard PostgreSQL messages but is not guaranteed stable. All three call sites use the same brittle pattern.

**Fix:** Check the Postgres error code instead:

```ts
// '23505' is the stable SQLSTATE for unique_violation
if (error && error.code !== '23505') {
  return { error: 'Something went wrong. Please try again.' }
}
```

---

### WR-02: `searchChannels` uses O(n) `.find()` per result — also risks mismatched order

**File:** `pulse/src/lib/youtube/client.ts:180`

**Issue:** The final `return` in `searchChannels` maps over `channelIds` and calls `.find()` on `searchRes.data.items` for each ID:

```ts
return channelIds.map(id => {
  const searchItem = searchRes.data.items?.find(i => i.snippet?.channelId === id)
  ...
})
```

With `maxResults: 5` this is at most 25 comparisons — not a performance issue per se — but there is a correctness risk: if `searchRes.data.items` is undefined (the API returned no items array at all but `channelIds` was somehow populated, e.g. from a mutated array), `searchItem` is silently `undefined`, `channelTitle` falls back to `''`, and a result row with an empty title is returned. An empty `channelTitle` then reaches the DB insert in `trackSearchedCreator` (see CR-03 above).

Additionally, `channelIds` is built from `item.snippet?.channelId` but the stats lookup uses `item.id` as the map key (line 174). If the search-result's `snippet.channelId` differs from the channel's canonical `id` (uncommon but possible for YouTube's search API edge cases), `statsMap.get(id)` returns `undefined` for every entry and all subscriber counts become `null`.

**Fix:** Build a `Map<id, searchItem>` up-front, and add a guard for empty title in the mapping:

```ts
const searchItemMap = new Map(
  searchRes.data.items?.map(i => [i.snippet?.channelId, i]) ?? []
)
return channelIds.map(id => {
  const searchItem = searchItemMap.get(id)
  return {
    channelId: id,
    channelTitle: searchItem?.snippet?.channelTitle ?? '',
    ...
  }
})
```

---

### WR-03: `is_embedded` not set to `false` on upsert — re-run after Pinecone failure leaves stale `is_embedded=true`

**File:** `pulse/src/lib/pipeline/transcript-pipeline.ts:209`

**Issue:** The transcript upsert at line 208 does not include `is_embedded` in the upsert payload:

```ts
await svc.from('transcripts').upsert(
  {
    creator_id: creatorId,
    video_id: v.videoId,
    title: v.title,
    published_at: v.publishedAt.toISOString(),
    raw_text: rawText,
    word_count: wordCount,
    last_fetched: nowIso,
    updated_at: nowIso,
    // is_embedded NOT set here
  },
  { onConflict: 'video_id' },
)
```

On a re-run where a transcript was previously fetched (`raw_text != null`) and partially embedded (Pinecone upsert succeeded but the Supabase `is_embedded=true` write failed), the D-07/D-08 idempotency checks at lines 182–190 will skip the row entirely: D-07 catches `is_embedded=true`, D-08 catches `raw_text != null`. So a row that is in Pinecone but not marked embedded in Supabase will retry correctly. However, the reverse — row marked `is_embedded=true` in Supabase but with vectors missing from Pinecone — is unrecoverable without manual DB intervention. The upsert should include `is_embedded: false` so that on a legitimate re-fetch the flag is reset:

**Fix:**

```ts
await svc.from('transcripts').upsert(
  {
    ...
    raw_text: rawText,
    is_embedded: false,   // Reset so embedding step is re-attempted
    word_count: wordCount,
    last_fetched: nowIso,
    updated_at: nowIso,
  },
  { onConflict: 'video_id' },
)
```

Note: D-09 rows (existing with `raw_text=null`) are skipped before this upsert at line 188, so adding `is_embedded: false` only affects genuinely new/re-fetched rows, which is the correct intent.

---

### WR-04: No query length cap on YouTube search — quota protection incomplete

**File:** `pulse/src/app/dashboard/creator-actions.ts:134`

**Issue:** `searchCreators` trims the query and rejects empty strings (correct for quota protection). However there is no upper-bound on query length. A client can send a query string of arbitrary length (e.g. 10 KB). The YouTube API call will receive the full string as the `q` parameter. While YouTube is likely to reject or truncate it, an oversized query:

1. Wastes network bandwidth on every call.
2. May produce unexpected API errors that are returned to the user as the generic "Search failed" message, masking what actually happened.
3. Represents an untrusted input path that bypasses any server-side validation the calling component performs.

**Fix:** Cap query length before forwarding to the API:

```ts
const trimmed = query.trim()
if (!trimmed) return { error: 'Please enter a channel name to search.' }
if (trimmed.length > 200) return { error: 'Search query is too long.' }
```

---

### WR-05: `extractCreatorStrategy` leaks `refresh_jobs` step updates without the `started_at` field set on re-run

**File:** `pulse/src/lib/strategy/extractor.ts:257`

**Issue:** `runRefreshPipeline` sets `started_at` in its initial upsert (line 108 in `transcript-pipeline.ts`). `extractCreatorStrategy` also upserts to `refresh_jobs` (lines 257 and 299) with `step` and `status` but **no `started_at`**. Because the upsert uses `onConflict: 'user_id,creator_id'`, it will update the existing row but omit `started_at` from the payload — depending on Supabase upsert semantics, this may leave `started_at` untouched (correct) or overwrite it with `null` (incorrect, depending on DB default). If the column has no DEFAULT and the upsert performs a full row replacement on conflict, `started_at` is set to null, corrupting timing data.

**Fix:** Either include `started_at` in the extractor upserts (using the same timestamp as the pipeline run passed in as a parameter) or switch from `upsert` to `update` (matching on `user_id` + `creator_id`) so only `step`/`status`/`updated_at` are modified:

```ts
await svc.from('refresh_jobs')
  .update({ step: 'Extracting stable profile...', status: 'running', updated_at: new Date().toISOString() })
  .eq('user_id', userId)
  .eq('creator_id', creatorId)
```

---

## Info

### IN-01: `thumbnailUrl` parameter accepted but intentionally discarded — API surface is misleading

**File:** `pulse/src/app/dashboard/creator-actions.ts:157`, `174`

**Issue:** `trackSearchedCreator` accepts `thumbnailUrl: string | null` and immediately discards it with `void thumbnailUrl`. The parameter exists only because of a planned future schema column. Until the column exists, callers are passing data that produces no effect. The TODO comment acknowledges this, but the parameter still appears in the public function signature, inviting confusion about whether the thumbnail is actually stored.

**Fix:** Either remove the parameter (breaking change, requires updating the call site in `creators-tab.tsx`) or document the signature explicitly:

```ts
/** thumbnailUrl: reserved for future use — not yet stored (no thumbnail_url column). */
```

---

### IN-02: `extractor.test.ts` mocks `contradiction` at wrong path

**File:** `pulse/tests/extractor.test.ts:52`

**Issue:** The mock is:

```ts
vi.mock('./contradiction', () => ({
  runContradictionCheck: vi.fn().mockReturnValue({ hasContradiction: false, note: null }),
}))
```

The module under test (`extractor.ts`) imports from `'./contradiction'` relative to `src/lib/strategy/`. In Vitest, `vi.mock` paths must match the specifier as it appears in the module under test, resolved from the test file's perspective. If the test file is in `pulse/tests/` and the mock path is `'./contradiction'`, Vitest will try to mock `pulse/tests/contradiction` rather than `pulse/src/lib/strategy/contradiction`. The mock will not intercept the real import, meaning `runContradictionCheck` runs against real allocation data (which is `{}` in these tests, so no harm done currently — but it is a latent correctness issue).

**Fix:** Use the module's alias path or absolute-from-root specifier:

```ts
vi.mock('@/lib/strategy/contradiction', () => ({
  runContradictionCheck: vi.fn().mockReturnValue({ hasContradiction: false, note: null }),
}))
```

---

### IN-03: `formatSubscriberCount` boundary: exactly 1,000 formats as "1K subscribers" but 1,000,000 formats as "1.0M subscribers" — inconsistent precision

**File:** `pulse/src/lib/youtube/client.ts:136`

**Issue:**

```ts
if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M subscribers`
if (count >= 1_000)     return `${(count / 1_000).toFixed(0)}K subscribers`
```

A count of exactly `1_000_000` returns `"1.0M subscribers"` (one decimal place). A count of exactly `1_000` returns `"1K subscribers"` (no decimal). The inconsistency is minor but the test suite does not cover the `1_000_000` exact boundary — the lowest covered M-range test is `1_200_000`. The `1.0M` form may look odd to users who expect `1M`.

**Fix (optional):** Use `toFixed(1)` for M but strip trailing `.0`:

```ts
if (count >= 1_000_000) {
  const val = (count / 1_000_000).toFixed(1)
  return `${val.endsWith('.0') ? val.slice(0, -2) : val}M subscribers`
}
```

---

_Reviewed: 2026-05-19T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
