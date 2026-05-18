# Phase 11: Creator Intelligence Extraction — Discussion Log

**Date:** 2026-05-18
**Mode:** Default (interactive) — user deferred all decisions to Claude

---

## Gray Areas Presented

Four gray areas were identified and presented. User responded "Do what you think would work best" — delegating all decisions to Claude.

---

## Area 1: Extraction Schema

**Question:** What does the new Claude tool output look like?

**Context:** The current `extract_allocation` tool returns category % allocations (Index Funds/Stocks/Cash). The new schema needs to return favoured stocks, methodology, sector focus, preferred index funds.

**Decision (Claude's discretion):** New `extract_creator_profile` tool with structured fields: `methodology` (string), `favoured_stocks` (array with ticker/name/rationale/conviction), `sector_focus` (array with sector/stance/rationale), `preferred_index_funds` (array with name/ticker/rationale), `confidence`, `source_video_ids`. Forced tool_use pattern preserved.

---

## Area 2: Two-Layer Split

**Question:** How do stable (4-month) vs latest (30-day) signals get separated?

**Options considered:** Two separate Claude calls vs one call with two output sections.

**Decision (Claude's discretion):** Two separate Claude calls with different Pinecone date filters. Stable = `published_at >= (now - 4 months)`. Latest = `published_at >= (now - 30 days)`. Results stored in `profile_stable` and `profile_latest` JSONB columns. If 30-day query returns 0 chunks, latest layer is skipped (null).

---

## Area 3: Old Pinecone Data

**Question:** What happens to existing Pinecone vectors older than 4 months?

**Options considered:** Delete, ignore, or filter at query time.

**Decision (Claude's discretion):** Keep existing vectors. Filter at query time via Pinecone metadata date filter. Pipeline scrape window changes from 12 → 4 months. No Pinecone deletion needed.

---

## Area 4: Creator Search UI

**Question:** Where does the search experience live and how does it integrate?

**Decision (Claude's discretion):** Search bar replaces URL field as primary entry. Results inline (max 5: thumbnail, name, subscribers, Track button). URL entry preserved as collapsed fallback ("Add by URL instead"). New `trackSearchedCreator` server action bypasses URL validation. New `searchChannels` function in `youtube/client.ts`. 500ms debounce + explicit submit only (quota protection).

---

## Deferred Ideas

- Contradiction check redesign → Phase 14
- Creator profile display on creator card → Phase 12
- Backfill old creator strategies → user-triggered (Refresh per creator)

---

*All decisions made by Claude. User delegated fully.*
