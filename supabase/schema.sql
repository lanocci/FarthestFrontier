create extension if not exists pgcrypto;

create table if not exists public.team_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null check (role in ('coach', 'guardian')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table if exists public.team_members
add column if not exists email text;

update public.team_members tm
set email = lower(au.email)
from auth.users au
where tm.user_id = au.id
  and au.email is not null
  and (tm.email is null or tm.email = '');

create unique index if not exists team_members_email_unique
on public.team_members (lower(email))
where email is not null;

create table if not exists public.position_masters (
  id text primary key,
  label text not null,
  side text not null check (side in ('offense', 'defense')),
  created_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  jersey_number text,
  grade_label text not null,
  guardian_name text not null,
  favorite_skill text,
  offense_position_ids text[] not null default '{}'::text[],
  defense_position_ids text[] not null default '{}'::text[],
  offense_goal text,
  defense_goal text,
  offense_reflection_rating smallint check (offense_reflection_rating between 1 and 5),
  offense_reflection_comment text,
  defense_reflection_rating smallint check (defense_reflection_rating between 1 and 5),
  defense_reflection_comment text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.goal_templates (
  id text primary key,
  side text not null check (side in ('offense', 'defense')),
  title text not null,
  prompt text not null,
  emoji text not null default '🏈',
  color text not null default 'orange',
  template_text text not null,
  input_placeholder text,
  created_at timestamptz not null default now()
);

create table if not exists public.goal_logs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  goal_template_id text references public.goal_templates(id) on delete set null,
  goal_text text not null,
  log_date date not null default current_date,
  note text,
  submitted_by_role text not null check (submitted_by_role in ('coach', 'guardian')),
  created_at timestamptz not null default now()
);

alter table if exists public.goal_logs
drop constraint if exists goal_logs_goal_template_id_fkey;

alter table if exists public.goal_templates
alter column id drop default;

alter table if exists public.goal_templates
alter column id type text using id::text;

alter table if exists public.goal_logs
alter column goal_template_id type text using goal_template_id::text;

alter table if exists public.goal_logs
add constraint goal_logs_goal_template_id_fkey
foreign key (goal_template_id) references public.goal_templates(id) on delete set null;

alter table if exists public.players
drop constraint if exists players_offense_position_id_fkey;

alter table if exists public.players
drop constraint if exists players_defense_position_id_fkey;

alter table if exists public.players
add column if not exists offense_position_ids text[] not null default '{}'::text[];

alter table if exists public.players
add column if not exists defense_position_ids text[] not null default '{}'::text[];

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'players' and column_name = 'offense_position_id'
  ) then
    execute '
      update public.players
      set offense_position_ids = array[offense_position_id]
      where offense_position_id is not null
        and cardinality(offense_position_ids) = 0
    ';

    execute 'alter table public.players drop column if exists offense_position_id';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'players' and column_name = 'defense_position_id'
  ) then
    execute '
      update public.players
      set defense_position_ids = array[defense_position_id]
      where defense_position_id is not null
        and cardinality(defense_position_ids) = 0
    ';

    execute 'alter table public.players drop column if exists defense_position_id';
  end if;
end $$;

create table if not exists public.practice_entries (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  practice_date date not null,
  offense_goal text,
  defense_goal text,
  offense_reflection_rating smallint check (offense_reflection_rating between 1 and 5),
  offense_reflection_comment text,
  defense_reflection_rating smallint check (defense_reflection_rating between 1 and 5),
  defense_reflection_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, practice_date)
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  material_type text not null check (material_type in ('slide', 'sheet', 'doc')),
  audience text not null check (audience in ('all', 'guardians', 'coaches')),
  google_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists materials_set_updated_at on public.materials;
drop trigger if exists practice_entries_set_updated_at on public.practice_entries;

create trigger materials_set_updated_at
before update on public.materials
for each row
execute function public.set_updated_at();

create trigger practice_entries_set_updated_at
before update on public.practice_entries
for each row
execute function public.set_updated_at();

create or replace function public.current_team_role()
returns text
language sql
stable
as $$
  select tm.role
  from public.team_members tm
  where tm.user_id = auth.uid()
$$;

create or replace function public.current_membership_status()
returns text
language sql
stable
as $$
  select tm.status
  from public.team_members tm
  where tm.user_id = auth.uid()
$$;

create or replace function public.is_team_member()
returns boolean
language sql
stable
as $$
  select public.current_team_role() in ('coach', 'guardian')
    and public.current_membership_status() = 'approved'
$$;

create or replace function public.is_coach()
returns boolean
language sql
stable
as $$
  select public.current_team_role() = 'coach'
$$;

create or replace function public.claim_team_member_by_email(login_email text)
returns table (
  user_id uuid,
  email text,
  role text,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(login_email));
begin
  if auth.uid() is null or normalized_email is null or normalized_email = '' then
    return;
  end if;

  return query
  with existing_self as (
    select tm.user_id, tm.email, tm.role, tm.status
    from public.team_members tm
    where tm.user_id = auth.uid()
  ),
  claimed as (
    update public.team_members tm
    set user_id = auth.uid(),
        email = normalized_email
    where not exists (select 1 from existing_self)
      and lower(coalesce(tm.email, '')) = normalized_email
    returning tm.user_id, tm.email, tm.role, tm.status
  )
  select es.user_id, es.email, es.role, es.status
  from existing_self es
  union all
  select c.user_id, c.email, c.role, c.status
  from claimed c
  limit 1;
end;
$$;

alter table public.team_members enable row level security;
alter table public.position_masters enable row level security;
alter table public.players enable row level security;
alter table public.goal_templates enable row level security;
alter table public.goal_logs enable row level security;
alter table public.practice_entries enable row level security;
alter table public.materials enable row level security;

drop policy if exists "team_members_select_self" on public.team_members;
create policy "team_members_select_self"
on public.team_members
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "team_members_insert_self" on public.team_members;
create policy "team_members_insert_self"
on public.team_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  and role = 'guardian'
  and status = 'pending'
);

drop policy if exists "team_members_manage_coaches" on public.team_members;
create policy "team_members_manage_coaches"
on public.team_members
for update
to authenticated
using (public.is_coach())
with check (public.is_coach());

drop policy if exists "position_masters_select_team_members" on public.position_masters;
create policy "position_masters_select_team_members"
on public.position_masters
for select
to authenticated
using (public.is_team_member());

drop policy if exists "position_masters_manage_coaches" on public.position_masters;
create policy "position_masters_manage_coaches"
on public.position_masters
for all
to authenticated
using (public.is_coach())
with check (public.is_coach());

drop policy if exists "players_select_team_members" on public.players;
create policy "players_select_team_members"
on public.players
for select
to authenticated
using (public.is_team_member());

drop policy if exists "players_manage_coaches" on public.players;
create policy "players_manage_coaches"
on public.players
for all
to authenticated
using (public.is_coach())
with check (public.is_coach());

drop policy if exists "goal_templates_select_team_members" on public.goal_templates;
create policy "goal_templates_select_team_members"
on public.goal_templates
for select
to authenticated
using (public.is_team_member());

drop policy if exists "goal_templates_manage_coaches" on public.goal_templates;
create policy "goal_templates_manage_coaches"
on public.goal_templates
for all
to authenticated
using (public.is_coach())
with check (public.is_coach());

drop policy if exists "goal_logs_select_team_members" on public.goal_logs;
create policy "goal_logs_select_team_members"
on public.goal_logs
for select
to authenticated
using (public.is_team_member());

drop policy if exists "goal_logs_manage_coaches" on public.goal_logs;
create policy "goal_logs_manage_coaches"
on public.goal_logs
for all
to authenticated
using (public.is_coach())
with check (public.is_coach());

drop policy if exists "practice_entries_select_team_members" on public.practice_entries;
create policy "practice_entries_select_team_members"
on public.practice_entries
for select
to authenticated
using (public.is_team_member());

drop policy if exists "practice_entries_manage_team_members" on public.practice_entries;
create policy "practice_entries_manage_team_members"
on public.practice_entries
for all
to authenticated
using (public.is_team_member())
with check (public.is_team_member());

drop policy if exists "materials_select_team_members" on public.materials;
create policy "materials_select_team_members"
on public.materials
for select
to authenticated
using (
  public.is_coach()
  or (
    public.is_team_member()
    and audience in ('all', 'guardians')
  )
);

drop policy if exists "materials_manage_coaches" on public.materials;
create policy "materials_manage_coaches"
on public.materials
for all
to authenticated
using (public.is_coach())
with check (public.is_coach());
