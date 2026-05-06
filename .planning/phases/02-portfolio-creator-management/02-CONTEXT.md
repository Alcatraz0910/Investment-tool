# Phase 2: Portfolio & Creator Management - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the core management screens inside `/dashboard`: a tabbed UI (Portfolio | Creators | ISA) where the user can manage their holdings (ticker, quantity, £ value, asset category), set a monthly budget, browse and track creators from the curated list or add custom YouTube channels, and log ISA contributions with a running allowance tracker.

Phase ends when all CREATOR-01–04, PORT-01–03, ISA-01, ISA-03 requirements pass.

**Out of scope for Phase 2:**
- Strategy extraction or blending (Phase 4)
- Plan/Buy List generation (Phase 5)
- Trust weight sliders (Phase 4)
- Transcript ingestion (Phase 3)
- Premium glassmorphism UI system (Phase 6)
- Any in-app admin UI — admin manages creators via Supabase console only

</domain>

<decisions>
## Implementation Decisions

### Admin Creator Management
- **D-01:** Admin = developer via Supabase SQL editor. No in-app admin UI, no admin role, no protected admin routes. CREATOR-01 is satisfied entirely via direct DB access.
- **D-02:** The `creators` table is seeded in Phase 2 via a SQL seed script included in the plan. Seed 5–8 well-known UK finance YouTube channels. Executor picks the channels (e.g. Damien Talks Money, Toby Newbatt, MoneyUnshackled, etc.).
- **D-03:** If the curated list is empty at runtime, show a graceful empty state — but since the seed runs during setup, this is the fallback only.

### Navigation Structure
- **D-04:** `/dashboard` gets a tab bar with 3 tabs: **Portfolio | Creators | ISA**. No sidebar, no additional routes.
- **D-05:** Active tab is driven by URL search param (`?tab=portfolio`, `?tab=creators`, `?tab=isa`) using Next.js `searchParams`. Tab state survives page reload and is bookmarkable.
- **D-06:** Default tab (no `?tab` param) = **Portfolio**.
- **D-07:** Tab bar sits at the top of the content card, below the header. No persistent sidebar. Layout stays `max-w-2xl` centered.

### Holdings Entry UX
- **D-08:** Add and edit holdings via a **modal/drawer form**. Fields: Ticker (text), Quantity (number), Current Value (£, Decimal), Asset Category (dropdown — 8 values from `AssetCategory` in `@/types`). Edit reuses the same modal pre-filled.
- **D-09:** Holdings list rows show: **ticker | quantity | £ value | category | [Edit] [Delete]**. All 4 data fields visible inline.
- **D-10:** **Asset category is added to the `holdings` table** (an extension beyond PORT-01 as written). This is required for the Plan Generator (Phase 5) to calculate allocation gaps. Use the `AssetCategory` enum constraint already defined in the schema.
- **D-11:** Monthly budget (PORT-03) is pinned to the **top of the Portfolio tab**, above the holdings list. Displayed as "Monthly budget: £500 [Edit]". Edit opens an inline input or small modal — executor's discretion.

### Creator Discovery Flow
- **D-12:** The Creators tab has **two sections**:
  1. **Browse creators** — full curated list with inline **[Track]** / **[✓ Tracking]** toggle per row. Tracked state shown inline; no separate "My Creators" section.
  2. **Add custom creator** — form below the curated list: YouTube channel URL + display name → submits to `user_creators` (and inserts a new `creators` row if the URL isn't already in the curated list).
- **D-13:** Tracking a creator creates a row in `user_creators`. Untracking soft-deletes it (or hard-deletes — executor's discretion). No cap on tracked creators (CREATOR-04).

### ISA Tab
- **D-14:** ISA tab shows:
  - **Allowance summary** at top: "£X,XXX remaining of £20,000 — Tax year 6 Apr 2025 – 5 Apr 2026". Calculated as £20,000 minus sum of all `isa_contributions` rows in current UK tax year.
  - **Contribution log**: scrollable list of past contributions (date + £ amount + [Delete] action).
  - **Log contribution form**: date picker + £ amount field + [Log] button. Submits via server action.
- **D-15:** Tax year boundary is **6 April – 5 April**. ISA-01 logic must filter contributions strictly to the current tax year. Use the UK tax year definition from `CLAUDE.md` §Critical Constraints.

### Claude's Discretion
- Exact Tailwind classes for the tab bar (must be consistent with existing `bg-zinc-800 border-zinc-700 rounded-xl` card style)
- Whether "Edit" on monthly budget is an inline input or small modal
- Untrack action: hard delete vs soft delete (set `tracked = false`) on `user_creators`
- Form validation error display pattern (inline field errors vs toast)
- Loading state pattern during server action mutations

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Requirements
- `.planning/REQUIREMENTS.md` — CREATOR-01–04, PORT-01–03, ISA-01, ISA-03 (the 9 requirements this phase implements)
- `.planning/ROADMAP.md` §Phase 2 — Success criteria and plan hints
- `.planning/PROJECT.md` — Core value, constraints, key decisions

### Critical Constraints
- `CLAUDE.md` §Critical Constraints — `decimal.js` for all £ arithmetic, ISA tax year (6 Apr–5 Apr), no "advice/recommend/suggest" language in user-facing output, manual-first v1

### Existing Code (read before planning)
- `pulse/src/types/index.ts` — `AssetCategory`, `Creator`, `UserCreator`, `Holding`, `ISAContribution`, `UserProfile` — all types are hand-written, import via `@/types`
- `pulse/src/app/dashboard/page.tsx` — current placeholder that Phase 2 replaces/extends
- `pulse/src/lib/supabase/server.ts` — `createClient()` used in all server components
- `pulse/src/lib/supabase/client.ts` — browser Supabase client for client components
- `pulse/src/app/auth/login/actions.ts` — example server action pattern to follow for mutations

### Phase 1 Decisions
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-03 (no CLI migrations, SQL editor only), D-04 (JSONB allocation column), D-05 (all 8 tables fully defined — no new columns without discussion), D-08/D-09 (hand-written types, single flat file)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@/types` — `AssetCategory` (8 values for category dropdown), `Creator`, `UserCreator`, `Holding`, `ISAContribution` are all defined and ready to use
- `pulse/src/lib/supabase/server.ts` → `createClient()` — use in all new server components / route handlers for data fetching
- `pulse/src/lib/supabase/client.ts` — use in client components that need Supabase (e.g. real-time, or interactive forms that don't use server actions)
- `pulse/src/app/auth/login/actions.ts` — canonical example of a Next.js server action with Supabase; follow this pattern for all mutations in Phase 2

### Established Patterns
- **Server components for data fetching:** `async function Page() { const supabase = await createClient(); ... }` — use `getUser()` not `getSession()` for auth check
- **Server actions for mutations:** co-located `actions.ts` files with `'use server'` directive; called via form `action={}` or `startTransition`
- **Dark zinc theme:** `bg-zinc-900` (page), `bg-zinc-800 border border-zinc-700 rounded-xl` (cards), `text-white` (headings), `text-zinc-400` (secondary text), `hover:bg-zinc-800` (interactive elements)
- **Layout:** `max-w-2xl mx-auto px-6 py-12` — keep all Phase 2 content within this constraint

### Integration Points
- `/dashboard` — Phase 2 transforms the placeholder page into the tabbed management UI. The header (Welcome + Sign out button) should be preserved.
- `middleware.ts` — already protects `/dashboard/**`; no changes needed
- `@/types` is the single import point for all domain types; Phase 2 components import from there

</code_context>

<specifics>
## Specific Ideas

- **Seed script:** 5-8 real UK finance YouTube channels inserted into `creators` table. Executor picks channels. SQL format (to be run in Supabase SQL editor, per D-03 — no CLI migrations).
- **ISA remaining display:** Show both remaining AND contributed: "£12,450 remaining (£7,550 contributed)" — gives user full picture at a glance.
- **Holdings modal preview the user approved:**
  ```
  ┌─ Add Holding ─────────┐
  │ Ticker:  [ VWRP     ] │
  │ Qty:     [ 12       ] │
  │ Value:   [ £1,240   ] │
  │ Category:[ Tech ▾   ] │
  │                       │
  │  [Cancel]  [Save]     │
  └───────────────────────┘
  ```
- **Tab bar preview the user approved:**
  ```
  [ Portfolio ] [ Creators ] [ ISA ]
  ```
  URL: `/dashboard?tab=portfolio` (default), `/dashboard?tab=creators`, `/dashboard?tab=isa`

</specifics>

<deferred>
## Deferred Ideas

- **Trust weight sliders per creator/category** — belongs in Phase 4 (Strategy Extraction & Blending). BLEND-01 is out of scope here.
- **Ticker validation against a real stock data API** — manual free-text entry only in v1 (manual-first constraint). Phase 6 or v2.
- **Portfolio total value / allocation chart** — Phase 6 Dashboard UI.
- **"My Creators" dedicated section** — user chose inline highlighting instead; sidebar or separate section may reconsider in Phase 6.

</deferred>

---

*Phase: 2-Portfolio & Creator Management*
*Context gathered: 2026-05-06*
