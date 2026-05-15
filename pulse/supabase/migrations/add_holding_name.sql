-- Add optional name column to holdings
-- Run in Supabase SQL editor: https://supabase.com/dashboard/project/_/sql

ALTER TABLE public.holdings
  ADD COLUMN IF NOT EXISTS name TEXT;
