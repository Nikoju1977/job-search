-- NIKO EMPLOI / AUTONOMOUS INTELLIGENCE 4
-- PostgreSQL 15+ / Neon. No Supabase, no n8n.
-- Run once with an owner connection. Use restricted runtime role for the app.
create extension if not exists pgcrypto;
create table if not exists public.niko_users (
 id uuid primary key default gen_random_uuid(),
 email text not null unique,
 created_at timestamptz not null default now(),
 deleted_at timestamptz
);
create table if not exists public.niko_login_links (
 token_hash text primary key,
 email text not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 consumed_at timestamptz
);
create index if not exists niko_login_links_email on public.niko_login_links(email,created_at desc);
create table if not exists public.niko_sessions (
 token_hash text primary key,
 user_id uuid not null references public.niko_users(id) on delete cascade,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 revoked_at timestamptz
);
create index if not exists niko_sessions_user on public.niko_sessions(user_id);
create table if not exists public.niko_profiles (
 user_id uuid primary key references public.niko_users(id) on delete cascade,
 full_name text not null default '',
 target_role text not null default '',
 target_location text not null default '',
 cv_ciphertext text,
 preferences jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
create table if not exists public.niko_applications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.niko_users(id) on delete cascade,
 job_url text not null,
 title text not null,
 company text not null,
 location text not null default '',
 source text not null default '',
 recipient_email text,
 letter_ciphertext text,
 status text not null default 'draft' check(status in ('draft','sent','reply','interview','rejected','hired','failed')),
 gmail_thread_id text,
 gmail_message_id text,
 sent_at timestamptz,
 updated_at timestamptz not null default now(),
 unique(user_id,job_url)
);
create index if not exists niko_applications_user on public.niko_applications(user_id,updated_at desc);
create table if not exists public.niko_agent_policies (
 user_id uuid primary key references public.niko_users(id) on delete cascade,
 enabled boolean not null default false,
 consent_at timestamptz,
 min_score integer not null default 50 check(min_score between 0 and 100),
 remote_only boolean not null default false,
 inclusive_only boolean not null default false,
 max_results integer not null default 20 check(max_results between 1 and 50),
 updated_at timestamptz not null default now()
);
create table if not exists public.niko_agent_matches (
 user_id uuid not null references public.niko_users(id) on delete cascade,
 job_url text not null references public.niko_public_jobs(url) on delete cascade,
 score integer not null check(score between 0 and 100),
 explanation jsonb not null default '{}'::jsonb,
 status text not null default 'suggested' check(status in ('suggested','saved','dismissed')),
 first_seen_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 primary key(user_id,job_url)
);
create index if not exists niko_agent_matches_top on public.niko_agent_matches(user_id,score desc);
create table if not exists public.niko_agent_runs (
 id bigint generated always as identity primary key,
 user_id uuid references public.niko_users(id) on delete set null,
 started_at timestamptz not null default now(),
 run_day date not null default (now() at time zone 'UTC')::date,
 finished_at timestamptz,
 outcome text not null default 'running' check(outcome in ('running','ok','error','skipped')),
 matches_found integer not null default 0,
 error_code text
);
create index if not exists niko_agent_runs_user on public.niko_agent_runs(user_id,started_at desc);
-- The original niko_public_jobs and niko_scan_runs tables are in niko-autonomy.sql.
-- No unrestricted public database access: SQL credentials remain server-side.
-- User data is isolated in every SQL query by the authenticated user_id.

create unique index if not exists niko_agent_runs_one_daily on public.niko_agent_runs(user_id,run_day) where user_id is not null;
