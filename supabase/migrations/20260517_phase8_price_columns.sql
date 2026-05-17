-- Phase 8: Live Price Data
-- Run in Supabase SQL Editor (Dashboard → SQL Editor)
ALTER TABLE public.holdings
  ADD COLUMN IF NOT EXISTS current_price NUMERIC,
  ADD COLUMN IF NOT EXISTS price_fetched_at TIMESTAMPTZ;
