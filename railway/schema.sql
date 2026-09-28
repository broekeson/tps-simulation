-- ============================================================
-- The Payment School · Risk & AML in Acquiring
-- Railway PostgreSQL Schema & PostgREST Setup
-- ============================================================

-- 1. Create Tables
create table if not exists public.profiles (
  id text primary key,
  name text not null,
  email text unique,
  pin text,
  pass_hash text,
  role text not null default 'learner',
  cohort text,
  avatar jsonb,
  created_at timestamptz not null default now(),
  team text
);

create table if not exists public.enrollments (
  profile_id text not null references public.profiles(id) on delete cascade,
  course_id text not null,
  unlocked boolean not null default true,
  passcode_used text,
  sort integer not null default 0,
  enrolled_at timestamptz not null default now(),
  primary key (profile_id, course_id)
);

create table if not exists public.course_configs (
  course_id text primary key,
  mode text not null default 'key',
  passcode text not null default '',
  seats integer default 40,
  updated_at timestamptz not null default now()
);

-- Seed Initial Course Configurations
insert into public.course_configs (course_id, mode, passcode, seats)
values
  ('intro-to-payments', 'open', '', 100),
  ('risk-aml-acquiring', 'key', 'AML-2026', 40),
  ('scheme-fees', 'key', 'FEES-2026', 40),
  ('the-dispute-desk', 'key', 'DISPUTE-2026', 30),
  ('fifth-institution', 'key', 'FIFTH-2026', 30)
on conflict (course_id) do nothing;

create table if not exists public.sessions (
  id text primary key,
  profile_id text not null references public.profiles(id) on delete cascade,
  course_id text not null,
  scenario_id text not null,
  attempt integer not null default 1,
  composite integer not null,
  points integer not null,
  net integer not null,
  sim_day integer,
  outcome text not null default 'scored',
  mistakes jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id bigint generated always as identity primary key,
  session_id text,
  profile_id text,
  course_id text,
  scenario_id text,
  node text,
  type text not null,
  payload jsonb,
  ts timestamptz,
  created_at timestamptz not null default now()
);

-- 2. Indexes
create index if not exists profiles_email_idx on public.profiles(email);
create index if not exists sessions_profile_course_idx on public.sessions(profile_id, course_id, scenario_id, created_at);
create index if not exists events_profile_idx on public.events(profile_id);
create index if not exists enrollments_course_idx on public.enrollments(course_id);

-- 3. Views (Leaderboard & Day Leaderboard)
create or replace view public.leaderboard as
with best as (
  select profile_id, course_id, scenario_id, max(points) as best_pts
  from public.sessions group by 1,2,3
), lastnet as (
  select distinct on (profile_id, course_id, scenario_id)
    profile_id, course_id, scenario_id, net
  from public.sessions
  order by profile_id, course_id, scenario_id, created_at desc
)
select b.course_id, b.profile_id, p.name, p.cohort,
       sum(b.best_pts)::integer as points, sum(l.net)::integer as net
from best b
join lastnet l using (profile_id, course_id, scenario_id)
join public.profiles p on p.id = b.profile_id
group by b.course_id, b.profile_id, p.name, p.cohort;

create or replace view public.leaderboard_days as
with best as (
  select profile_id, course_id, scenario_id, max(points) as best_pts
  from public.sessions group by 1,2,3
), lastnet as (
  select distinct on (profile_id, course_id, scenario_id)
    profile_id, course_id, scenario_id, net
  from public.sessions
  order by profile_id, course_id, scenario_id, created_at desc
)
select b.course_id, b.scenario_id, b.profile_id, p.name, p.team, p.cohort,
       b.best_pts::integer as points, l.net::integer as net
from best b
join lastnet l using (profile_id, course_id, scenario_id)
join public.profiles p on p.id = b.profile_id;

-- 4. Facilitator RPC (Delete Profile & Sessions)
create or replace function public.facilitator_delete_profile(p_id text, p_code text)
returns boolean
language plpgsql
security definer
as $$
begin
  if upper(trim(p_code)) <> 'CATALYST' then
    return false;
  end if;
  delete from public.events where profile_id = p_id;
  delete from public.sessions where profile_id = p_id;
  delete from public.enrollments where profile_id = p_id;
  delete from public.profiles where id = p_id;
  return true;
end;
$$;

-- 5. PostgREST Roles & Permissions
-- Run this once on the database to grant access to the PostgREST API
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticator') then
    -- Change password to match PGRST_DB_URI in PostgREST
    create role authenticator noinherit login password 'railway_postgrest_pass';
  end if;
end
$$;

grant anon to authenticator;

grant usage on schema public to anon;
grant select, insert, update on all tables in schema public to anon;
grant usage, select on all sequences in schema public to anon;
grant select on public.leaderboard, public.leaderboard_days to anon;
grant execute on function public.facilitator_delete_profile(text, text) to anon;

alter default privileges in schema public grant select, insert, update on tables to anon;
alter default privileges in schema public grant usage, select on sequences to anon;
