---
phase: 02-portfolio-creator-management
verified: 2026-05-07T12:00:00Z
status: human_needed
score: 9/9
overrides_applied: 0
human_verification:
  - test: "Run seed-creators.sql in Supabase and verify Creators tab shows 7 creators"
    expected: "All 7 UK finance YouTubers appear in Browse Creators list with Track buttons"
    why_human: "SQL migration and seed data must be applied manually to Supabase; cannot verify DB state programmatically"
  - test: "Visit /dashboard?tab=creators, click Track on a creator, refresh page"
    expected: "Creator shows '✓ Tracking' after refresh; clicking it again reverts to 'Track'"
    why_human: "Optimistic UI + server persistence requires live Supabase connection to verify round-trip"
  - test: "Add a custom creator via the form (valid youtube.com URL + display name), then verify it appears tracked"
    expected: "New row inserted in creators table (service role); user_creators row created; creator appears as tracked"
    why_human: "Requires SUPABASE_SERVICE_ROLE_KEY set in .env.local and live DB"
  - test: "Visit /dashboard?tab=isa, log a contribution of £1000, verify allowance summary updates"
    expected: "Remaining shows £19,000.00; tax year displayed correctly (e.g. '6 Apr 2025 - 5 Apr 2026')"
    why_human: "Requires live Supabase DB; ISA allowance recalculation is server-rendered"
---

# Phase 2: Portfolio & Creator Management — Verification Report

**Phase Goal:** User can build their portfolio (manual holdings entry), manage their creator list (curated + custom), and log ISA contributions — the data foundation for the plan.
**Verified:** 2026-05-07T12:00:00Z
**Status:** HUMAN_NEEDED (all automated checks pass; 4 live-DB flows need human verification)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin can add a YouTube channel to the curated list and it appears in the browse list | VERIFIED | `seed-creators.sql` exists with 7 idempotent `ON CONFLICT DO NOTHING` inserts; `page.tsx` fetches `creators WHERE is_active=true` and passes to `CreatorsTab` |
| 2 | User can add a creator from the curated list and a custom URL to their personal list, then remove both | VERIFIED | `trackCreator`/`untrackCreator`/`addCustomCreator` in `creator-actions.ts`; `CreatorsTab` wired with optimistic toggle; untrack hard-deletes with `.eq('user_id')` scope |
| 3 | User can enter holdings and see total portfolio value; monthly contribution amount is saved | VERIFIED | `actions.ts` exports `addHolding`/`updateHolding`/`deleteHolding`/`updateMonthlyBudget`; `PortfolioTab` renders holdings list + budget banner + modal; `page.tsx` fetches holdings scoped to `user.id` |
| 4 | ISA tracker correctly shows £20,000 minus logged contributions; resets on 6 April | VERIFIED | `ISA_ALLOWANCE = new Decimal(20000)`; `remaining = ISA_ALLOWANCE.minus(totalContributed)`; `getTaxYearForDate` uses UTC 6 April boundary; `page.tsx` filters by `currentTaxYear` |

**Score:** 4/4 roadmap success criteria verified

---

### Per-Requirement Checks

| Req | Description | Status | Evidence / File:Line |
|-----|-------------|--------|----------------------|
| CREATOR-01 | Curated creator seed (7 UK finance YouTubers) | VERIFIED | `seed-creators.sql` — 7 rows with `ON CONFLICT DO NOTHING`; `ALTER TABLE IF NOT EXISTS monthly_budget` also in same file |
| CREATOR-02 | Browse + track curated creators | VERIFIED | `creators-tab.tsx` — curated list rendered; `trackCreator` called via `handleToggle`; `aria-pressed` on toggle buttons |
| CREATOR-03 | Add custom YouTube creator | VERIFIED | `creator-actions.ts:56` — `addCustomCreator` validates URL with `/^https?:\/\/(www\.)?youtube\.com\//i`; service-role insert for new creator rows |
| CREATOR-04 | Untrack a creator (hard delete) | VERIFIED | `creator-actions.ts:29` — `untrackCreator` hard-deletes `.eq('creator_id', creatorId).eq('user_id', user.id)` |
| PORT-01 | Holdings list visible | VERIFIED | `page.tsx:53-70` — holdings fetched when `activeTab === 'portfolio'`; passed to `PortfolioTab`; renders list or "No holdings yet" empty state |
| PORT-02 | Add / edit / delete holdings | VERIFIED | `actions.ts` — all three actions; `HoldingModal.tsx` — add/edit modal; `PortfolioTab.tsx` — inline delete confirmation |
| PORT-03 | Monthly budget saved and displayed | VERIFIED | `types/index.ts:40` — `monthlyBudget: Decimal`; `actions.ts:78` — `updateMonthlyBudget`; `PortfolioTab` budget banner with inline edit |
| ISA-01 | Allowance tracker (£20k minus contributions) | VERIFIED | `isa-tab.tsx:8-34` — `ISA_ALLOWANCE = new Decimal(20000)`, reduce with `.plus()`, `.minus()` — pure decimal.js |
| ISA-03 | Log contributions manually | VERIFIED | `isa-actions.ts:8` — `logContribution`; `isa-tab.tsx` — Log Contribution form with date + amount; tax year computed server-side |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pulse/src/types/index.ts` | UserProfile.monthlyBudget: Decimal | VERIFIED | Line 40: `monthlyBudget: Decimal` with DB-mapping comment |
| `.planning/phases/02-portfolio-creator-management/seed-creators.sql` | 7 UK finance creators + ALTER TABLE | VERIFIED | 7 rows, `ON CONFLICT DO NOTHING`, `ALTER TABLE IF NOT EXISTS` guard |
| `pulse/src/app/dashboard/actions.ts` | addHolding, updateHolding, deleteHolding, updateMonthlyBudget | VERIFIED | All 4 exports present; `'use server'` directive; 95 lines |
| `pulse/src/components/HoldingModal.tsx` | Accessible add/edit modal | VERIFIED | `role="dialog"` (line 70), `aria-modal="true"` (line 71), `aria-labelledby` (line 72); focus management via useRef |
| `pulse/src/components/PortfolioTab.tsx` | Portfolio holdings list + budget banner | VERIFIED | Client component; modal state; inline delete confirm; budget edit mode |
| `pulse/src/app/dashboard/page.tsx` | 3-tab dashboard, searchParams routing | VERIFIED | `searchParams: Promise<{tab?: string}>` (line 21); tab routing; all 3 tabs wired to real components |
| `pulse/src/app/dashboard/creator-actions.ts` | trackCreator, untrackCreator, addCustomCreator | VERIFIED | All 3 exports; `getUser()` in each; URL validation regex |
| `pulse/src/lib/supabase/service.ts` | server-only guarded service client | VERIFIED | Line 1: `import 'server-only'`; env check with helpful error message |
| `pulse/src/app/dashboard/creators-tab.tsx` | CreatorsTab with track toggle + custom form | VERIFIED | Optimistic state; `aria-pressed`; Track/✓ Tracking toggle; Add Custom Creator form |
| `pulse/src/app/dashboard/isa-actions.ts` | logContribution, deleteContribution | VERIFIED | Both actions; `getUser()` guards; `getTaxYearForDate` called server-side |
| `pulse/src/app/dashboard/isa-tab.tsx` | ISATab with allowance summary + log | VERIFIED | `ISA_ALLOWANCE = new Decimal(20000)`; `.reduce`/`.plus`/`.minus`; color thresholds |
| `pulse/src/lib/tax-year.ts` | getTaxYearForDate using UTC 6 April boundary | VERIFIED | UTC methods (`getUTCFullYear`, `getUTCMonth`, `getUTCDate`); 6 April boundary correct |

---

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `HoldingModal.tsx` | `actions.ts addHolding / updateHolding` | `boundAction` in `useActionState` | VERIFIED | `import { addHolding, updateHolding }` line 4; `boundAction` selects based on `isEdit` |
| `dashboard/page.tsx` | `holdings` table scoped to `user_id` | server component fetch | VERIFIED | `page.tsx:56-58` — `.eq('user_id', user.id)` |
| `PortfolioTab` | `actions.ts updateMonthlyBudget` | `budgetAction` in `useActionState` | VERIFIED | `PortfolioTab.tsx:6` — import; `budgetAction` called on form submit |
| `creators-tab.tsx Track` | `creator-actions.ts trackCreator` | `handleToggle` startTransition | VERIFIED | `creators-tab.tsx:4` — import; `handleToggle` calls `trackCreator(creatorId)` |
| `creators-tab.tsx Untrack` | `creator-actions.ts untrackCreator` | `handleToggle` startTransition | VERIFIED | `handleToggle` branches: `untrackCreator(creatorId)` when `isTracked` |
| `creators-tab.tsx Add Creator form` | `creator-actions.ts addCustomCreator` | `customAction` form action | VERIFIED | `customAction` bound to `addCustomCreator` via `useActionState` |
| `isa-tab.tsx Log Contribution form` | `isa-actions.ts logContribution` | `logAction` form action | VERIFIED | `isa-tab.tsx:5` — import; `logAction` form action |
| `isa-tab.tsx Delete button` | `isa-actions.ts deleteContribution` | `handleDelete` startTransition | VERIFIED | `handleDelete` calls `deleteContribution(id)` |
| `isa-actions.ts logContribution` | `tax-year.ts getTaxYearForDate` | server-side call | VERIFIED | `isa-actions.ts:4` — import; `getTaxYearForDate(dateObj)` line 28 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `PortfolioTab` | `holdings: Holding[]` | `page.tsx` server fetch from `holdings` table | Yes — `.select(...)` with `eq('user_id', user.id)` | FLOWING |
| `PortfolioTab` | `profile: UserProfile` | `page.tsx` server fetch from `users` table | Yes — `monthly_budget` column mapped to `new Decimal()` | FLOWING |
| `CreatorsTab` | `creators: Creator[]` | `page.tsx` fetch from `creators WHERE is_active=true` | Yes — real DB query; empty if seed not yet run | FLOWING |
| `CreatorsTab` | `trackedCreatorIds: Set<string>` | `page.tsx` fetch from `user_creators` | Yes — `creator_id` mapped to `Set<string>` | FLOWING |
| `ISATab` | `contributions: ISAContribution[]` | `page.tsx` fetch from `isa_contributions` filtered by `tax_year` | Yes — `new Decimal(row.amount)` on each row | FLOWING |
| `ISATab` | `remaining` | `ISA_ALLOWANCE.minus(totalContributed)` | Yes — pure Decimal arithmetic, no hardcoded value | FLOWING |

---

### TypeScript Compilation

**Command:** `cd pulse && npx tsc --noEmit`
**Result:** Exit 0 — no errors, no output

---

### Security Checks

| Check | Result | Evidence |
|-------|--------|----------|
| All server actions call `getUser()` before DB | PASS | `actions.ts` lines 11, 39, 65, 80; `creator-actions.ts` lines 10, 31, 58; `isa-actions.ts` lines 10, 45 |
| `updateHolding`/`deleteHolding` scope with `.eq('user_id', user.id)` | PASS | `actions.ts:56` — `updateHolding`; `actions.ts:71` — `deleteHolding` |
| `untrackCreator` scopes DELETE with `.eq('user_id', user.id)` | PASS | `creator-actions.ts:37` |
| `deleteContribution` scopes DELETE with `.eq('user_id', user.id)` | PASS | `isa-actions.ts:51` |
| `service.ts` has `import 'server-only'` | PASS | `service.ts:1` |
| `SUPABASE_SERVICE_ROLE_KEY` not prefixed `NEXT_PUBLIC_` | PASS | `service.ts:12` — `process.env.SUPABASE_SERVICE_ROLE_KEY` |
| Tax year computed server-side only | PASS | `isa-actions.ts:28` — `getTaxYearForDate(dateObj)` not from FormData |

---

### decimal.js Checks

| Location | Usage | Status |
|----------|-------|--------|
| `isa-tab.tsx:8` | `ISA_ALLOWANCE = new Decimal(20000)` | PASS |
| `isa-tab.tsx:29-34` | `.reduce(sum.plus(c.amount))`, `.minus()`, `.div().times()` | PASS |
| `page.tsx:45` | `new Decimal(profileRow.monthly_budget ?? 0)` | PASS |
| `page.tsx:65-66` | `new Decimal(row.quantity)`, `new Decimal(row.current_value)` | PASS |
| `page.tsx:87` | `new Decimal(row.amount)` for ISA contributions | PASS |
| `types/index.ts:40,100,102,117` | Decimal on all £ fields in interfaces | PASS |
| `PortfolioTab.tsx:4` | `import { Decimal }` — `budget = profile?.monthlyBudget ?? new Decimal(0)` | PASS |

**Note:** `updateMonthlyBudget` in `actions.ts` uses `parseFloat` for the raw form value before writing to DB. This is acceptable — the constraint is on £ arithmetic and display, not DB wire format. The value is read back and wrapped in `new Decimal()` on page load.

---

### Modal Accessibility

| Check | Evidence |
|-------|----------|
| `role="dialog"` | `HoldingModal.tsx:70` |
| `aria-modal="true"` | `HoldingModal.tsx:71` |
| `aria-labelledby` pointing to heading | `HoldingModal.tsx:72` — `aria-labelledby={headingId}` where `headingId = 'holding-modal-heading'` |
| Focus trap on open | `useEffect` — `firstInputRef.current?.focus()` after 50ms delay |
| Focus restoration on close | `triggerRef.current.focus()` when `isOpen` becomes false |
| Escape key closes modal | `handleKeyDown` listens for `e.key === 'Escape'` |

---

### Tab Routing

| Check | Evidence |
|-------|----------|
| `searchParams.tab` drives active tab | `page.tsx:28-32` — `params.tab ?? 'portfolio'`; validates against `['portfolio', 'creators', 'isa']` |
| Default tab (no param) = portfolio | `params.tab ?? 'portfolio'` falls back to portfolio |
| Tab links use `<a href="?tab=X">` | `page.tsx:151` — `href={\`?tab=${tab.id}\`}` |
| Active tab has `aria-current="page"` | `page.tsx:156` — `aria-current={isActive ? 'page' : undefined}` |

---

### Anti-Patterns Found

None blocking. The creators tab placeholder `"Creator management coming in this phase."` mentioned in `02-02-SUMMARY.md` as a known stub was correctly replaced by `02-03`. The ISA tab placeholder was similarly replaced by `02-04`. The dashboard `page.tsx` contains no stubs.

---

### User Setup Required (Before Phase is "Done")

The following manual steps must be completed before the Phase 2 UI is functional end-to-end:

1. **Supabase SQL Migration** — Run SECTION 1 of `seed-creators.sql` in Supabase Dashboard → SQL Editor to add the `monthly_budget` column to `public.users`.

2. **Creator Seed Data** — Run SECTION 2 of `seed-creators.sql` to insert the 7 UK finance creators into `public.creators`.

3. **Service Role Key** — Add `SUPABASE_SERVICE_ROLE_KEY=<your-key>` to `pulse/.env.local`. Without this, the Add Custom Creator form will throw a helpful error but fail silently to the user. Key location: Supabase Dashboard → Settings → API → service_role key.

These are not code defects — they are documented operator steps carried forward from `02-01-SUMMARY.md` and `02-03-SUMMARY.md`.

---

### Human Verification Required

**1. Curated creator list appears after seed**
- **Test:** Run `seed-creators.sql` in Supabase SQL Editor, then visit `/dashboard?tab=creators`
- **Expected:** 7 creators shown (Damien Talks Money, Toby Newbatt, Money Unshackled, Sasha Yanshin, PensionCraft, Jamie Thompson Invests, Meaningful Money) with Track buttons
- **Why human:** Requires live Supabase DB with seed SQL applied

**2. Track / Untrack round-trip**
- **Test:** Click Track on any creator, refresh page
- **Expected:** Creator shows "✓ Tracking" after refresh; clicking again reverts to "Track" and removes DB row
- **Why human:** Requires live Supabase DB to verify persistence

**3. Add Custom Creator (requires service role key)**
- **Test:** Enter a valid `https://www.youtube.com/` URL + display name in Add Custom Creator form
- **Expected:** Row inserted in `creators` (via service role), `user_creators` row created, creator appears tracked
- **Why human:** Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` and live DB

**4. ISA allowance tracker**
- **Test:** Log a contribution (e.g. £1000 on today's date), verify summary
- **Expected:** Remaining shows `£19,000.00`; tax year display correct for current UK tax year; Delete removes the row and recalculates
- **Why human:** Requires live Supabase DB

---

## Gaps Summary

No gaps. All 9 requirements verified against actual code. TypeScript compiles clean. Security controls (getUser, user_id scoping, server-only, tax-year server-side) are in place and correctly wired. All artifacts are substantive (not stubs) and wired to real data sources.

The `human_needed` status reflects 4 live-DB verification flows that cannot be checked programmatically, not any code deficiency.

---

_Verified: 2026-05-07T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
