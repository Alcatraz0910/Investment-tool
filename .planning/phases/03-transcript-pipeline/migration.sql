-- =============================================================================
-- Pulse — Phase 3 Schema Migration
-- Phase 3: Transcript Pipeline
-- Deploy via: Supabase SQL Editor (Project → SQL Editor → New query → paste → Run)
-- D-03: No CLI migrations. SQL editor only.
-- D-11: Adds last_refreshed_at column missed in Phase 1 schema.
-- D-05 exception: This is the approved schema addition for Phase 3.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Migration 1: user_creators.last_refreshed_at (D-11)
-- Nullable. NULL = never refreshed.
-- Updated by API Route via service role after successful pipeline run (D-12).
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_creators
  ADD COLUMN IF NOT EXISTS last_refreshed_at TIMESTAMPTZ;


-- ---------------------------------------------------------------------------
-- Migration 2: public.refresh_jobs (RESEARCH Pattern 9)
-- Tracks per-(user, creator) pipeline progress for client polling.
-- One row per (user_id, creator_id); upserted on each refresh trigger.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.refresh_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  creator_id  UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'idle'
    CHECK (status IN ('running', 'done', 'error', 'idle')),
  step        TEXT,
  summary     TEXT,
  error       TEXT,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, creator_id)
);

ALTER TABLE public.refresh_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own refresh jobs"
  ON public.refresh_jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- INSERT/UPDATE/DELETE handled by app backend (service role); no authenticated policy
-- (matches public.transcripts policy idiom — schema.sql lines 217-222)
