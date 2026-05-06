# Phase 1: Foundation - Research

**Researched:** 2026-05-06
**Domain:** Next.js 15 App Router + Supabase SSR Auth + PostgreSQL Schema + TypeScript Domain Types
**Confidence:** HIGH

---

## Summary

Phase 1 scaffolds the skeleton every downstream phase inherits: a working Next.js 15 (App Router) project with Supabase email/password auth, cookie-based session persistence, a complete 8-table PostgreSQL schema with RLS, and hand-written TypeScript domain types. The Supabase SSR ecosystem (`@supabase/ssr`) went through a major API change in 2024 — all older patterns (`createClientComponentClient`, `createServerComponentClient`, `createMiddlewareClient`) are deprecated. Only `createBrowserClient` and `createServerClient` from `@supabase/ssr` are current.

Supabase's API key system is also transitioning: new projects (created after November 2025) use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (format `sb_publishable_...`) instead of `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Both are supported in the transition period, but the project should use the new publishable key format. Tailwind CSS v4 ships with `create-next-app@latest` and changes configuration significantly — no more `tailwind.config.js` by default; configuration moves to CSS using `@theme`.

**Primary recommendation:** Scaffold with `create-next-app@latest`, install `@supabase/ssr` + `@supabase/supabase-js` + `decimal.js`, wire cookie-based auth using the `createServerClient`/`createBrowserClient` split, deploy schema via Supabase SQL editor, hand-write all domain types with `Decimal` for £ fields.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** A new Supabase project must be created for Pulse. The plan must include steps for project creation (Supabase console) and capturing the project URL + anon key.
- **D-02:** Cloud-only development. No local Docker / `supabase start` setup. Both dev and prod point to the same cloud project.
- **D-03:** Schema is deployed via SQL run in the Supabase SQL editor (console). No Supabase CLI migrations.
- **D-04:** `creator_strategies.allocation` is a `JSONB` column storing the full strategy object (e.g. `{"Tech": 60, "Dividends": 20, "Cash": 20}`). No separate normalized `strategy_allocations` table.
- **D-05:** Full column spec for all 8 tables must be defined in Phase 1 — all columns, data types, foreign keys, and constraints. Downstream phases must not need schema migrations. Tables: `users`, `creators`, `user_creators`, `holdings`, `isa_contributions`, `transcripts`, `creator_strategies`, `buy_lists`.
- **D-06:** Auth pages (`/auth/login`, `/auth/signup`) use minimal Tailwind styling — centered card, labeled inputs, submit button. No design system (glassmorphism is Phase 6). Must be functional and readable.
- **D-07:** After login, user lands on `/dashboard` — a protected placeholder page showing "Welcome, [email]" and a Sign Out button. Proves middleware redirect works.
- **D-08:** Types are hand-written (not auto-generated from Supabase). They model domain concepts — `Creator`, `Holding`, `BuyListItem`, `CreatorStrategy`, etc. — not raw DB rows. Use `Decimal` (from `decimal.js`) for all `£` amount fields, not `number`.
- **D-09:** Single flat file: `types/index.ts`. All domain models in one place. Import path: `@/types`.

### Claude's Discretion

- **RLS policies:** Planner decides the exact policy syntax. Guidance: RLS should be ON for every table; a sensible default is `auth.uid() = user_id` for user-scoped tables. The `creators` table (admin-managed) may need different policy rules.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can sign up and log in with email/password (Supabase Auth) | Supabase Auth email/password is built-in; `signUp()` and `signInWithPassword()` from `@supabase/supabase-js`; auth pages at `/auth/login` and `/auth/signup` |
| AUTH-02 | User session persists across browser sessions | Cookie-based sessions via `@supabase/ssr`; middleware calls `supabase.auth.getUser()` on every request to refresh tokens; session stored in HttpOnly cookies |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Auth form submission (signup/login) | Frontend Server (SSR) via Server Action | Browser (form state) | Credentials must never go to a client-side handler; Server Actions keep secrets server-side |
| Session refresh + route protection | Frontend Server (middleware.ts) | — | Only middleware runs on every request before rendering; getUser() call must happen here |
| Sign out | Browser (client component) | Frontend Server (Server Action) | Sign out can be triggered from client; Supabase `signOut()` clears cookie via SSR |
| DB schema deployment | Database / Storage | — | SQL runs directly in Supabase console; no app-tier involvement |
| RLS enforcement | Database / Storage | — | Postgres evaluates `auth.uid()` on every query; app just passes the JWT cookie |
| Domain type definitions | Frontend Server / API | — | TypeScript compile-time only; types flow to all tiers |
| `/dashboard` placeholder | Frontend Server (SSR) | Browser | Server Component reads user from cookie, renders email; no client-side data fetch |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 15.3.x (`16.2.5` from npm) | App Router framework | Project decision; current stable |
| @supabase/supabase-js | 2.105.3 | Supabase client SDK | Official client; required for all Supabase operations |
| @supabase/ssr | 0.10.2 | Cookie-based session for SSR | Only supported SSR pattern post-2024; replaces all `auth-helpers` |
| decimal.js | 10.6.0 | Arbitrary-precision £ arithmetic | Project constraint; no floats for money |
| typescript | 5.x (bundled with Next) | Type safety | Project decision |
| tailwindcss | 4.2.4 | Utility CSS | Project decision; v4 ships with create-next-app |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| framer-motion | 12.38.0 | Animations | Phase 6 UI — install now so it's in package.json, use in Phase 6 |
| server-only | latest | Prevents server code in client bundles | Import in `lib/supabase/server.ts` to enforce server boundary |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @supabase/ssr | @supabase/auth-helpers-nextjs | auth-helpers is deprecated; do not use |
| Hand-written types | supabase gen types | Auto-gen types model raw DB rows; project requires domain model types with Decimal |
| SQL editor (D-03) | Supabase CLI migrations | CLI requires Docker locally; D-02 forbids it |

**Installation:**
```bash
npx create-next-app@latest pulse --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
cd pulse
npm install @supabase/supabase-js @supabase/ssr decimal.js framer-motion server-only
```

> **Note on `--src-dir`:** Supabase SSR docs place utils in `./utils/supabase/` or `./src/utils/supabase/` depending on whether `--src-dir` is used. With `--src-dir`, all app code lives under `src/`. The project should use `--src-dir` for cleaner separation. Adjust `@/` alias accordingly (tsconfig already maps `@/*` → `./src/*` when `--src-dir` is used).

**Version verification:** [VERIFIED: npm registry — 2026-05-06]
- `@supabase/ssr`: 0.10.2
- `@supabase/supabase-js`: 2.105.3
- `next`: 16.2.5 (note: npm shows 16.2.5 as latest — Next.js has released v16; project spec says "Next.js 15" but the scaffold should use `create-next-app@15` to pin v15 if required, or `@latest` for v16)
- `decimal.js`: 10.6.0
- `framer-motion`: 12.38.0
- `tailwindcss`: 4.2.4

> **IMPORTANT:** npm `next` version is 16.2.5. CLAUDE.md specifies "Next.js 15." The planner must decide: pin `create-next-app@15` or use latest (v16). Research recommendation: pin `@15` to match CLAUDE.md spec. `npx create-next-app@15 pulse ...`

---

## Architecture Patterns

### System Architecture Diagram

```
Browser
  │
  ├─ /auth/login  ──► Server Action (signInWithPassword)
  │                        │ sets HttpOnly cookie via @supabase/ssr
  │                        └─► redirect /dashboard
  │
  ├─ /auth/signup ──► Server Action (signUp)
  │                        │
  │                        └─► redirect /auth/login (or auto-login)
  │
  └─ /dashboard   ──► middleware.ts
                          │ createServerClient (request cookies)
                          │ supabase.auth.getUser()
                          ├─ NO user ──► redirect /auth/login
                          └─ user OK ──► pass to Server Component
                                             │
                                             └─ render "Welcome, email" + Sign Out
```

### Recommended Project Structure
```
src/
├── app/
│   ├── auth/
│   │   ├── login/
│   │   │   └── page.tsx          # Login form (Server Component + Server Action)
│   │   └── signup/
│   │       └── page.tsx          # Signup form (Server Component + Server Action)
│   ├── dashboard/
│   │   └── page.tsx              # Protected placeholder (Server Component)
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Public home / redirect
├── lib/
│   └── supabase/
│       ├── client.ts             # createBrowserClient (Client Components)
│       └── server.ts             # createServerClient (Server Components + Actions)
├── types/
│   └── index.ts                  # All domain types (D-09)
├── middleware.ts                 # Session refresh + route protection
└── .env.local                    # NEXT_PUBLIC_SUPABASE_URL + key
```

### Pattern 1: Server Client (Server Components, Server Actions, Route Handlers)

```typescript
// src/lib/supabase/server.ts
// Source: [CITED: supabase.com/docs/guides/auth/server-side/nextjs]
import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — setAll throws; middleware handles writes
          }
        },
      },
    }
  )
}
```

### Pattern 2: Browser Client (Client Components only)

```typescript
// src/lib/supabase/client.ts
// Source: [CITED: supabase.com/docs/guides/auth/server-side/nextjs]
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
```

### Pattern 3: Middleware (session refresh + route protection)

```typescript
// src/middleware.ts
// Source: [CITED: supabase.com/docs/guides/auth/server-side/nextjs]
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // CRITICAL: use getUser() not getSession() — getUser() validates with server
  const { data: { user } } = await supabase.auth.getUser()

  const isProtected = request.nextUrl.pathname.startsWith('/dashboard')
  const isAuthPage = request.nextUrl.pathname.startsWith('/auth/')

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  if (isAuthPage && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### Pattern 4: Server Action (sign in)

```typescript
// Inside app/auth/login/page.tsx or actions/auth.ts
// Source: [ASSUMED] — based on Supabase + Next.js Server Action conventions
'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signIn(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
  if (error) return { error: error.message }
  redirect('/dashboard')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/auth/login')
}
```

### Anti-Patterns to Avoid

- **`createClientComponentClient` / `createServerComponentClient`:** Deprecated in `@supabase/auth-helpers-nextjs`. Do not use. Use `@supabase/ssr` only.
- **`supabase.auth.getSession()` in middleware:** Does not validate the token with Supabase servers. Always use `getUser()` for protected route checks.
- **`createBrowserClient` in a Server Component:** Will throw or cause hydration errors. Only use in `'use client'` components.
- **Awaiting `cookies()` in server.ts but not making the function async:** Next.js 15 requires `await cookies()` — function must be `async`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session cookie management | Custom JWT storage | `@supabase/ssr` createServerClient | Token refresh, expiry, HttpOnly cookie security — 10+ edge cases |
| Auth token refresh | Manual refresh loop | Middleware with `getUser()` | Supabase handles rotation, re-issue, clock skew |
| Password hashing | bcrypt implementation | Supabase Auth built-in | Argon2, salt, timing attacks — pre-solved |
| £ arithmetic rounding | `Math.round()` patterns | `decimal.js` | IEEE 754 float errors compound across portfolio calculations |
| RLS access control | Application-level query filters | Postgres RLS policies | DB-enforced; can't be bypassed by app bugs |

**Key insight:** Auth session management has silent failure modes (stale tokens, race conditions, cookie scope issues) that Supabase SSR solves. Never bypass it with custom cookie code.

---

## DB Schema Design

All 8 tables defined here for the SQL editor (D-03, D-05).

### Table 1: `public.users`
Extends `auth.users`. One row per registered user. Created via a trigger on auth signup.

```sql
-- Source: [CITED: supabase.com/docs/guides/auth/managing-user-data]
CREATE TABLE public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own row
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Auto-create user row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Table 2: `public.creators`
Admin-managed curated creator list. Users cannot insert/delete. SELECT is open to authenticated users.

```sql
CREATE TABLE public.creators (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_url  TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  channel_id   TEXT,              -- YouTube channel ID (populated in Phase 3)
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view creators
CREATE POLICY "Authenticated users can view creators"
  ON public.creators FOR SELECT
  TO authenticated
  USING (TRUE);

-- Only service role (admin) can insert/update/delete
-- No INSERT/UPDATE/DELETE policy = blocked for authenticated role
```

### Table 3: `public.user_creators`
Join table: which creators a user is tracking. Holds per-user trust weights (set in Phase 4).

```sql
CREATE TABLE public.user_creators (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  creator_id  UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  trust_weight NUMERIC(5,2) NOT NULL DEFAULT 100.00, -- 0–100 per category; blending in Phase 4
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, creator_id)
);

ALTER TABLE public.user_creators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own creator list"
  ON public.user_creators FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

> **Note on trust weights:** BLEND-01 requires per-category weights. `trust_weight` here is a single global default. Phase 4 may need a `user_creator_weights` table with per-category rows. D-05 says all columns defined now — planner must decide: add category weight columns now or keep simple. Research recommendation: keep `trust_weight NUMERIC(5,2)` as global default here; Phase 4 will extend to per-category if needed within D-05's constraint. This is an open question — see Open Questions.

### Table 4: `public.holdings`
User's current portfolio positions. Manually entered (PORT-01/02).

```sql
CREATE TABLE public.holdings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ticker        TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('Tech','Dividends','Bonds','Commodities','Cash','Emerging Markets','Small Cap','REITs')),
  quantity      NUMERIC(18,8) NOT NULL DEFAULT 0,
  current_value NUMERIC(18,2) NOT NULL DEFAULT 0,  -- £ value, stored as NUMERIC not float
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, ticker)
);

ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own holdings"
  ON public.holdings FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Table 5: `public.isa_contributions`
Log of manual ISA contributions (ISA-01/03). Tax year boundary: 6 April.

```sql
CREATE TABLE public.isa_contributions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount          NUMERIC(10,2) NOT NULL CHECK (amount > 0),  -- £
  contribution_date DATE NOT NULL,
  tax_year        TEXT NOT NULL,  -- e.g. '2025-26' (6 Apr 2025 – 5 Apr 2026)
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.isa_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ISA contributions"
  ON public.isa_contributions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Table 6: `public.transcripts`
Stores YouTube video transcript metadata and raw text. Embedded into Pinecone in Phase 3.

```sql
CREATE TABLE public.transcripts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id     UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  video_id       TEXT NOT NULL UNIQUE,  -- YouTube video ID
  title          TEXT NOT NULL,
  published_at   TIMESTAMPTZ NOT NULL,
  raw_text       TEXT,                  -- Full transcript text
  word_count     INTEGER,
  is_embedded    BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE after Pinecone embedding
  last_fetched   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;

-- Transcripts are tied to creators (not users); all authenticated users can read
CREATE POLICY "Authenticated users can view transcripts"
  ON public.transcripts FOR SELECT
  TO authenticated
  USING (TRUE);

-- Only service role inserts/updates (app backend handles ingestion)
```

### Table 7: `public.creator_strategies`
Versioned AI-extracted allocation snapshots per creator (STRAT-01/02). `allocation` is JSONB (D-04).

```sql
CREATE TABLE public.creator_strategies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id      UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  allocation      JSONB NOT NULL,   -- {"Tech": 60, "Dividends": 20, "Cash": 20}
  confidence      INTEGER NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  source_video_ids TEXT[] NOT NULL DEFAULT '{}',  -- YouTube video IDs cited
  has_contradiction BOOLEAN NOT NULL DEFAULT FALSE,
  contradiction_note TEXT,
  extracted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.creator_strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view creator strategies"
  ON public.creator_strategies FOR SELECT
  TO authenticated
  USING (TRUE);

-- Only service role inserts (AI extraction pipeline)
```

### Table 8: `public.buy_lists`
Generated monthly buy lists per user (PLAN-01). Stores the full plan as JSONB for flexibility.

```sql
CREATE TABLE public.buy_lists (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  month           TEXT NOT NULL,       -- e.g. '2026-05'
  budget_gbp      NUMERIC(10,2) NOT NULL,
  items           JSONB NOT NULL,      -- [{ticker, category, amount_gbp, rationale}]
  unified_allocation JSONB NOT NULL,   -- blended strategy used for this plan
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, month)             -- one plan per month per user
);

ALTER TABLE public.buy_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own buy lists"
  ON public.buy_lists FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## TypeScript Domain Types

All types in `src/types/index.ts`. Import as `@/types`. [VERIFIED against D-08, D-09]

```typescript
// src/types/index.ts
import { Decimal } from 'decimal.js'

// --- Asset Category ---
export type AssetCategory =
  | 'Tech'
  | 'Dividends'
  | 'Bonds'
  | 'Commodities'
  | 'Cash'
  | 'Emerging Markets'
  | 'Small Cap'
  | 'REITs'

// --- Creator ---
export interface Creator {
  id: string
  channelUrl: string
  displayName: string
  channelId: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// --- UserCreator (join: user tracks creator) ---
export interface UserCreator {
  id: string
  userId: string
  creatorId: string
  trustWeight: number  // 0–100; global default; per-category extension in Phase 4
  createdAt: Date
  creator?: Creator    // optional join
}

// --- Holding ---
export interface Holding {
  id: string
  userId: string
  ticker: string
  category: AssetCategory
  quantity: Decimal
  currentValue: Decimal   // £ — never use number
  createdAt: Date
  updatedAt: Date
}

// --- ISAContribution ---
export interface ISAContribution {
  id: string
  userId: string
  amount: Decimal     // £
  contributionDate: Date
  taxYear: string     // e.g. '2025-26'
  notes: string | null
  createdAt: Date
}

// --- Transcript ---
export interface Transcript {
  id: string
  creatorId: string
  videoId: string
  title: string
  publishedAt: Date
  rawText: string | null
  wordCount: number | null
  isEmbedded: boolean
  lastFetched: Date | null
  createdAt: Date
  updatedAt: Date
}

// --- AllocationMap: core domain type ---
export type AllocationMap = Partial<Record<AssetCategory, number>>
// e.g. { Tech: 60, Dividends: 20, Cash: 20 }
// Numbers are percentages (0–100); should sum to 100

// --- CreatorStrategy ---
export interface CreatorStrategy {
  id: string
  creatorId: string
  allocation: AllocationMap
  confidence: number       // 0–100
  sourceVideoIds: string[]
  hasContradiction: boolean
  contradictionNote: string | null
  extractedAt: Date
  createdAt: Date
}

// --- BuyListItem ---
export interface BuyListItem {
  ticker: string
  category: AssetCategory
  amountGbp: Decimal    // £ — decimal.js
  rationale: string
}

// --- BuyList ---
export interface BuyList {
  id: string
  userId: string
  month: string           // 'YYYY-MM'
  budgetGbp: Decimal      // £
  items: BuyListItem[]
  unifiedAllocation: AllocationMap
  createdAt: Date
}

// --- UserProfile (public.users) ---
export interface UserProfile {
  id: string
  email: string
  createdAt: Date
  updatedAt: Date
}
```

> **Decimal import note:** Use `import { Decimal } from 'decimal.js'` (named export). The type annotation for a field is `Decimal` (not `decimal.Decimal`). [VERIFIED: decimal.js GitHub issue #68 + npm readme]

---

## Common Pitfalls

### Pitfall 1: Using `getSession()` in Middleware
**What goes wrong:** `getSession()` returns cached session data from the cookie without revalidating with Supabase servers. An attacker can forge a cookie and pass the check.
**Why it happens:** Supabase docs historically showed `getSession()` — many tutorials copy this.
**How to avoid:** Always use `supabase.auth.getUser()` in middleware. It makes a server round-trip to validate the JWT.
**Warning signs:** If you see `getSession()` in middleware.ts, it's wrong.

### Pitfall 2: Non-async `createClient()` in server.ts (Next.js 15)
**What goes wrong:** `cookies()` from `next/headers` must be awaited in Next.js 15+. Calling it synchronously causes a warning or error in Turbopack.
**Why it happens:** Pre-15 code had `const cookieStore = cookies()` (sync). Next.js 15 changed it.
**How to avoid:** Always `async function createClient()` with `const cookieStore = await cookies()`.
**Warning signs:** `cookies() should be awaited` error in the dev console.

### Pitfall 3: Missing `supabaseResponse` cookie forwarding in middleware
**What goes wrong:** Session tokens are refreshed but not written back to the browser. User gets logged out on every page navigation.
**Why it happens:** The middleware creates a new `NextResponse` but forgets to copy the updated cookies from the supabase client back to the response.
**How to avoid:** Follow the exact middleware pattern: reassign `supabaseResponse = NextResponse.next({ request })` inside `setAll`, then return `supabaseResponse` (not `NextResponse.next()`).
**Warning signs:** User logs in but is immediately redirected back to login.

### Pitfall 4: Using old env var name
**What goes wrong:** `NEXT_PUBLIC_SUPABASE_ANON_KEY` is the legacy key name. New Supabase projects (post-Nov 2025) issue `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (format `sb_publishable_...`).
**Why it happens:** Tutorials written before the key system migration still use the old name.
**How to avoid:** Check the Supabase dashboard for the key format. If it starts with `sb_publishable_`, use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. If it's a JWT (eyJ...), use `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
**Warning signs:** Auth calls fail with 401 immediately.

### Pitfall 5: Float arithmetic for £ amounts in DB
**What goes wrong:** `NUMERIC(18,2)` in Postgres is fine, but reading it into JavaScript as a number and performing arithmetic introduces float errors.
**Why it happens:** Supabase JS client returns numeric columns as JS `number` by default.
**How to avoid:** When reading from DB, immediately wrap with `new Decimal(row.current_value)` before any arithmetic. Store back as `.toNumber()` or `.toString()` for Supabase insert.
**Warning signs:** Portfolio totals show pennies of error (e.g. £999.9999999).

### Pitfall 6: Tailwind v4 — no `tailwind.config.js` by default
**What goes wrong:** Expecting `tailwind.config.js` to exist and trying to add theme extensions there.
**Why it happens:** Tailwind v4 ships with `create-next-app@latest` and uses CSS-first configuration via `@theme` in `globals.css` instead.
**How to avoid:** Extend theme in `src/app/globals.css` using `@theme { --color-brand: ... }`. PostCSS config (`postcss.config.mjs`) is still needed with `@tailwindcss/postcss`.
**Warning signs:** `tailwind.config.js` not found — this is expected, not a bug.

### Pitfall 7: Next.js version mismatch
**What goes wrong:** `npx create-next-app@latest` installs Next.js 16.x (current npm latest), but CLAUDE.md specifies Next.js 15.
**Why it happens:** npm `latest` tag follows the actual latest publish.
**How to avoid:** Use `npx create-next-app@15` to pin major version 15.
**Warning signs:** `package.json` shows `"next": "^16.x.x"` when expecting 15.

---

## Environment Variables

```bash
# .env.local (never commit to git)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

# If using legacy project with JWT-format anon key:
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Both `NEXT_PUBLIC_` prefixed vars are safe to expose to the browser — they are protected by Supabase RLS, not by secrecy. [CITED: supabase.com/docs discussions #6877]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `createClientComponentClient` | `createBrowserClient` from `@supabase/ssr` | 2024 | Old import will show deprecation warning |
| `createServerComponentClient` | `createServerClient` from `@supabase/ssr` | 2024 | Old import removed in newer versions |
| `createMiddlewareClient` | `createServerClient` in middleware | 2024 | Same as above |
| `cookies()` sync call | `await cookies()` | Next.js 15 | Breaking change — must be async |
| `tailwind.config.js` | CSS `@theme` directive in globals.css | Tailwind v4 | Config file no longer generated |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Nov 2025 | New projects get new key format |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Server Actions are the correct pattern for auth form submission (vs. route handlers) | Architecture Patterns, Pattern 4 | Minor — route handlers also work; Server Actions are the current Next.js 15 convention but not the only valid approach |
| A2 | `trust_weight` in `user_creators` is sufficient as a single global weight for Phase 1; per-category weights are Phase 4 scope | DB Schema Table 3 | Medium — BLEND-01 requires per-category weights; if the planner wants to define per-category columns now (D-05 says no future migrations), the table needs more columns |
| A3 | `buy_lists.items` stored as JSONB is flexible enough for all Phase 5 requirements | DB Schema Table 8 | Low — JSONB is queryable in Postgres; Phase 5 can add computed columns without schema migration |
| A4 | `transcripts.raw_text` as TEXT is adequate; no size limit constraint needed | DB Schema Table 6 | Low — Postgres TEXT has no hard size limit; very large transcripts (100k+ tokens) will be large rows but manageable for v1 |

---

## Open Questions

1. **Next.js version: 15 vs 16**
   - What we know: CLAUDE.md specifies Next.js 15; npm latest is 16.2.5 as of research date
   - What's unclear: Does the project owner want to pin v15 or use latest?
   - Recommendation: Use `create-next-app@15` to match CLAUDE.md spec. Planner should explicitly pin.

2. **Per-category trust weights: now or Phase 4?**
   - What we know: BLEND-01 requires per-category weights; D-05 says no future schema migrations; `user_creators.trust_weight` is a single number
   - What's unclear: Does Phase 1 need to define per-category weight storage now?
   - Recommendation: Add a `user_creator_category_weights` table in Phase 1 schema (empty for now), defined as: `(user_creator_id UUID, category TEXT, weight NUMERIC(5,2))`. This satisfies D-05's "no future migrations" constraint without requiring implementation in Phase 1.

3. **Supabase project: new key format confirmation**
   - What we know: New projects use `sb_publishable_...` key format; legacy projects use JWT anon key
   - What's unclear: Which format the actual new project will issue
   - Recommendation: Check dashboard after project creation; planner instructions should cover both cases.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm, Next.js scaffold | ✓ | v24.15.0 | — |
| npm | Package management | ✓ | bundled with Node | — |
| Git | Version control | ✓ | (git repo exists) | — |
| Supabase cloud project | Auth, DB | Must create | — | None — required |
| Browser (dev testing) | Auth flow verification | ✓ | — | — |

**Missing dependencies with no fallback:**
- Supabase project URL + publishable key — must be created in Supabase console before any code runs. Plan must include this as a manual step.

**Missing dependencies with fallback:**
- None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | TypeScript compiler (`tsc --noEmit`) + manual browser verification |
| Config file | `tsconfig.json` (generated by create-next-app) |
| Quick run command | `npx tsc --noEmit` |
| Full suite command | `npm run build` (catches all type errors + build errors) |

> No automated test framework (Jest/Vitest) is installed in Phase 1. AUTH-01 and AUTH-02 are browser-flow requirements — they require a live Supabase project and cannot be unit-tested in isolation without mocking the entire Supabase client. The validation strategy for Phase 1 is: type compilation pass + manual browser smoke test of the auth flow.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | User can sign up with email/password | Manual smoke | `npm run dev` then manually test `/auth/signup` | ❌ Wave 0 — no test file; manual only |
| AUTH-01 | User can log in with email/password | Manual smoke | `npm run dev` then manually test `/auth/login` | ❌ Wave 0 — manual only |
| AUTH-02 | Session persists after browser refresh | Manual smoke | Visit `/dashboard` after login, close/reopen tab | ❌ Wave 0 — manual only |
| AUTH-02 | Unauthenticated `/dashboard` redirects to `/auth/login` | Manual smoke | Visit `/dashboard` while logged out | ❌ Wave 0 — manual only |
| — | TypeScript types compile without errors | Type check | `npx tsc --noEmit` | ❌ Wave 0 — runs after scaffold |
| — | Next.js build succeeds | Build check | `npm run build` | ❌ Wave 0 — runs after scaffold |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` (catches type regressions immediately)
- **Per wave merge:** `npm run build` (full compilation + static analysis)
- **Phase gate:** `npm run build` green + manual auth flow smoke test pass before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] No test files to create — Phase 1 validation is type compilation + manual browser testing
- [ ] Supabase project must exist before any auth tests can run (prerequisite, not a code gap)
- [ ] `npm run build` cannot run until scaffold is complete (sequential dependency)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Supabase Auth built-in (email/password, bcrypt-equivalent) |
| V3 Session Management | Yes | `@supabase/ssr` HttpOnly cookie sessions; `getUser()` validates server-side on every request |
| V4 Access Control | Yes | Postgres RLS policies with `auth.uid()` enforce row-level isolation |
| V5 Input Validation | Yes | Supabase rejects malformed auth inputs; form inputs validated before calling `signInWithPassword` |
| V6 Cryptography | No | Supabase manages password hashing — do not hand-roll |

### Known Threat Patterns for Next.js 15 + Supabase Auth

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Session hijacking via stolen cookie | Spoofing | HttpOnly + SameSite cookies via `@supabase/ssr` |
| Forged session token bypassing route protection | Spoofing | `getUser()` (not `getSession()`) validates with Supabase server on every request |
| Horizontal privilege escalation (user reads another user's data) | Elevation of Privilege | RLS `auth.uid() = user_id` on all user-scoped tables |
| SQL injection via Supabase client | Tampering | Supabase JS client uses parameterized queries; never concatenate raw SQL |
| Anon key misuse | Information Disclosure | All tables have RLS enabled; anon key + no session = no data access |
| CSRF on Server Actions | Spoofing | Next.js 15 Server Actions include CSRF protection by default via origin checking |

---

## Sources

### Primary (HIGH confidence)
- [CITED: supabase.com/docs/guides/auth/server-side/nextjs] — SSR auth setup, middleware pattern, createServerClient/createBrowserClient
- [CITED: supabase.com/docs/guides/auth/managing-user-data] — public.users pattern, trigger for profile creation
- [CITED: supabase.com/docs/guides/database/postgres/row-level-security] — RLS policy syntax
- [VERIFIED: npm registry, 2026-05-06] — all package versions confirmed

### Secondary (MEDIUM confidence)
- [CITED: supabase.com discussions #29260, #40300] — publishable key migration timeline, Nov 2025 date
- [CITED: supabase.com discussions #6877] — NEXT_PUBLIC_ env var rationale (anon key safe to expose with RLS)
- [CITED: nextjs.org/docs/app/api-reference/cli/create-next-app] — scaffold flags
- [CITED: tailwindcss.com/blog/tailwindcss-v4] — v4 CSS-first configuration, postcss.config.mjs requirement
- [CITED: decimal.js GitHub #68] — TypeScript import pattern `{ Decimal }` from `'decimal.js'`

### Tertiary (LOW confidence)
- None — all critical claims verified via official sources or npm registry.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry
- Architecture: HIGH — patterns cited from official Supabase SSR docs
- DB schema: MEDIUM — column specs are researched best-practice + domain knowledge; exact types verified against Postgres/Supabase conventions; trust weight open question noted
- TypeScript types: HIGH — follows D-08/D-09 verbatim + decimal.js import verified
- Pitfalls: HIGH — middleware `getUser()` vs `getSession()` explicitly documented in Supabase official docs; Next.js 15 async cookies() issue confirmed in GitHub discussions
- Security: HIGH — ASVS mapping + threat patterns based on official Supabase security docs

**Research date:** 2026-05-06
**Valid until:** 2026-06-06 (30 days — stable libraries, but Supabase key migration is in progress)
