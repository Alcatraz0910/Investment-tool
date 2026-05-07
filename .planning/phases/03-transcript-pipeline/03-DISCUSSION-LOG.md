# Phase 3: Transcript Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-07
**Phase:** 3-Transcript Pipeline
**Areas discussed:** Refresh UX & architecture, Missing transcripts, Re-refresh behavior, last_refreshed_at source

---

## Refresh UX & Architecture

### Q1: Where should the refresh pipeline logic live?

| Option | Description | Selected |
|--------|-------------|----------|
| API Route | POST /api/refresh/[creatorId]. Can stream/poll. No Vercel timeout concern. | ✓ |
| Server Action | Simpler but 10s default timeout on Vercel, no streaming. | |
| You decide | Leave to executor. | |

**User's choice:** API Route
**Notes:** Long-running pipeline (30–120s) makes API Route the only viable option.

### Q2: What does the user see during refresh?

| Option | Description | Selected |
|--------|-------------|----------|
| Spinner + step status | Client polls every 2s, shows step name + count. | ✓ |
| Spinner only | Single POST, await response. No progress detail. | |
| Streaming SSE | Most responsive but adds SSE parsing complexity. | |

**User's choice:** Spinner + step status
**Notes:** Step format examples: "Fetching videos... 12/12", "Embedding chunks... 8/12 videos".

### Q3: Refresh button placement?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline per tracked creator row | Each row gets [Refresh] button. | ✓ |
| Separate refresh panel | Dropdown to pick creator. Cleaner list. | |
| You decide | Executor picks placement. | |

**User's choice:** Inline per tracked creator row

---

## Missing Transcripts

### Q1: When youtube-transcript fails for a video?

| Option | Description | Selected |
|--------|-------------|----------|
| Skip silently, continue | No record stored. Show count summary. | |
| Store null record | Insert row with raw_text = NULL for retry tracking. | ✓ |
| Abort on first failure | Cancel whole refresh on any failure. | |

**User's choice:** Store null record (freeform: "skip and continue but allow retry on next refresh")
**Notes:** User wanted skip-and-continue behaviour plus the ability to retry failed videos on next refresh. Null record approach satisfies both.

### Q2: YouTube API quota handling?

**User's question:** Asked about quota units per 30-minute video before deciding.
**Answer provided:** youtube-transcript npm uses zero API quota (scrapes directly). YouTube Data API calls for metadata only cost ~3–5 units per creator. At 10,000 units/day, quota is a non-issue for personal use.
**Resolution:** Treat quota errors as generic API errors (abort + show error, save partial progress).

### Q3: Where to display video names/dates?

| Option | Description | Selected |
|--------|-------------|----------|
| Expandable per-creator list | Toggle in Creators tab. Title + date + status. | ✓ |
| Separate Transcripts tab | 4th tab in dashboard nav. | |
| You decide | Executor picks placement. | |

**User's choice:** Expandable per-creator list
**Notes:** User explicitly requested seeing "the name and date of upload of each video extracted within the app."

### Q4: What to show in the transcript list?

| Option | Description | Selected |
|--------|-------------|----------|
| Title + Date + Status | Three columns with status chip. | ✓ |
| Title + Date only | Simpler, no status. | |
| Title + Date + Word count + Status | Adds word count from DB. | |

**User's choice:** Title | Published date | Status

---

## Re-refresh Behavior

### Q1: Videos already fetched AND embedded (is_embedded = TRUE)?

| Option | Description | Selected |
|--------|-------------|----------|
| Skip entirely | Fastest. Matches idempotency criterion. | ✓ |
| Re-fetch text, skip re-embed | More up-to-date captions but slower. | |
| Full re-run always | Delete + restart. Slowest. | |

**User's choice:** Skip entirely

### Q2: Videos fetched but not embedded (raw_text not null, is_embedded = FALSE)?

| Option | Description | Selected |
|--------|-------------|----------|
| Re-attempt embedding | Auto-heals partial pipeline failures. | ✓ |
| Treat as embedded, skip | Assume intentionally skipped. | |
| You decide | Executor handles edge case. | |

**User's choice:** Re-attempt embedding

---

## last_refreshed_at Source

### Q1: How to source the last refreshed timestamp (TRANS-05)?

| Option | Description | Selected |
|--------|-------------|----------|
| Derive from MAX(transcripts.last_fetched) | No schema change. Extra JOIN. | |
| Add column to user_creators | Per-user tracking. SQL editor migration. | ✓ |
| Add column to creators | Global timestamp. Simpler but shared across users. | |

**User's choice:** Add column to user_creators

### Q2: How should the API Route update last_refreshed_at?

| Option | Description | Selected |
|--------|-------------|----------|
| Service role Supabase client | Bypasses RLS. Consistent with transcript pattern. | ✓ |
| Authenticated user client | Forward session token. More complex. | |

**User's choice:** Service role Supabase client

---

## Claude's Discretion

- Pinecone chunk size (ROADMAP.md says ~500 tokens) and overlap amount
- Pinecone vector metadata schema (minimum fields specified in CONTEXT.md)
- Pinecone namespace key format for creator ID
- Polling interval for step status (suggested 2s)
- Error message copy for UI error states

## Deferred Ideas

None — discussion stayed within phase scope.
