-- ============================================================================
-- Time Compression Simulator — leads table
-- Run this in the Supabase project "time compression June-July 2026"
-- (Dashboard → SQL Editor → New query → paste → Run).
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

-- Lock it down: enable RLS with NO public policies. The API writes with the
-- service_role key, which bypasses RLS, so inserts work; anon/public cannot
-- read or write. (Leads must never be publicly readable.)
alter table public.leads enable row level security;
