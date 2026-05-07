# Phase 3: Transcript Pipeline - Pattern Map

**Mapped:** 2026-05-07
**Files analyzed:** 13 new + 3 modified
**Analogs found:** 11 / 13 (2 greenfield — no analog)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `pulse/src/app/api/refresh/[creatorId]/route.ts` | API route (POST + GET) | request-response + long-running pipeline | `pulse/src/app/dashboard/creator-actions.ts` (auth + service-role pattern only) | role-mismatch (greenfield API route) |
| `pulse/src/lib/pipeline/transcript-pipeline.ts` | service / orchestrator | sequential batch | `pulse/src/app/dashboard/creator-actions.ts` (service-role + Supabase pattern) | partial — no orchestrator analog |
| `pulse/src/lib/youtube/client.ts` | infra client (singleton) | request-response (external API) | `pulse/src/lib/supabase/service.ts` | role-match (singleton client) |
| `pulse/src/lib/openai/client.ts` | infra client (singleton) | request-response (external API) | `pulse/src/lib/supabase/service.ts` | role-match (singleton client) |
| `pulse/src/lib/pinecone/client.ts` | infra client (singleton) | request-response (external API) | `pulse/src/lib/supabase/service.ts` | role-match (singleton client) |
| `pulse/src/lib/pipeline/chunker.ts` | utility (pure fn) | transform | `pulse/src/lib/tax-year.ts` | role-match (pure utility module) |
| `pulse/src/app/dashboard/refresh-button.tsx` | client component | event-driven (button → fetch loop) | `pulse/src/app/dashboard/creators-tab.tsx` (toggle + useTransition pattern) | role-match (interactive button) |
| `pulse/src/app/dashboard/transcript-list.tsx` | client component (expand/collapse) | display | `pulse/src/components/PortfolioTab.tsx` (state-driven list) | role-match |
| `pulse/src/app/dashboard/creators-tab.tsx` | **MODIFIED** client component | event-driven | self (Phase 2 layout) | exact — extends existing |
| `pulse/src/app/dashboard/page.tsx` | **MODIFIED** server component | data-fetch | self (existing creators-tab data fetch block) | exact — adds transcripts + last_refreshed_at fetch |
| `pulse/src/types/index.ts` | **MODIFIED** types | n/a | self | exact — adds `lastRefreshedAt` to `UserCreator` |
| `.planning/phases/03-transcript-pipeline/migration.sql` | SQL migration snippet | DDL | `.planning/phases/01-foundation/schema.sql` | role-match (Supabase SQL editor format) |
| `pulse/.env.local.example` (or docs) | config | n/a | existing `.env.local` shape | role-match |

---

## Pattern Assignments

### 1. `pulse/src/lib/youtube/client.ts` (infra client, singleton)

**Analog:** `pulse/src/lib/supabase/service.ts`

**Imports + module guard pattern** (`service.ts` lines 1-2):
```typescript
import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
```

**Singleton + env-var-guard pattern** (`service.ts` lines 10-25):
```typescript
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. ' +
      'Add it to .env.local to enable custom creator creation. ' +
      'Find it in Supabase Dashboard → Settings → API → service_role key.'
    )
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false },
  })
}
```

**Apply this pattern to youtube/client.ts:**
- First line: `import 'server-only'` (mandatory — keys must not leak to client bundle)
- Read `process.env.YOUTUBE_API_KEY` (no `NEXT_PUBLIC_` prefix per RESEARCH.md security)
- Throw informative error if missing (matches the project's "tell user how to fix" idiom)
- Export `getYouTubeClient()` returning the `googleapis` `youtube` instance
- Add helper(s): `resolveChannelId(url)`, `listVideosLast12Months(channelId)` — co-located in same file (matches project convention of putting helpers next to the client factory)

---

### 2. `pulse/src/lib/openai/client.ts` (infra client, singleton)

**Analog:** `pulse/src/lib/supabase/service.ts` (same as above)

**Apply:**
- `import 'server-only'` first line
- Read `process.env.OPENAI_API_KEY`, throw with setup instructions if missing
- Singleton OpenAI instance
- Co-located helper `embedChunks(chunks: string[]): Promise<number[][]>` per RESEARCH Pattern 7

---

### 3. `pulse/src/lib/pinecone/client.ts` (infra client, singleton)

**Analog:** `pulse/src/lib/supabase/service.ts`

**Apply:**
- `import 'server-only'` first line
- Read `PINECONE_API_KEY` and `PINECONE_INDEX_NAME` env vars (both no `NEXT_PUBLIC_` prefix)
- Singleton `Pinecone` instance per RESEARCH Pattern 8
- Helper `getPineconeNamespace(creatorId)` returning `pc.index(name).namespace(creatorId)`

---

### 4. `pulse/src/lib/pipeline/chunker.ts` (utility, pure transform)

**Analog:** `pulse/src/lib/tax-year.ts`

**Pure-function module pattern** (`tax-year.ts` lines 1-30):
```typescript
/**
 * UK ISA Tax Year Utilities
 *
 * UK tax year runs 6 April – 5 April.
 * Format: 'YYYY-YY' e.g. '2025-26' for 6 Apr 2025 – 5 Apr 2026.
 *
 * D-15: Tax year boundary is strictly 6 April.
 * CLAUDE.md: ISA calculations use UK tax year (not calendar year).
 */

export function getTaxYearForDate(date: Date | string): string {
  // ... pure logic, no side effects, no I/O
}
```

**Apply to chunker.ts:**
- Top-of-file JSDoc explaining purpose + the rule (`cl100k_base` for `text-embedding-3-small`)
- Pure functions only — `chunkText(text, chunkSize=500, overlap=50): string[]`
- No `import 'server-only'` (it's just deterministic JS — but `js-tiktoken` is server-only in practice)
- Cite the project decision: "RESEARCH Pattern 6 — token-aware chunking"

---

### 5. `pulse/src/lib/pipeline/transcript-pipeline.ts` (orchestrator)

**Analog:** `pulse/src/app/dashboard/creator-actions.ts` (service-role usage + auth-check pattern)

**Imports pattern** (`creator-actions.ts` lines 1-3):
```typescript
'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
```

**Service-role escalation pattern when DB write requires bypassing RLS** (`creator-actions.ts` lines 86-100):
```typescript
// creators table has no authenticated INSERT policy — requires service role
const { createServiceClient } = await import('@/lib/supabase/service')
const serviceClient = createServiceClient()

const { data: newCreator, error: insertError } = await serviceClient
  .from('creators')
  .insert({ channel_url: rawUrl, display_name: displayName, is_active: true })
  .select('id')
  .single()

if (insertError || !newCreator) {
  return { error: 'Something went wrong. Please try again.' }
}
```

**Apply to transcript-pipeline.ts:**
- NOT a server action (no `'use server'`) — it's a plain TS module called from the API Route
- Use `createServiceClient()` (NOT authenticated client) for all `transcripts`, `creators`, `user_creators`, and `refresh_jobs` writes — they all bypass RLS per D-12 / RESEARCH §Architectural Responsibility Map
- Use `.upsert(..., { onConflict: 'video_id' })` for `transcripts` per RESEARCH Pitfall 4
- Wrap each step in try/catch — on YouTube/OpenAI/Pinecone failure, write error string to `refresh_jobs` table with `status='error'` and re-throw to abort
- Wrap each `YoutubeTranscript.fetchTranscript()` in try/catch and INSERT row with `raw_text=NULL` per D-04 (do NOT abort whole pipeline)
- Update `refresh_jobs.step` text BEFORE each major phase via service client (this is what the GET poller reads)
- After all steps succeed: `UPDATE user_creators SET last_refreshed_at = NOW() WHERE user_id = ? AND creator_id = ?` via service client per D-12

---

### 6. `pulse/src/app/api/refresh/[creatorId]/route.ts` (API route)

**Analog:** No existing API route in repo. Closest auth-flow analog: `pulse/src/app/dashboard/creator-actions.ts`.

**Auth-first guard pattern** (`creator-actions.ts` lines 8-11, repeated across every action):
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return { error: 'Something went wrong. Please try again.' }
```

**RLS defence-in-depth pattern** (`creator-actions.ts` lines 33-37 — explicit `user_id` filter beyond RLS):
```typescript
const { error } = await supabase.from('user_creators')
  .delete()
  .eq('creator_id', creatorId)
  .eq('user_id', user.id)   // defence-in-depth: scope to current user beyond RLS
```

**Error-message copy idiom** (project-wide):
```typescript
return { error: 'Something went wrong. Please try again.' }
```

**Apply to route.ts (POST handler):**
1. First line `import 'server-only'` is implicit for route files; declare `export const maxDuration = 300` near the top (RESEARCH Pitfall 1).
2. Validate `creatorId` URL param as UUID (RESEARCH §Security V5) — abort with 400 if not.
3. `const supabase = await createClient()` then `getUser()` — return 401 JSON if no user (mirror `creator-actions.ts` shape but as `NextResponse.json({ error: ... }, { status: 401 })`).
4. Verify `user_creators` row exists for `(user.id, creatorId)` — return 403 if not. This mirrors the explicit `eq('user_id', user.id)` defence-in-depth pattern from `creator-actions.ts:37`.
5. Upsert `refresh_jobs` row to `status='running'` via service client.
6. Run pipeline synchronously (await all steps — RESEARCH Pattern 2 note: fire-and-forget is unsafe on Vercel). The 2s client poll keeps UI alive while POST is in flight.
7. On success: return `NextResponse.json({ status: 'done', summary }, { status: 200 })`.
8. On error: catch, write `status='error'` to `refresh_jobs`, return `NextResponse.json({ error: 'YouTube API error — partial progress saved' }, { status: 500 })` (D-05 copy).

**GET handler:**
- Same auth pattern (`getUser()` + `user_creators` row check).
- Read `refresh_jobs` row via authenticated client (RLS SELECT policy allows it — RESEARCH Pattern 9).
- Return `{ status, step, summary, error }` JSON.

---

### 7. `pulse/src/app/dashboard/refresh-button.tsx` (client component)

**Analog:** `pulse/src/app/dashboard/creators-tab.tsx` (toggle + useTransition + optimistic UI pattern).

**Imports pattern** (`creators-tab.tsx` lines 1-4):
```typescript
'use client'
import { useState, useTransition, useActionState, startTransition } from 'react'
import type { Creator } from '@/types'
import { trackCreator, untrackCreator, addCustomCreator } from '@/app/dashboard/creator-actions'
```

**State + transition pattern** (`creators-tab.tsx` lines 12-15):
```typescript
const [tracked, setTracked] = useState<Set<string>>(new Set(initialTracked))
const [isPending, startT] = useTransition()
const [toggleError, setToggleError] = useState<string | null>(null)
```

**Async action with revert-on-error pattern** (`creators-tab.tsx` lines 38-55):
```typescript
startT(async () => {
  const result = isTracked
    ? await untrackCreator(creatorId)
    : await trackCreator(creatorId)

  if (result.error) {
    // Revert optimistic update
    setTracked((prev) => {
      const next = new Set(prev)
      if (isTracked) next.add(creatorId)
      else next.delete(creatorId)
      return next
    })
    setToggleError(result.error)
  } else {
    setToggleError(null)
  }
})
```

**Button visual style** (`creators-tab.tsx` lines 88-100):
```typescript
<button
  type="button"
  onClick={() => handleToggle(creator.id)}
  disabled={isPending}
  aria-pressed={isTracked}
  className={
    isTracked
      ? 'text-sm font-semibold text-indigo-400 border border-indigo-500/50 rounded-md px-3 min-h-[36px] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-500'
      : 'text-sm font-semibold text-zinc-400 border border-zinc-700 rounded-md px-3 min-h-[36px] hover:border-indigo-500 hover:text-indigo-400 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-500'
  }
>
  {isTracked ? '✓ Tracking' : 'Track'}
</button>
```

**Inline error display pattern** (`creators-tab.tsx` lines 64-68):
```typescript
{toggleError && (
  <p role="alert" aria-live="polite" className="text-sm text-red-400 mb-3">
    {toggleError}
  </p>
)}
```

**Apply to refresh-button.tsx:**
- `'use client'` directive
- `useState` for `status: 'idle' | 'running' | 'done' | 'error'`, `step: string`, `summary: string | null`, `error: string | null`
- On click: `fetch('/api/refresh/' + creatorId, { method: 'POST' })` then start a 2s `setInterval` polling `GET /api/refresh/[creatorId]`
- Clear interval when status flips to `'done'` or `'error'` (D-02)
- Disabled state during `running` matches the existing `disabled={isPending}` idiom
- Step status line below button: `<p className="text-sm text-zinc-400">{step}</p>` — same colour palette as existing `text-zinc-400` text
- Error display via `role="alert" aria-live="polite"` matching `creators-tab.tsx:65`

---

### 8. `pulse/src/app/dashboard/transcript-list.tsx` (client component, expand/collapse)

**Analog:** `pulse/src/components/PortfolioTab.tsx` (state-driven collapsible list)

**State pattern** (`PortfolioTab.tsx` lines 13-18):
```typescript
const [modalOpen, setModalOpen] = useState(false)
const [editingHolding, setEditingHolding] = useState<Holding | undefined>(undefined)
const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
const [budgetEditMode, setBudgetEditMode] = useState(false)
const [isPending, startT] = useTransition()
```

**Status-chip styling pattern** (project-wide; `creators-tab.tsx` lines 95-97 for "tracking" chip):
- "Embedded" → indigo: `text-indigo-400 border border-indigo-500/50 rounded-md`
- "Fetched" → zinc-neutral: `text-zinc-300 border border-zinc-700 rounded-md`
- "Pending" → amber: `text-amber-400 border border-amber-500/50 rounded-md` (match `isa-tab.tsx:39` `text-amber-400` precedent for warning state)

**Apply to transcript-list.tsx:**
- `'use client'` directive
- `useState<boolean>(false)` for expand/collapse
- 3-column layout: Title | Published date | Status chip — use Tailwind grid or flex matching the `flex items-center justify-between py-3 border-b border-zinc-700/50` row pattern from `creators-tab.tsx:81-84`
- Empty-state copy idiom (`creators-tab.tsx:72`): `<p className="text-zinc-400 text-sm py-8 text-center">No transcripts yet. Click Refresh to fetch.</p>`

---

### 9. `pulse/src/app/dashboard/creators-tab.tsx` (MODIFIED)

**Analog:** Self.

**Existing row layout** (lines 79-102) — extend by injecting `<RefreshButton creatorId={creator.id} />` and `<TranscriptList creatorId={creator.id} ... />` only for tracked creators (D-03).

**Layout extension constraint:**
- New refresh + expand toggle must live INSIDE the existing `<li>` for each tracked creator — do not change row identity.
- Expand toggle button next to existing `[Track]` button.
- Expanded panel is a sibling `<div>` below the `<li>`'s flex container (full row width).

---

### 10. `pulse/src/app/dashboard/page.tsx` (MODIFIED)

**Analog:** Self — extends the existing creators-tab data-fetching block.

**Existing creators-tab data block** (`page.tsx` lines 99-116):
```typescript
if (activeTab === 'creators') {
  const [{ data: creatorRows }, { data: trackRows }] = await Promise.all([
    supabase.from('creators').select('*').eq('is_active', true).order('display_name'),
    supabase.from('user_creators').select('creator_id').eq('user_id', user.id),
  ])

  creators = (creatorRows ?? []).map((row) => ({
    id: row.id,
    channelUrl: row.channel_url,
    displayName: row.display_name,
    channelId: row.channel_id ?? null,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }))

  trackedCreatorIds = new Set((trackRows ?? []).map((r) => r.creator_id))
}
```

**Extension requirements:**
1. Change `user_creators` SELECT to also pull `last_refreshed_at`:
   ```typescript
   supabase.from('user_creators').select('creator_id, last_refreshed_at').eq('user_id', user.id)
   ```
2. Build a `Map<creatorId, Date | null>` of last-refreshed timestamps and pass into `<CreatorsTab>`.
3. Fetch transcripts per tracked creator — Promise.all over tracked IDs:
   ```typescript
   const { data: transcriptRows } = await supabase
     .from('transcripts')
     .select('id, creator_id, video_id, title, published_at, raw_text, is_embedded, last_fetched')
     .in('creator_id', Array.from(trackedCreatorIds))
     .order('published_at', { ascending: false })
   ```
4. Map DB rows to `Transcript[]` per the existing snake_case→camelCase pattern (`page.tsx:60-69`).

---

### 11. `pulse/src/types/index.ts` (MODIFIED)

**Analog:** Self.

**Existing UserCreator type** (lines 65-73):
```typescript
export interface UserCreator {
  id: string
  userId: string
  creatorId: string
  trustWeight: number
  createdAt: Date
  creator?: Creator
  categoryWeights?: UserCreatorCategoryWeight[]
}
```

**Add field:**
```typescript
lastRefreshedAt: Date | null   // Phase 3 (D-11) — NULL = never refreshed
```

Insert before `creator?: Creator` to keep optional join fields at the end.

**Optionally add a `RefreshJob` type** (RESEARCH Pattern 9):
```typescript
export interface RefreshJob {
  id: string
  userId: string
  creatorId: string
  status: 'running' | 'done' | 'error' | 'idle'
  step: string | null
  summary: string | null
  error: string | null
  startedAt: Date
  updatedAt: Date
}
```

Place near `Transcript` (lines 124-140) since both relate to Phase 3 pipeline domain.

---

### 12. `.planning/phases/03-transcript-pipeline/migration.sql` (SQL migration)

**Analog:** `.planning/phases/01-foundation/schema.sql`

**Header comment idiom** (`schema.sql` lines 1-7):
```sql
-- =============================================================================
-- Pulse — Complete Database Schema
-- Phase 1: Foundation
-- Deploy via: Supabase SQL Editor (Project → SQL Editor → New query → paste → Run)
-- D-03: No CLI migrations. SQL editor only.
-- =============================================================================
```

**Table + RLS pattern** (`schema.sql` lines 81-97 — `user_creators`):
```sql
CREATE TABLE IF NOT EXISTS public.user_creators (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  creator_id   UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  ...
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, creator_id)
);

ALTER TABLE public.user_creators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own creator list"
  ON public.user_creators FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**Existing transcripts policy idiom** (`schema.sql` lines 217-222):
```sql
CREATE POLICY "Authenticated users can view transcripts"
  ON public.transcripts FOR SELECT
  TO authenticated
  USING (TRUE);

-- INSERT/UPDATE/DELETE handled by app backend (service role); no authenticated policy
```

**Apply to migration.sql:**
- Top header: identical block, but say `Phase 3: Transcript Pipeline` and reference D-11.
- Migration 1: `ALTER TABLE public.user_creators ADD COLUMN IF NOT EXISTS last_refreshed_at TIMESTAMPTZ;` (RESEARCH §Schema Changes Required).
- Migration 2: `CREATE TABLE IF NOT EXISTS public.refresh_jobs ...` exactly as in RESEARCH Pattern 9, including SELECT-only RLS policy ("INSERT/UPDATE handled by service role" comment matching the `transcripts` table idiom).
- Use `IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` for idempotency (matches `schema.sql` style throughout).

---

## Shared Patterns

### Auth Guard (apply to every API Route handler)

**Source:** `pulse/src/app/dashboard/creator-actions.ts:8-11`
**Apply to:** POST and GET handlers in `route.ts`

```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

### Defence-in-depth user scoping (every DB read/write touching user-scoped tables)

**Source:** `pulse/src/app/dashboard/creator-actions.ts:37`, `pulse/src/app/dashboard/actions.ts:56,71`
**Apply to:** Any query against `user_creators`, `refresh_jobs`

Always include `.eq('user_id', user.id)` even when RLS already enforces it. The codebase comments call this "defence-in-depth: scope to current user beyond RLS" — mirror that comment.

### Service-role client gateway (every Phase 3 DB write)

**Source:** `pulse/src/lib/supabase/service.ts` + usage in `creator-actions.ts:88-89`
**Apply to:** All writes to `transcripts`, `creators` (channel_id update), `user_creators.last_refreshed_at`, `refresh_jobs`

```typescript
const { createServiceClient } = await import('@/lib/supabase/service')
const serviceClient = createServiceClient()
```

The dynamic `await import()` style is the project convention — preserves bundle splitting since service client should never reach client code paths.

### Error message copy

**Source:** Project-wide; `creator-actions.ts:11`, `actions.ts:12`
**Apply to:** All user-facing error responses

Generic catchall: `'Something went wrong. Please try again.'`
Specific Phase 3 strings (Claude's Discretion per CONTEXT D-05):
- `'YouTube API error — partial progress saved'` (D-05 explicit copy)
- `'Transcript service unavailable. Please try again.'`

### Snake_case ↔ camelCase mapping

**Source:** `pulse/src/app/dashboard/page.tsx:42-49,60-69,84-92,105-113`
**Apply to:** Every place a Supabase row is converted to a domain type

```typescript
holdings = (rows ?? []).map((row) => ({
  id: row.id,
  userId: row.user_id,
  ticker: row.ticker,
  category: row.category,
  quantity: new Decimal(row.quantity),
  currentValue: new Decimal(row.current_value),
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
}))
```

For `Transcript[]` and `RefreshJob` row → domain conversions, follow the same `(rows ?? []).map((row) => ({ ... }))` shape.

### Tailwind dark-zinc theme

**Source:** project-wide; `page.tsx:125`, `creators-tab.tsx:108`
**Apply to:** `refresh-button.tsx`, `transcript-list.tsx`, any new UI

- Container background: `bg-zinc-800 border border-zinc-700 rounded-xl` (cards) or `bg-zinc-800/50 border border-zinc-700 rounded-lg` (sub-panels)
- Text: `text-white` (primary), `text-zinc-400` (secondary), `text-zinc-300` (tertiary)
- Accent: `text-indigo-400`, `border-indigo-500/50`, `bg-indigo-500 hover:bg-indigo-400`
- Error: `text-red-400`
- Warning/pending: `text-amber-400` (precedent: `isa-tab.tsx:39`)
- Min touch target: `min-h-[44px]` on buttons, `min-h-[36px]` on small chips
- Focus ring: `focus:outline-none focus:ring-2 focus:ring-indigo-500`

### Accessible alerts

**Source:** `creators-tab.tsx:65-67`, `actions.ts` users
**Apply to:** Any error message in `refresh-button.tsx`

```tsx
<p role="alert" aria-live="polite" className="text-sm text-red-400 mb-3">
  {error}
</p>
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `pulse/src/app/api/refresh/[creatorId]/route.ts` | Next.js Route Handler | request-response | No existing API routes in repo. All prior phases used server actions. Follow RESEARCH Pattern 2 + auth/error idioms from `creator-actions.ts`. |
| `pulse/src/lib/pipeline/transcript-pipeline.ts` | sequential pipeline orchestrator | batch transform | No existing orchestrator pattern. Compose using service-client + try/catch idioms from `creator-actions.ts` plus RESEARCH Patterns 3-9. |

For both, the planner should treat RESEARCH.md as the primary pattern source while still following the project's auth, service-role, error-copy, and snake/camel mapping idioms cited above.

---

## Metadata

**Analog search scope:**
- `pulse/src/app/**` (auth, dashboard, components)
- `pulse/src/lib/**` (supabase clients, tax-year utility)
- `pulse/src/types/index.ts`
- `.planning/phases/01-foundation/schema.sql`
- `pulse/package.json` (verify no existing youtube/openai/pinecone deps — confirmed none)

**Files scanned:** 18

**Key insights:**
- Project has zero API routes today — Phase 3 introduces the first one. Borrow auth + error idioms from server actions.
- Service-role client (`service.ts`) is the canonical RLS-bypass pattern; reuse for all transcripts/refresh_jobs/creators writes.
- Snake_case → camelCase mapping is hand-rolled per query in `page.tsx`; new transcript and refresh_jobs reads must follow the same `(rows ?? []).map(...)` shape.
- Status chips and tab UI use a tight zinc-800/700 + indigo-400 palette — strictly reuse, do not introduce new colours.
- All SQL migrations are applied via Supabase SQL editor only (D-03); migration file is documentation, not executed code.

**Pattern extraction date:** 2026-05-07
