-- Niko Emploi V2 | Supabase SQL Editor, exécuter une seule fois.
-- Les données des utilisateurs sont isolées par RLS, l'application serveur utilise
-- une clé de service côté serveur uniquement, après vérification du jeton Auth.
create extension if not exists pgcrypto;
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  target_role text not null default '',
  target_location text not null default '',
  cv_ciphertext text,
  updated_at timestamptz not null default now()
);
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_url text not null,
  title text not null,
  company text not null,
  location text not null default '',
  source text not null default '',
  recipient_email text,
  letter_ciphertext text,
  status text not null default 'draft' check (status in ('draft','sent','reply','interview','rejected','hired','failed')),
  gmail_thread_id text,
  gmail_message_id text,
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(user_id,job_url)
);
create index if not exists applications_user_status on public.applications(user_id,status);
create table if not exists public.gmail_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  refresh_ciphertext text not null,
  auto_monitor boolean not null default false,
  auto_ack boolean not null default false,
  updated_at timestamptz not null default now()
);
create table if not exists public.agent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  gmail_message_id text not null,
  category text not null check (category in ('favorable','defavorable','entretien','a_verifier')),
  draft_ciphertext text,
  status text not null default 'pending' check (status in ('pending','auto_sent','manually_sent','dismissed','auto_failed')),
  reply_message_id text,
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,gmail_message_id)
);
create index if not exists agent_events_pending on public.agent_events(user_id,status);
create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  company text not null,
  title text not null,
  scheduled_at timestamptz,
  notes_ciphertext text,
  status text not null default 'a_preparer' check (status in ('a_preparer','planifie','termine','annule')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.applications enable row level security;
alter table public.gmail_connections enable row level security;
alter table public.agent_events enable row level security;
alter table public.interviews enable row level security;
revoke all on public.profiles,public.applications,public.gmail_connections,public.agent_events,public.interviews from anon, authenticated;
-- Pas de policies directes : toutes les opérations passent par le serveur qui
-- valide le compte auprès de Supabase Auth et filtre par user_id.
-- service_role conserve ses privilèges de propriétaire/BYPASSRLS.
