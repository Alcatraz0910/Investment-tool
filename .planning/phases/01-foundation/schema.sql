-- =============================================================================
-- Pulse — Complete Database Schema
-- Phase 1: Foundation
-- Deploy via: Supabase SQL Editor (Project → SQL Editor → New query → paste → Run)
-- D-03: No CLI migrations. SQL editor only.
-- D-05: All columns defined here. No future migrations needed in Phases 2-6.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table 1: public.users
-- Extends auth.users. One row per registered user.
-- Created automatically via trigger on auth signup.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Auto-create public.users row when a new auth.users row is inserted (signup)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ---------------------------------------------------------------------------
-- Table 2: public.creators
-- Admin-managed curated creator list.
-- Authenticated users: SELECT only. INSERT/UPDATE/DELETE: service role only.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creators (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_url  TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  channel_id   TEXT,                         -- YouTube channel ID (Phase 3)
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view creators"
  ON public.creators FOR SELECT
  TO authenticated
  USING (TRUE);

-- No INSERT/UPDATE/DELETE policy = blocked for authenticated role (service role bypasses RLS)


-- ---------------------------------------------------------------------------
-- Table 3: public.user_creators
-- Join table: which creators a user is tracking.
-- trust_weight: global default (0-100). Per-category weights in Table 3a below.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_creators (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  creator_id   UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  trust_weight NUMERIC(5,2) NOT NULL DEFAULT 100.00  -- Global default weight (0-100)
    CHECK (trust_weight >= 0 AND trust_weight <= 100),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, creator_id)
);

ALTER TABLE public.user_creators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own creator list"
  ON public.user_creators FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- Table 3a: public.user_creator_category_weights
-- Per-category trust weights for strategy blending (BLEND-01).
-- Stub table defined now (D-05: no future migrations). Populated in Phase 4.
-- Each row = one category override for a user+creator pair.
-- If a category has no row, the global trust_weight from user_creators applies.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_creator_category_weights (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_creator_id UUID NOT NULL REFERENCES public.user_creators(id) ON DELETE CASCADE,
  category        TEXT NOT NULL
    CHECK (category IN ('Tech','Dividends','Bonds','Commodities','Cash','Emerging Markets','Small Cap','REITs')),
  weight          NUMERIC(5,2) NOT NULL DEFAULT 100.00
    CHECK (weight >= 0 AND weight <= 100),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_creator_id, category)
);

ALTER TABLE public.user_creator_category_weights ENABLE ROW LEVEL SECURITY;

-- Access via user_creators join: user owns the user_creator row → can manage weights
CREATE POLICY "Users manage own category weights"
  ON public.user_creator_category_weights FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_creators uc
      WHERE uc.id = user_creator_category_weights.user_creator_id
        AND uc.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_creators uc
      WHERE uc.id = user_creator_category_weights.user_creator_id
        AND uc.user_id = auth.uid()
    )
  );


-- ---------------------------------------------------------------------------
-- Table 4: public.holdings
-- User's current portfolio positions. Manually entered (PORT-01/02).
-- category constrained to standard 8 asset categories.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.holdings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ticker        TEXT NOT NULL,
  category      TEXT NOT NULL
    CHECK (category IN ('Tech','Dividends','Bonds','Commodities','Cash','Emerging Markets','Small Cap','REITs')),
  quantity      NUMERIC(18,8) NOT NULL DEFAULT 0
    CHECK (quantity >= 0),
  current_value NUMERIC(18,2) NOT NULL DEFAULT 0   -- £ value; wrap in Decimal in app
    CHECK (current_value >= 0),
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


-- ---------------------------------------------------------------------------
-- Table 5: public.isa_contributions
-- Log of manual ISA contributions. Tax year boundary: 6 April (UK).
-- tax_year format: '2025-26' (6 Apr 2025 - 5 Apr 2026).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.isa_contributions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount            NUMERIC(10,2) NOT NULL CHECK (amount > 0),   -- £ amount
  contribution_date DATE NOT NULL,
  tax_year          TEXT NOT NULL,    -- e.g. '2025-26'
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.isa_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ISA contributions"
  ON public.isa_contributions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- Table 6: public.transcripts
-- YouTube video transcript metadata and raw text. Embedded to Pinecone in Phase 3.
-- raw_text: full transcript; may be NULL before fetch. No size limit constraint
-- (Postgres TEXT has no hard limit; 100k+ token transcripts are acceptable for v1).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transcripts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id   UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  video_id     TEXT NOT NULL UNIQUE,          -- YouTube video ID
  title        TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  raw_text     TEXT,                          -- NULL until fetched
  word_count   INTEGER,
  is_embedded  BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE after Pinecone upsert
  last_fetched TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read transcript data (creator-scoped, not user-scoped)
CREATE POLICY "Authenticated users can view transcripts"
  ON public.transcripts FOR SELECT
  TO authenticated
  USING (TRUE);

-- INSERT/UPDATE/DELETE handled by app backend (service role); no authenticated policy


-- ---------------------------------------------------------------------------
-- Table 7: public.creator_strategies
-- Versioned AI-extracted allocation snapshots per creator (STRAT-01/02).
-- allocation: JSONB column per D-04 (e.g. {"Tech": 60, "Dividends": 20, "Cash": 20}).
-- Each extraction creates a new row - full history preserved.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creator_strategies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id        UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  allocation        JSONB NOT NULL,          -- D-04: JSONB, not normalized table
  confidence        INTEGER NOT NULL
    CHECK (confidence BETWEEN 0 AND 100),
  source_video_ids  TEXT[] NOT NULL DEFAULT '{}',  -- YouTube video IDs cited
  has_contradiction BOOLEAN NOT NULL DEFAULT FALSE,
  contradiction_note TEXT,
  extracted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.creator_strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view creator strategies"
  ON public.creator_strategies FOR SELECT
  TO authenticated
  USING (TRUE);

-- INSERT handled by AI extraction pipeline (service role); no authenticated insert policy


-- ---------------------------------------------------------------------------
-- Table 8: public.buy_lists
-- Generated monthly buy lists per user (PLAN-01).
-- items: JSONB array of {ticker, category, amount_gbp, rationale}.
-- unified_allocation: JSONB snapshot of the blended strategy used for this plan.
-- One plan per month per user (UNIQUE constraint).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buy_lists (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  month              TEXT NOT NULL,          -- 'YYYY-MM'
  budget_gbp         NUMERIC(10,2) NOT NULL  CHECK (budget_gbp > 0),
  items              JSONB NOT NULL,          -- [{ticker, category, amount_gbp, rationale}]
  unified_allocation JSONB NOT NULL,          -- blended strategy snapshot
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, month)
);

ALTER TABLE public.buy_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own buy lists"
  ON public.buy_lists FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- =============================================================================
-- END OF SCHEMA
-- After running: verify in Table Editor that all 9 tables exist with RLS enabled.
-- Tables: users, creators, user_creators, user_creator_category_weights,
--         holdings, isa_contributions, transcripts, creator_strategies, buy_lists
-- =============================================================================
