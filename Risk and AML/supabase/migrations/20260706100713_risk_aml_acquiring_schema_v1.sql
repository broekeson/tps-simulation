-- Risk and AML in Acquiring · schema v1
-- Applied to project mrvxaqealofcwlbovolx as migration 20260706100713.
-- Faithful replica of the payment-school-sim pilot schema, carried forward.

create table public.profiles (
  id text primary key,
  name text not null,
  cohort text,
  avatar jsonb,
  created_at timestamptz not null default now(),
  team text
);
create table public.enrollments (
  profile_id text not null references public.profiles(id),
  course_id text not null,
  sort integer not null default 0,
  primary key (profile_id, course_id)
);
create table public.sessions (
  id text primary key,
  profile_id text not null references public.profiles(id),
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
create table public.events (
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
create index sessions_profile_course_idx on public.sessions(profile_id, course_id, scenario_id, created_at);
create index events_profile_idx on public.events(profile_id);
create index enrollments_course_idx on public.enrollments(course_id);

alter table public.profiles enable row level security;
alter table public.enrollments enable row level security;
alter table public.sessions enable row level security;
alter table public.events enable row level security;

create policy "anon read profiles" on public.profiles for select to anon, authenticated using (true);
create policy "anon can register profile" on public.profiles for insert to anon
  with check (
    id like 'prf_%' and char_length(id) between 8 and 64
    and char_length(name) between 2 and 40
    and (cohort is null or char_length(cohort) <= 24)
    and (team is null or char_length(team) between 2 and 40)
    and (avatar is null or pg_column_size(avatar) < 2048)
  );
create policy "anon update profile avatar" on public.profiles for update to anon, authenticated
  using (id like 'prf\_%') with check (id like 'prf\_%');
create policy "anon read enrollments" on public.enrollments for select to anon, authenticated using (true);
create policy "anon can enroll" on public.enrollments for insert to anon
  with check (
    profile_id like 'prf_%'
    and course_id in ('intro-to-payments','risk-aml-acquiring')
    and sort between 0 and 9
  );
create policy "anon read sessions" on public.sessions for select to anon, authenticated using (true);
create policy "anon insert sessions" on public.sessions for insert to anon, authenticated
  with check (
    profile_id like 'prf\_%' and char_length(id) <= 40
    and composite between 0 and 100 and points between 0 and 2000
    and net between -1000000 and 1000000
    and (sim_day is null or sim_day between 0 and 365)
  );
create policy "anon insert events" on public.events for insert to anon, authenticated
  with check (type is not null and char_length(type) <= 40 and pg_column_size(payload) < 8192);

revoke update, delete on public.profiles from anon, authenticated;
revoke insert on public.profiles from authenticated;
grant update (avatar) on public.profiles to anon, authenticated;

create view public.leaderboard with (security_invoker = on) as
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

create view public.leaderboard_days with (security_invoker = on) as
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

grant select on public.leaderboard, public.leaderboard_days to anon, authenticated;
