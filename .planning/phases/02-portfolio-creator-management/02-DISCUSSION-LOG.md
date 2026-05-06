# Phase 2: Portfolio & Creator Management - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 2-Portfolio & Creator Management
**Areas discussed:** Admin creator list, Navigation structure, Holdings entry UX, Creator discovery flow

---

## Admin Creator List

| Option | Description | Selected |
|--------|-------------|----------|
| Just you, via Supabase console | No admin UI needed. Insert/update rows directly. Phase 2 scope shrinks — no admin-only routes or role checks. | ✓ |
| In-app admin UI | Protected /admin route with role logic. Adds 1-2 extra plans. | |

**User's choice:** Supabase console only
**Notes:** User also chose to seed 5-8 UK finance YouTube channels via SQL seed script in the plan. Executor picks the specific channels (free choice — channels like Damien Talks Money, Toby Newbatt, MoneyUnshackled cited as examples).

---

## Navigation Structure

| Question | Options | Selected |
|----------|---------|----------|
| Structure | Tabs on /dashboard vs separate subroutes | Tabs on /dashboard |
| Default tab | Portfolio vs Creators | Portfolio |
| Tab state | URL-based (?tab=) vs client-side useState | URL-based (Next.js searchParams) |
| Nav chrome | Tab bar only vs sidebar | Tab bar only, no sidebar |

**User's choice:** 3 tabs (Portfolio | Creators | ISA) on `/dashboard`, URL-based state, no sidebar
**Notes:** User approved the tab bar preview mockup. Layout stays max-w-2xl.

---

## Holdings Entry UX

| Question | Options | Selected |
|----------|---------|----------|
| Add/edit flow | Modal/drawer form vs inline table row editing | Modal/drawer form |
| List row content | Ticker + value + actions vs ticker + qty + value + category + actions | Ticker + qty + value + category + actions |
| Category field | Add to holdings (required for plan generator) vs defer to later | Yes, add category field |
| Monthly budget location | Top of Portfolio tab vs inside ISA tab | Top of Portfolio tab |

**User's choice:** Modal form with 4 fields (ticker, qty, value, category); list shows all 4 plus edit/delete; budget pinned above holdings list
**Notes:** Adding category was flagged as practically required for Phase 5 plan generation even though PORT-01 doesn't explicitly mention it. User agreed. Holdings modal preview approved.

---

## Creator Discovery Flow

| Question | Options | Selected |
|----------|---------|----------|
| Layout | Two sections (Browse + Add custom) vs unified list | Two sections |
| Tracked state | Highlighted inline vs separate "My Creators" section | Highlighted inline |
| ISA tab | Remaining + log + form vs remaining only | Remaining + log + form |

**User's choice:** Browse section with inline Track/Untrack + separate Add custom form below; ISA tab with full contribution history and log form
**Notes:** ISA display should show both remaining AND contributed amount. User approved mockup: "£12,450 remaining (£7,550 contributed, tax year 6 Apr – 5 Apr)".

---

## Claude's Discretion

- Exact Tailwind classes for tab bar (must match zinc palette)
- Monthly budget edit: inline input vs small modal
- Untrack: hard delete vs soft delete on user_creators
- Form validation error display: inline vs toast
- Loading state pattern during server action mutations

## Deferred Ideas

- Trust weight sliders per creator/category → Phase 4
- Ticker validation against stock API → v2 / Phase 6
- Portfolio allocation chart → Phase 6
- Separate "My Creators" section → reconsidered in Phase 6 if needed
