-- ============================================================================
-- Time Compression Simulator — leads table
-- Project: "time compression June-July 2026" (Supabase ref nlvkrbzmrtsfjgtcbtye)
--
-- This is the EXACT DDL that was applied via the Supabase Management API on
-- 2026-06-22. Kept here for reference / re-creation. api/lead.js writes with
-- the project's ANON key under an insert-only RLS policy (anon may insert,
-- nobody may read), so no Vercel env vars are required.
-- ============================================================================

create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  -- contact
  name            text not null,
  email           text not null,

  -- segmentation
  role            text,          -- finance | asset | esg | sustainability
  role_label      text,          -- human-readable seat
  answers         jsonb,         -- [q1, q2, q3] option indices
  answer_labels   jsonb,         -- ["6–20", "3–4", "Manual"]

  -- their computed result
  index_pct       integer,       -- time compression %
  reclaimed_weeks integer,
  baseline_weeks  integer,
  edra_weeks      integer,
  start_score     integer,
  start_band      text,

  -- request meta
  ip              text,
  user_agent      text,
  referer         text,
  raw             jsonb          -- full payload, for safety
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_email_idx       on public.leads (email);

-- Insert-only security: anon can write a lead, nobody can read via the API.
-- (Read your leads in the Supabase dashboard Table Editor, which uses the
-- service role and bypasses RLS.)
alter table public.leads enable row level security;
drop policy if exists "anon can insert leads" on public.leads;
create policy "anon can insert leads" on public.leads for insert to anon with check (true);
grant usage on schema public to anon;
grant insert on public.leads to anon;
