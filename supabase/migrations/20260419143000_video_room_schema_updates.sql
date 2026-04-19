create table if not exists public.formation_masters (
  id text primary key,
  label text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.play_type_masters (
  id text primary key,
  label text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.penalty_type_masters (
  id text primary key,
  label text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.film_videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  youtube_url text not null,
  audience text not null check (audience in ('all', 'guardians', 'coaches')),
  source_label text not null default '',
  match_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.film_videos
add column if not exists description text not null default '';

alter table if exists public.film_videos
add column if not exists audience text not null default 'all';

alter table if exists public.film_videos
add column if not exists source_label text not null default '';

alter table if exists public.film_videos
add column if not exists match_date date;

alter table if exists public.film_videos
add column if not exists updated_at timestamptz not null default now();

create table if not exists public.film_clips (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.film_videos(id) on delete cascade,
  title text not null,
  start_seconds integer not null check (start_seconds >= 0),
  end_seconds integer not null check (end_seconds > start_seconds),
  down integer,
  to_go_yards text,
  penalty_type text,
  formation text not null default '',
  play_type text not null default '',
  comment text not null default '',
  coach_comment text,
  player_links jsonb not null default '[]'::jsonb,
  sort_order integer not null default 1,
  created_at timestamptz not null default now()
);

alter table if exists public.film_clips
add column if not exists down integer;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'film_clips'
      and column_name = 'down'
      and data_type <> 'integer'
  ) then
    execute '
      alter table public.film_clips
      alter column down type integer
      using nullif(regexp_replace(coalesce(down::text, ''''), ''[^0-9]'', '''', ''g''), '''')::integer
    ';
  end if;
end $$;

alter table if exists public.film_clips
add column if not exists to_go_yards text;

alter table if exists public.film_clips
add column if not exists penalty_type text;

alter table if exists public.film_clips
add column if not exists formation text not null default '';

alter table if exists public.film_clips
add column if not exists play_type text not null default '';

alter table if exists public.film_clips
add column if not exists comment text not null default '';

alter table if exists public.film_clips
add column if not exists coach_comment text;

alter table if exists public.film_clips
add column if not exists player_links jsonb not null default '[]'::jsonb;

alter table if exists public.film_clips
add column if not exists sort_order integer not null default 1;

alter table if exists public.film_clips
drop column if exists player_label;

drop trigger if exists film_videos_set_updated_at on public.film_videos;

create trigger film_videos_set_updated_at
before update on public.film_videos
for each row
execute function public.set_updated_at();

alter table public.formation_masters enable row level security;
alter table public.play_type_masters enable row level security;
alter table public.penalty_type_masters enable row level security;
alter table public.film_videos enable row level security;
alter table public.film_clips enable row level security;

drop policy if exists "formation_masters_select_team_members" on public.formation_masters;
create policy "formation_masters_select_team_members"
on public.formation_masters
for select
to authenticated
using (public.is_team_member());

drop policy if exists "formation_masters_manage_coaches" on public.formation_masters;
create policy "formation_masters_manage_coaches"
on public.formation_masters
for all
to authenticated
using (public.is_coach())
with check (public.is_coach());

drop policy if exists "play_type_masters_select_team_members" on public.play_type_masters;
create policy "play_type_masters_select_team_members"
on public.play_type_masters
for select
to authenticated
using (public.is_team_member());

drop policy if exists "play_type_masters_manage_coaches" on public.play_type_masters;
create policy "play_type_masters_manage_coaches"
on public.play_type_masters
for all
to authenticated
using (public.is_coach())
with check (public.is_coach());

drop policy if exists "penalty_type_masters_select_team_members" on public.penalty_type_masters;
create policy "penalty_type_masters_select_team_members"
on public.penalty_type_masters
for select
to authenticated
using (public.is_team_member());

drop policy if exists "penalty_type_masters_manage_coaches" on public.penalty_type_masters;
create policy "penalty_type_masters_manage_coaches"
on public.penalty_type_masters
for all
to authenticated
using (public.is_coach())
with check (public.is_coach());

drop policy if exists "film_videos_select_team_members" on public.film_videos;
create policy "film_videos_select_team_members"
on public.film_videos
for select
to authenticated
using (
  public.is_team_member()
  and (
    audience = 'all'
    or (audience = 'guardians' and public.current_team_role() = 'guardian')
    or (audience = 'coaches' and public.current_team_role() = 'coach')
  )
);

drop policy if exists "film_videos_manage_coaches" on public.film_videos;
create policy "film_videos_manage_coaches"
on public.film_videos
for all
to authenticated
using (public.is_coach())
with check (public.is_coach());

drop policy if exists "film_clips_select_team_members" on public.film_clips;
create policy "film_clips_select_team_members"
on public.film_clips
for select
to authenticated
using (
  public.is_team_member()
  and exists (
    select 1
    from public.film_videos fv
    where fv.id = film_clips.video_id
      and (
        fv.audience = 'all'
        or (fv.audience = 'guardians' and public.current_team_role() = 'guardian')
        or (fv.audience = 'coaches' and public.current_team_role() = 'coach')
      )
  )
);

drop policy if exists "film_clips_manage_coaches" on public.film_clips;
create policy "film_clips_manage_coaches"
on public.film_clips
for all
to authenticated
using (public.is_coach())
with check (public.is_coach());
