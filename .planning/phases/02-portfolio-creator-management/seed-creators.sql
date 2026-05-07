-- HOW TO USE THIS FILE
-- 1. Open Supabase Dashboard → SQL Editor → New query
-- 2. Paste SECTION 1 (schema migration) → Run
-- 3. Paste SECTION 2 (UK creators seed) → Run
-- 4. Paste SECTION 3 (US creators seed) → Run
-- 5. Verify with the SELECT statements in each section.
-- This file is idempotent: safe to re-run.

-- =============================================================================
-- Phase 2 Schema Migration: Add monthly_budget to public.users
-- Run in Supabase SQL Editor BEFORE executing Phase 2 plans.
-- D-03: No CLI migrations — SQL editor only.
-- =============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS monthly_budget NUMERIC(10,2) NOT NULL DEFAULT 0
  CHECK (monthly_budget >= 0);

-- Verify: SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'monthly_budget';

-- =============================================================================
-- Phase 2 Seed: UK Finance Creator List (verified 2026-05-07)
-- Run in Supabase SQL Editor after the schema migration above.
-- D-01: Admin manages via SQL editor. D-02: 5-8 well-known UK finance channels.
-- INSERT ... ON CONFLICT DO NOTHING makes this idempotent (safe to re-run).
-- =============================================================================

INSERT INTO public.creators (channel_url, display_name, is_active)
VALUES
  ('https://www.youtube.com/@DamienTalksMoney', 'Damien Talks Money',  TRUE),
  ('https://www.youtube.com/@TobyNewbatt',      'Toby Newbatt',        TRUE),
  ('https://www.youtube.com/@MoneyUnshackled',  'Money Unshackled',    TRUE),
  ('https://www.youtube.com/@TheHumblePenny',   'The Humble Penny',    TRUE),
  ('https://www.youtube.com/@PensionCraft',     'PensionCraft',        TRUE),
  ('https://www.youtube.com/@JamesShack',       'James Shack',         TRUE),
  ('https://www.youtube.com/@MeaningfulMoney',  'Meaningful Money',    TRUE)
ON CONFLICT (channel_url) DO NOTHING;

-- Verify: SELECT display_name, channel_url FROM public.creators ORDER BY created_at;

-- =============================================================================
-- Phase 2 Seed: US Finance Creator List (verified 2026-05-07)
-- Run after the UK seed above.
-- =============================================================================

INSERT INTO public.creators (channel_url, display_name, is_active)
VALUES
  ('https://www.youtube.com/@GrahamStephan',   'Graham Stephan',      TRUE),
  ('https://www.youtube.com/@AndreiJikh',      'Andrei Jikh',         TRUE),
  ('https://www.youtube.com/@ThePlainBagel',   'The Plain Bagel',     TRUE),
  ('https://www.youtube.com/@BenFelixCSI',     'Ben Felix',           TRUE),
  ('https://www.youtube.com/@TickerSymbolYOU', 'Ticker Symbol: YOU',  TRUE),
  ('https://www.youtube.com/@rob_berger',      'Rob Berger',          TRUE),
  ('https://www.youtube.com/@DividendBull',    'Dividend Bull',       TRUE),
  ('https://www.youtube.com/@FelixPrehn',      'Felix Prehn',         TRUE),
  ('https://www.youtube.com/@MinorityMindset', 'Minority Mindset',    TRUE)
ON CONFLICT (channel_url) DO NOTHING;

-- Verify: SELECT display_name, channel_url FROM public.creators ORDER BY created_at;
