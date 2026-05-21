# Phase 13: Market News Integration — Research

**Researched:** 2026-05-20
**Domain:** REST news APIs (Finnhub), RSS parsing (rss-parser), Supabase caching schema, Anthropic structured output
**Confidence:** HIGH (stack decisions) / MEDIUM (Finnhub LSE coverage specifics)

---

## Summary

Phase 13 adds two data streams — ticker-specific news (Finnhub REST) and UK macro news (BBC/Reuters/BoE RSS) — then routes both through a Claude structured-output call to produce (a) per-ticker news counts for the WatchListTab badge column and (b) a "this month's context" paragraph surfaced in the Watch List header. All refresh is user-triggered in v1; NEWS-07's "daily" language is reinterpreted as a 24-hour Supabase cache TTL, not a cron job.

The codebase already has the `@anthropic-ai/sdk` 0.95+, Supabase clients (user + service roles), and a server-actions pattern. Phase 13 follows the same Wave 0 → Wave 1 → Wave 2 structure used in Phases 11–12: SQL migration Wave 0, data-layer Wave 1, UI Wave 2.

The single hardest decision is Finnhub LSE coverage on the free tier: evidence is inconsistent. The safest plan is to treat Finnhub as a US-primary source and use the general `market-news` endpoint (category `general`) plus manual keyword filtering against ticker symbols, rather than the `company-news` endpoint (which needs an exchange-prefixed symbol Finnhub may not resolve for LSE tickers on free tier). This is flagged as ASSUMED below.

**Primary recommendation:** Finnhub market-news (general) + rss-parser for BBC/BoE feeds; Supabase `news_cache` table as the single source of truth for all cached news; Claude `generate_news_context` tool for structured summary; 24-hour Supabase TTL enforced in the fetch action.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| News fetch (Finnhub REST) | API / Backend (server action) | — | API key must not reach browser; rate-limit logic lives server-side |
| RSS feed fetch + parse | API / Backend (server action) | — | CORS restrictions + server-only import of rss-parser |
| News cache (TTL) | Database / Storage (Supabase) | — | Survives server restarts; user can see last-cached data on page load |
| Claude context summary | API / Backend (server action) | — | Anthropic SDK is server-only; prompt includes sensitive ticker list |
| News flag badge (count) | Frontend (WatchListTab) | API / Backend | Count fetched server-side on demand; displayed client-side in ticker row |
| Macro news panel | Frontend (WatchListTab) | — | Rendered from cached summary; "Refresh" button triggers server action |

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NEWS-01 | Finnhub or Alpha Vantage ticker news for watch list items | Finnhub free tier confirmed; rss-parser for RSS feeds; Finnhub general market-news endpoint recommended (see Pitfall 1 on LSE coverage) |
| NEWS-02 | RSS feeds: BBC Business, Reuters UK, Bank of England, ONS | BBC feed URL confirmed; BoE RSS confirmed; Reuters URL noted; all parseable via rss-parser |
| NEWS-03 | AI cross-references news vs watch list tickers + creator sectors | Claude tool-use pattern from extractor.ts reusable; generate_news_context tool schema documented below |
| NEWS-04 | News flag per watch list item — count of relevant stories | Badge column added to WatchListTab ticker rows; count derived from AI cross-reference output |
| NEWS-05 | Creator card shows macro conditions for backed sectors | Panel below creator header in WatchListTab; data from cached context summary |
| NEWS-06 | "This month's context" summary — 3-4 sentences, AI-generated; refreshes daily; regenerates on demand | Supabase news_context_cache table with fetched_at TTL; manual refresh server action |
| NEWS-07 | News refresh daily; macro summary weekly or on-demand | Resolved: user-triggered refresh; Supabase 24h/7d TTL cache — not a cron job (v1 manual-first constraint) |
</phase_requirements>

---

## Standard Stack

### Core (no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | 0.95.0 (installed) | Generate context summary via tool use | Already in project; same pattern as extractor.ts |
| `@supabase/supabase-js` | 2.105.3 (installed) | Cache read/write for news + summary | Already in project |

### New Install Required

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `rss-parser` | 3.13.0 | Parse BBC/BoE/Reuters RSS feeds | Lightweight, promise-based, no browser requirement; widely used in Next.js SSR |

**No Finnhub client library needed** — Finnhub REST is a plain `fetch()` call with `?token=` param. The `finnhub` npm package (2.0.14) is optional scaffolding; direct fetch is cleaner and avoids a dependency.

**Installation:**
```bash
cd pulse && npm install rss-parser
npm install --save-dev @types/rss-parser  # only if types not bundled
```

Check: rss-parser 3.13.0 bundles its own TypeScript types (`types/index.d.ts`) — `@types/rss-parser` is NOT needed. [VERIFIED: npm registry — `npm view rss-parser` lists `types` field]

### Version Verification

```bash
npm view rss-parser version   # 3.13.0
npm view finnhub version      # 2.0.14 — not installing; documenting for reference
```

---

## Architecture Patterns

### System Architecture Diagram

```
User clicks "Refresh News"
        │
        ▼
refreshNewsAndSummary() [server action]
        │
        ├─── fetchFinnhubMarketNews()      → Finnhub REST /news?category=general
        │         (60 req/min free tier)
        │
        ├─── fetchRssFeeds()               → BBC/BoE/Reuters RSS via rss-parser
        │         (no API key; rate-limit: polite fetch)
        │
        ▼
  raw headlines [ ]  (title + url + publishedAt + source)
        │
        ▼
  crossReferenceNews()  [Claude call — generate_news_context tool]
        │   input: headlines[ ], watch_list_tickers[ ], creator_sectors[ ]
        │   output: { ticker_counts: {AAPL: 3}, context_summary: "...", macro_themes: [] }
        │
        ▼
  Supabase news_cache table
  ┌──────────────────────────────────────────┐
  │  user_id | headlines_json | summary_json │
  │  fetched_at (TTL anchor)                 │
  └──────────────────────────────────────────┘
        │
        ▼
  WatchListTab renders:
    - Badge column "N news" on each ticker row  (from ticker_counts)
    - "This Month's Context" panel              (from context_summary)
    - Sector macro notes under creator header   (from macro_themes)
```

### Recommended Project Structure

```
pulse/src/
├── lib/
│   └── news/
│       ├── finnhub.ts          # fetchFinnhubMarketNews() — Finnhub REST fetch
│       ├── rss.ts              # fetchRssFeeds() — rss-parser wrapper
│       └── news-types.ts       # NewsHeadline, NewsCacheRow, NewsContextResult
├── app/
│   └── dashboard/
│       ├── news-actions.ts     # refreshNewsAndSummary() — orchestrator server action
│       └── components/
│           └── WatchListTab.tsx  # extended with news column + context panel
└── tests/
    ├── news-cache.test.ts      # TTL logic, headline dedup (unit)
    └── news-context.test.ts    # Claude tool schema shape (unit)
```

### Pattern 1: Finnhub Market News via Plain Fetch

**What:** Direct `fetch()` to Finnhub REST — no client library. Token in env var. Rate limit: 60 calls/min free tier. [VERIFIED: WebSearch → finnhub.io/docs/api/rate-limit, publicapis.io]

```typescript
// Source: finnhub.io/docs/api/market-news
// lib/news/finnhub.ts
import 'server-only'

export interface FinnhubNewsItem {
  headline: string
  url: string
  datetime: number   // Unix timestamp
  source: string
  related: string    // comma-separated tickers (may be empty for general news)
}

export async function fetchFinnhubMarketNews(): Promise<FinnhubNewsItem[]> {
  const token = process.env.FINNHUB_API_KEY
  if (!token) throw new Error('FINNHUB_API_KEY not set')

  const url = `https://finnhub.io/api/v1/news?category=general&token=${token}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Finnhub returned ${res.status}`)
  return res.json() as Promise<FinnhubNewsItem[]>
}
```

**Why general endpoint, not company-news:** Finnhub `company-news` requires a symbol like `AAPL` (US format). LSE tickers on free tier have unclear exchange-prefix requirements (e.g., `VWRL.L`, `LSE:VWRL`, or just `VWRL`). The `market-news?category=general` endpoint returns headlines with a `related` field containing ticker mentions — Claude cross-referencing handles the mapping to watch list tickers without needing per-ticker API calls. This also stays within the 60 req/min limit regardless of watch list size. [ASSUMED — LSE company-news coverage on free tier unverified; see Assumptions Log]

### Pattern 2: RSS Feed Parsing via rss-parser

**What:** `rss-parser` fetches and parses RSS XML into JS objects. Promise-based, Node-compatible (not browser). [VERIFIED: npm registry + WebSearch → multiple Next.js articles]

```typescript
// Source: npmjs.com/package/rss-parser
// lib/news/rss.ts
import 'server-only'
import Parser from 'rss-parser'

const parser = new Parser({
  timeout: 8000,  // 8s timeout; RSS feeds can be slow
  headers: { 'User-Agent': 'Pulse/1.0 (personal ISA planning tool)' },
})

export interface RssItem {
  title: string
  link: string
  pubDate: string   // ISO or RFC 2822 string
  source: string    // injected by caller
}

const RSS_FEEDS: Array<{ url: string; source: string }> = [
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', source: 'BBC Business' },
  { url: 'https://www.bankofengland.co.uk/rss/news', source: 'Bank of England' },
  // Reuters UK: no stable free RSS URL as of 2026 — see Open Questions
]

export async function fetchRssFeeds(): Promise<RssItem[]> {
  const results = await Promise.allSettled(
    RSS_FEEDS.map(async ({ url, source }) => {
      const feed = await parser.parseURL(url)
      return (feed.items ?? []).slice(0, 20).map((item) => ({
        title: item.title ?? '',
        link: item.link ?? '',
        pubDate: item.pubDate ?? new Date().toISOString(),
        source,
      }))
    })
  )

  return results
    .filter((r): r is PromiseFulfilledResult<RssItem[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value)
}
```

### Pattern 3: Claude generate_news_context Tool

**What:** Single Claude call with `tool_choice: { type: 'tool', name: 'generate_news_context' }` produces structured output — same pattern as `extract_creator_profile` in extractor.ts. [VERIFIED: project codebase extractor.ts + WebSearch → Anthropic structured-outputs docs]

Token budget guidance: Pass 30–50 headlines (title only, no body text). Watch list is at most ~20 tickers. Total input fits well within 8k tokens. No RAG/Pinecone lookup needed — headlines are already short-form text.

```typescript
// Source: @anthropic-ai/sdk pattern from pulse/src/lib/strategy/extractor.ts
// app/dashboard/news-actions.ts

const NEWS_CONTEXT_TOOL: Anthropic.Tool = {
  name: 'generate_news_context',
  description: 'Cross-reference news headlines against a watch list and produce a summary.',
  input_schema: {
    type: 'object' as const,
    properties: {
      ticker_counts: {
        type: 'object',
        description: 'Map of ticker → number of relevant headlines mentioning or relating to that ticker/company.',
        additionalProperties: { type: 'integer' },
      },
      macro_themes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            sector: { type: 'string' },
            theme: { type: 'string' },
            sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
          },
          required: ['sector', 'theme', 'sentiment'],
        },
        description: 'Key macro themes relevant to the tracked sectors.',
      },
      context_summary: {
        type: 'string',
        description: '3-4 sentences combining creator signals and current macro news. No financial advice language.',
      },
    },
    required: ['ticker_counts', 'macro_themes', 'context_summary'],
  },
}

const NEWS_SYSTEM_PROMPT = `You are analysing recent financial news headlines to identify themes \
relevant to an investor's watch list. Cross-reference the headlines against the provided tickers \
and sectors. Count how many headlines are relevant to each ticker (by direct mention or company name). \
Identify macro themes affecting the tracked sectors. Write a 3-4 sentence context summary describing \
current market conditions relevant to the watch list. Use observational language only — describe what \
the news covers. Do not use the words "advice", "recommend", or "suggest".`
```

**Estimated cost per call (claude-sonnet-4-6):** ~3–5k input tokens (50 headlines + tickers list) + ~500 output tokens = approx $0.005 per refresh. Acceptable for user-triggered manual refresh. [ASSUMED — token estimate based on typical headline length; not measured]

### Pattern 4: Supabase Cache Table (TTL Pattern)

**What:** Single `news_cache` table stores the full serialized output (headlines JSONB + summary JSONB) with `fetched_at` timestamp. The server action checks age before re-fetching. [CITED: Supabase docs on JSONB + timestamptz patterns]

```sql
-- Wave 0 migration (user runs in Supabase SQL Editor)
CREATE TABLE IF NOT EXISTS public.news_cache (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  headlines     JSONB NOT NULL DEFAULT '[]',
  context       JSONB NOT NULL DEFAULT '{}',
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT news_cache_user_unique UNIQUE (user_id)
);

ALTER TABLE public.news_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own cache" ON public.news_cache
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user upserts own cache" ON public.news_cache
  FOR ALL USING (auth.uid() = user_id);
```

**TTL enforcement (server action logic):**
```typescript
const HEADLINES_TTL_MS = 24 * 60 * 60 * 1000     // 24h — resolves NEWS-07
const SUMMARY_TTL_MS   = 7 * 24 * 60 * 60 * 1000  // 7d  — resolves NEWS-07 macro

async function isCacheStale(fetchedAt: Date, ttlMs: number): boolean {
  return Date.now() - fetchedAt.getTime() > ttlMs
}
```

**Why Supabase table over Next.js `unstable_cache`:** Supabase persists across restarts and is user-scoped (each user gets their own cached view). `unstable_cache` is process-local and being deprecated in Next.js 16. For a personal-use tool where one user refreshes infrequently, a single UPSERT row per user is ideal. [VERIFIED: NextJS docs unstable_cache deprecation note; Supabase docs on JSONB]

### Pattern 5: News Flag Badge in WatchListTab

**What:** On page load, read cached `ticker_counts` from the `news_cache` row (no new fetch). Display as a small badge `"3 news"` in a new column next to the ticker. Badge is loaded with the page — no blocking on demand fetch.

```typescript
// In page.tsx (RSC) — if activeTab === 'watchlist', also read news_cache:
const { data: newsRow } = await supabase
  .from('news_cache')
  .select('context, fetched_at')
  .eq('user_id', user.id)
  .maybeSingle()

const tickerCounts: Record<string, number> =
  (newsRow?.context as { ticker_counts?: Record<string, number> })?.ticker_counts ?? {}
```

Pass `tickerCounts` and `contextSummary` as props to `WatchListTab`. No separate fetch route needed — cached data is cheap to read. "Refresh News" button triggers the server action which re-fetches, re-summarises, and calls `revalidatePath('/dashboard')`.

### Anti-Patterns to Avoid

- **Per-ticker Finnhub company-news calls:** 10 tickers × 1 call = 10 Finnhub requests per refresh. The general endpoint returns the same set in 1 call. Never do N ticker API calls in a loop. Use the general `market-news` endpoint + keyword matching in the Claude prompt.
- **Storing full article body text:** RSS items and Finnhub headlines include full descriptions. Only pass `title` to Claude — not description or body. This keeps token cost predictable.
- **Using `unstable_cache` for news:** Process-local, not user-scoped, deprecated in Next.js 16. Supabase table is the right store.
- **Auto-firing news refresh on tab switch:** v1 constraint — manual refresh only. Never call `refreshNewsAndSummary` automatically on tab render. User must click a button.
- **Advice language in context_summary:** Claude's system prompt must forbid "advice", "recommend", "suggest". Add `if (summary.includes('recommend')) throw` as a post-call guard.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RSS XML parsing | Custom DOMParser / regex | `rss-parser` npm package | Atom vs RSS 2.0 differences, date parsing edge cases, CDATA handling |
| News structured extraction | Manual JSON.parse on Claude text output | `tool_choice: { type: 'tool' }` on Claude | Guaranteed schema compliance; same pattern already in extractor.ts |
| TTL expiry | Custom in-memory LRU cache | Supabase `fetched_at` timestamp check | Survives restarts; per-user scoping built-in; RLS protects rows |
| Finnhub ticker mapping | Build a symbol lookup table | Claude prompt cross-referencing | Headlines mention company names, not symbols; Claude resolves ambiguity |

---

## Common Pitfalls

### Pitfall 1: Finnhub Company-News LSE Symbol Format
**What goes wrong:** `GET /company-news?symbol=VWRL` returns 0 results. LSE tickers on Finnhub may need format `VWRL.L`, `LSE:VWRL`, or may not be covered on the free tier at all.
**Why it happens:** Finnhub's free tier is US-centric. International coverage is confirmed for paid plans; free tier coverage of non-US exchanges is undocumented/inconsistent. [ASSUMED — not verified against live Finnhub API]
**How to avoid:** Use `market-news?category=general` endpoint (returns general financial headlines regardless of exchange). Let Claude do the ticker-to-headline matching in the prompt.
**Warning signs:** If Finnhub company-news returns consistently empty arrays for VWRL, HSBA, etc., switch to the general endpoint immediately.

### Pitfall 2: BBC RSS Feed CORS / Encoding
**What goes wrong:** `rss-parser.parseURL` fails with CORS error or encoding issues on the BBC feed.
**Why it happens:** CORS only affects browser-side fetches. Since `rss.ts` is marked `'server-only'`, there is no CORS issue. BBC RSS is UTF-8. Not a real risk if server-only import is enforced.
**How to avoid:** Always mark `lib/news/rss.ts` with `import 'server-only'`.

### Pitfall 3: Reuters UK RSS URL Instability
**What goes wrong:** Reuters has restructured their RSS feeds multiple times. No stable free RSS URL confirmed as of 2026.
**Why it happens:** Reuters moved to a paid API model for news data.
**How to avoid:** Launch Phase 13 with BBC Business + BoE only. Add Reuters as an Open Question. Attempt `https://feeds.reuters.com/reuters/UKbusinessNews` — if 404, drop Reuters from the feed list. ONS (Office for National Statistics) is an alternative: `https://www.ons.gov.uk/feeds/rss/ons-rss-feed.xml`. [ASSUMED — Reuters URL not verified live]

### Pitfall 4: news_cache UPSERT Race Condition
**What goes wrong:** User double-clicks "Refresh News" — two server actions run concurrently and both try to upsert the same row.
**Why it happens:** No optimistic lock on the cache row.
**How to avoid:** Use Supabase UPSERT with `onConflict: 'user_id'` which is atomic. In the client, disable the Refresh News button during the pending state (same `disabled={pending}` pattern as price refresh in WatchListTab).

### Pitfall 5: Claude Summary Contains Advice Language
**What goes wrong:** The `context_summary` field in Claude's output contains "I recommend" or "this suggests you should buy".
**Why it happens:** Without explicit instruction, Claude defaults to helpful framing.
**How to avoid:** System prompt explicitly forbids advice language. Add a post-call string guard:
```typescript
const FORBIDDEN = ['recommend', 'advice', 'suggest', 'you should']
if (FORBIDDEN.some(w => summary.toLowerCase().includes(w))) {
  throw new Error('Summary contains advice language — regenerate')
}
```

### Pitfall 6: rss-parser Timeout on Slow BoE Feed
**What goes wrong:** BoE RSS sometimes takes >10s to respond, causing the server action to appear to hang.
**Why it happens:** Government RSS feeds have inconsistent latency.
**How to avoid:** Set `timeout: 8000` in the rss-parser constructor. Use `Promise.allSettled` (not `Promise.all`) so a slow feed doesn't block the others.

---

## Code Examples

### Finnhub Market News Fetch

```typescript
// Source: finnhub.io/docs/api/market-news (confirmed endpoint structure)
const res = await fetch(
  `https://finnhub.io/api/v1/news?category=general&token=${process.env.FINNHUB_API_KEY}`,
  { cache: 'no-store' }
)
const items: FinnhubNewsItem[] = await res.json()
```

### rss-parser Initialisation (server-only)

```typescript
// Source: npmjs.com/package/rss-parser v3.13.0
import Parser from 'rss-parser'
const parser = new Parser({ timeout: 8000 })
const feed = await parser.parseURL('https://feeds.bbci.co.uk/news/business/rss.xml')
// feed.items[].title, feed.items[].link, feed.items[].pubDate
```

### Supabase UPSERT for news_cache

```typescript
// Source: supabase.com/docs/reference/javascript/upsert
await supabase
  .from('news_cache')
  .upsert(
    { user_id: user.id, headlines: headlinesJson, context: contextJson, fetched_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  )
```

### Claude Tool Call (same pattern as extractor.ts)

```typescript
// Source: pulse/src/lib/strategy/extractor.ts (existing pattern)
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  system: NEWS_SYSTEM_PROMPT,
  tool_choice: { type: 'tool', name: 'generate_news_context' },
  tools: [NEWS_CONTEXT_TOOL],
  messages: [{ role: 'user', content: userPrompt }],
})
const toolUse = response.content.find(b => b.type === 'tool_use')
const result = toolUse?.input as NewsContextResult
```

---

## DB Schema Changes

### New Table: `news_cache`

```sql
-- One row per user. UPSERT on refresh.
CREATE TABLE IF NOT EXISTS public.news_cache (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  headlines  JSONB NOT NULL DEFAULT '[]',   -- FinnhubNewsItem[] + RssItem[]
  context    JSONB NOT NULL DEFAULT '{}',   -- NewsContextResult (ticker_counts, macro_themes, context_summary)
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT news_cache_user_unique UNIQUE (user_id)
);
ALTER TABLE public.news_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user manages own news cache" ON public.news_cache
  FOR ALL USING (auth.uid() = user_id);
```

### No Changes to Existing Tables

`creator_strategies`, `user_creators`, `holdings`, and all other Phase 11/12 tables are untouched. News data is self-contained in `news_cache`.

---

## Environment Variables Required

```bash
FINNHUB_API_KEY=<free tier key from finnhub.io>
# Existing vars untouched: ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

---

## NEWS-07 Conflict Resolution

> NEWS-07 says "daily refresh" — but v1 is manual-first (no background jobs).

**Resolved:** "Daily refresh" is implemented as a **24-hour Supabase TTL**. When the user navigates to the Watch List tab, the page reads the cached `news_cache` row and shows a staleness indicator if `fetched_at` is >24h ago. The user can trigger a refresh via the "Refresh News" button. There is no cron job, no background task, and no automated polling. This satisfies the spirit of NEWS-07 (data is at most 24h stale) while respecting the v1 manual-first constraint.

Macro summary TTL is 7 days (NEWS-07: "weekly or on-demand"). Same Supabase row — same user-triggered pattern.

---

## RSS Feed URL Reference

| Source | URL | Status |
|--------|-----|--------|
| BBC Business | `https://feeds.bbci.co.uk/news/business/rss.xml` | CONFIRMED [CITED: feedspot.com/bbc_rss_feeds, feeder.co BBC Business] |
| Bank of England | `https://www.bankofengland.co.uk/rss/news` | CONFIRMED [CITED: bankofengland.co.uk/rss] |
| Reuters UK Business | Unknown — likely `https://feeds.reuters.com/reuters/UKbusinessNews` | UNCONFIRMED [ASSUMED] — test at plan execution |
| ONS (fallback for Reuters) | `https://www.ons.gov.uk/feeds/rss/ons-rss-feed.xml` | [ASSUMED] — not verified live |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `unstable_cache` for data caching | `use cache` directive (Next.js 16) | Next.js 16 | Not applicable yet — project is on Next.js 15.5.16; continue using Supabase table instead of either |
| Alpha Vantage NEWS_SENTIMENT (25 req/day free) | Finnhub market-news (60 req/min free) | — | Alpha Vantage's free tier is too restrictive for interactive use; Finnhub is the better free option |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Finnhub company-news endpoint does not reliably return results for LSE tickers (VWRL, HSBA, etc.) on the free tier | Architecture Patterns → Pattern 1 | If wrong, we could use company-news for more precise per-ticker matching. Low risk — general endpoint still works. |
| A2 | Reuters UK RSS URL is `https://feeds.reuters.com/reuters/UKbusinessNews` | RSS Feed URL Reference | If wrong (404), drop Reuters feed. BBC + BoE is sufficient for UK macro context. |
| A3 | ONS RSS feed URL is `https://www.ons.gov.uk/feeds/rss/ons-rss-feed.xml` | RSS Feed URL Reference | If wrong, drop ONS as a feed source. Optional fallback only. |
| A4 | Claude context summary costs ~$0.005 per user-triggered refresh | Architecture Patterns → Pattern 3 | If token usage is higher (e.g., large watch lists with long sector descriptions), cost could be 2–3x. Still acceptable for personal-use manual refresh. |
| A5 | rss-parser 3.13.0 bundles its own TypeScript types (`@types/rss-parser` not needed) | Standard Stack | If wrong, add `@types/rss-parser` to devDependencies. Minor. |

---

## Open Questions

1. **Reuters UK RSS URL**
   - What we know: Reuters restructured RSS in 2022–2023. No confirmed stable free URL.
   - What's unclear: Whether a public Reuters UK business RSS still exists in 2026.
   - Recommendation: In Wave 0, document both BBC and BoE as confirmed feeds. Add Reuters URL as a `// TODO: verify` in rss.ts. Test in Wave 1 execution; if 404, replace with ONS.

2. **Finnhub LSE Coverage (company-news vs market-news)**
   - What we know: Free tier confirmed for US stocks at 60 req/min. International coverage confirmed on paid plans. Free tier LSE coverage undocumented.
   - What's unclear: Whether `company-news?symbol=VWRL.L` or `company-news?symbol=LSE:VWRL` returns results on the free tier.
   - Recommendation: Use market-news (general) for v1. If user needs per-ticker precision, a Wave 1 sub-task can probe the company-news endpoint live and document results.

3. **Pinecone sector data for NEWS-03/NEWS-05**
   - What we know: `profile_stable.sector_focus` JSONB column exists (from extractor.ts) — contains `{ sector, stance, rationale }` array.
   - What's unclear: Whether to pass sector names to Claude via DB query or from the watch list props.
   - Recommendation: Read `sector_focus` from `creator_strategies` in the same page.tsx query that reads `profile_stable`/`profile_latest`. Pass as `creator_sectors` to the news-actions server action.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@anthropic-ai/sdk` | NEWS-03, NEWS-06 | Yes | 0.95.0 | — |
| `rss-parser` (npm) | NEWS-02 | Not installed | 3.13.0 (latest) | Install in Wave 0 |
| Finnhub API key | NEWS-01 | Unknown | — | User must obtain free tier key at finnhub.io |
| Supabase (PostgreSQL) | NEWS-06, NEWS-07 | Yes | project-level | — |
| Node.js fetch | NEWS-01 | Yes (Next.js 15) | built-in | — |

**Missing dependencies with no fallback:**
- `FINNHUB_API_KEY` env var — planner must include Wave 0 task: "Obtain Finnhub free tier key + add to `.env.local`"

**Missing dependencies with fallback:**
- `rss-parser` — not installed; add to Wave 0 install step

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.5 |
| Config file | `pulse/vitest.config.ts` |
| Quick run command | `cd pulse && npx vitest run tests/news-cache.test.ts tests/news-context.test.ts` |
| Full suite command | `cd pulse && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NEWS-01 | fetchFinnhubMarketNews returns array of items with title/url/datetime | unit (mock fetch) | `npx vitest run tests/news-cache.test.ts` | No — Wave 0 |
| NEWS-02 | fetchRssFeeds returns items from BBC feed; handles partial failures gracefully | unit (mock rss-parser) | `npx vitest run tests/news-cache.test.ts` | No — Wave 0 |
| NEWS-03 | Claude tool output shape matches NewsContextResult type | unit (tool schema) | `npx vitest run tests/news-context.test.ts` | No — Wave 0 |
| NEWS-04 | ticker_counts keys match watch list tickers | unit | `npx vitest run tests/news-context.test.ts` | No — Wave 0 |
| NEWS-06 | TTL check correctly identifies stale/fresh cache rows | unit | `npx vitest run tests/news-cache.test.ts` | No — Wave 0 |
| NEWS-07 | UPSERT does not create duplicate rows for same user | unit (Supabase mock) | `npx vitest run tests/news-cache.test.ts` | No — Wave 0 |

### Wave 0 Gaps

- [ ] `pulse/tests/news-cache.test.ts` — covers NEWS-01, NEWS-02, NEWS-06, NEWS-07
- [ ] `pulse/tests/news-context.test.ts` — covers NEWS-03, NEWS-04
- [ ] Install `rss-parser`: `cd pulse && npm install rss-parser`
- [ ] SQL migration: `news_cache` table (user runs in Supabase SQL Editor)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Existing `createClient()` auth check in all server actions |
| V3 Session Management | No | — |
| V4 Access Control | Yes | RLS policy on `news_cache` — `auth.uid() = user_id`; same IDOR pattern as watchlist-actions.ts |
| V5 Input Validation | Yes | Validate `FINNHUB_API_KEY` env var is set before fetch; RSS URLs are static constants (not user-supplied) |
| V6 Cryptography | No | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on news_cache read | Info Disclosure | RLS: `auth.uid() = user_id` on SELECT + ALL |
| Finnhub API key leakage | Info Disclosure | Key in server-side env only; never passes through client component |
| Prompt injection via news headline | Tampering | Claude system prompt is static; headlines passed as data (not instructions); Claude's tool_choice forces structured output only |
| RSS URL substitution | Tampering | RSS feed URLs are static constants in server-only module; never user-supplied |

---

## Project Constraints (from CLAUDE.md)

- No advice language — `context_summary` must not contain "advice", "recommend", "suggest". System prompt + post-call guard required.
- Manual-first (v1) — no cron, no background jobs. All news refresh user-triggered.
- RAG pattern for Claude — Phase 13 does NOT use Pinecone (news headlines are short; no RAG step needed). This is an exception: headlines passed directly are well within token budget.
- `decimal.js` — no £ arithmetic in Phase 13. Not applicable.
- ISA tab already removed (Phase 12). Not affected.
- UK ISA tax year — not applicable to news display.

---

## Sources

### Primary (HIGH confidence)
- Project codebase: `pulse/src/lib/strategy/extractor.ts` — Claude tool_choice pattern (tool_use for structured output)
- Project codebase: `pulse/src/app/dashboard/components/WatchListTab.tsx` — existing UI component Phase 13 extends
- Project codebase: `pulse/src/lib/watchlist/generator.ts` — WatchListItem types
- npm registry: `npm view rss-parser` — version 3.13.0 confirmed
- npm registry: `npm view finnhub` — version 2.0.14 (no install needed)
- [bankofengland.co.uk/rss](https://www.bankofengland.co.uk/rss) — BoE RSS hub confirmed
- [Supabase docs — JSONB](https://supabase.com/docs/guides/database/json) — JSONB column patterns

### Secondary (MEDIUM confidence)
- [finnhub.io/docs/api/market-news](https://www.finnhub.io/docs/api/market-news) — market-news endpoint + token param
- [feedspot BBC RSS list](https://rss.feedspot.com/bbc_rss_feeds/) — BBC Business feed URL `feeds.bbci.co.uk/news/business/rss.xml`
- [feeder.co BBC Business](https://feeder.co/discover/f8bfec0743/bbc-co-uk-news-business) — confirms BBC Business feed
- [NextJS docs — unstable_cache](https://nextjs.org/docs/app/api-reference/functions/unstable_cache) — revalidate pattern + deprecation note
- WebSearch: Finnhub free tier 60 req/min, US-primary coverage

### Tertiary (LOW confidence — needs validation)
- Finnhub LSE/company-news coverage on free tier — multiple indirect sources, not verified against live API
- Reuters UK RSS URL — no confirmed stable URL found
- ONS RSS URL — inferred from ONS website structure, not verified live

---

## Metadata

**Confidence breakdown:**
- Standard stack (rss-parser, Supabase cache, Claude tool): HIGH — all verified via codebase + npm
- Architecture (general vs company-news endpoint): MEDIUM — based on indirect evidence about Finnhub free tier
- Pitfalls: HIGH — all grounded in pattern evidence from project codebase
- RSS feed URLs: MEDIUM (BBC/BoE confirmed) / LOW (Reuters/ONS)

**Research date:** 2026-05-20
**Valid until:** 2026-06-20 (Finnhub pricing/tier details change; re-verify LSE coverage if planning delays)
