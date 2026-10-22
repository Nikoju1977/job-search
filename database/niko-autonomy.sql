-- NIKO Intelligence 3.0 : surveillance autonome du catalogue public d'offres.
-- Compatible PostgreSQL/Neon, sans Supabase ni n8n. Aucune donnée de candidat.
create table if not exists public.niko_public_jobs (
 url text primary key,
 job_id text not null,
 source text not null,
 title text not null,
 company text not null,
 location text not null,
 contract text not null default '',
 excerpt text not null default '',
 remote boolean not null default false,
 posted_at timestamptz,
 first_seen_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now()
);
create index if not exists niko_public_jobs_recent on public.niko_public_jobs(last_seen_at desc);
create index if not exists niko_public_jobs_source on public.niko_public_jobs(source);
create table if not exists public.niko_scan_runs (
 id bigint generated always as identity primary key,
 started_at timestamptz not null default now(),
 finished_at timestamptz,
 offers_received integer not null default 0,
 added_or_updated integer not null default 0,
 partial boolean not null default false,
 source_status jsonb not null default '{}'::jsonb,
 outcome text not null default 'running' check (outcome in ('running','ok','partial','error'))
);
create index if not exists niko_scan_runs_recent on public.niko_scan_runs(started_at desc);
-- No CVs, addresses or candidate identifiers here: the engine is public-data-only.
-- Use a dedicated least-privilege SQL role for the cron credential.
