create table if not exists public.clip_whiteboards (
  id uuid primary key default gen_random_uuid(),
  clip_id uuid not null references public.film_clips(id) on delete cascade,
  title text not null,
  base_mode text not null check (base_mode in ('blank', 'playbook')),
  base_playbook_asset_id uuid references public.playbook_assets(id) on delete set null,
  image_path text not null,
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.clip_whiteboards
add column if not exists title text not null default '';

alter table if exists public.clip_whiteboards
add column if not exists base_mode text not null default 'blank';

alter table if exists public.clip_whiteboards
add column if not exists base_playbook_asset_id uuid references public.playbook_assets(id) on delete set null;

alter table if exists public.clip_whiteboards
add column if not exists image_path text not null default '';

alter table if exists public.clip_whiteboards
add column if not exists sort_order integer not null default 1;

alter table if exists public.clip_whiteboards
add column if not exists updated_at timestamptz not null default now();

drop trigger if exists clip_whiteboards_set_updated_at on public.clip_whiteboards;

create trigger clip_whiteboards_set_updated_at
before update on public.clip_whiteboards
for each row
execute function public.set_updated_at();

alter table public.clip_whiteboards enable row level security;

drop policy if exists "clip_whiteboards_select_team_members" on public.clip_whiteboards;
create policy "clip_whiteboards_select_team_members"
on public.clip_whiteboards
for select
to authenticated
using (
  public.is_team_member()
  and exists (
    select 1
    from public.film_clips fc
    join public.film_videos fv on fv.id = fc.video_id
    where fc.id = clip_whiteboards.clip_id
      and (
        fv.audience = 'all'
        or (fv.audience = 'guardians' and public.current_team_role() = 'guardian')
        or (fv.audience = 'coaches' and public.current_team_role() = 'coach')
      )
  )
);

drop policy if exists "clip_whiteboards_manage_coaches" on public.clip_whiteboards;
create policy "clip_whiteboards_manage_coaches"
on public.clip_whiteboards
for all
to authenticated
using (public.is_coach())
with check (public.is_coach());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clip-whiteboards',
  'clip-whiteboards',
  false,
  10485760,
  array['image/png']
)
on conflict (id) do nothing;

drop policy if exists "clip_whiteboards_storage_select_team_members" on storage.objects;
create policy "clip_whiteboards_storage_select_team_members"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'clip-whiteboards'
  and public.is_team_member()
);

drop policy if exists "clip_whiteboards_storage_insert_coaches" on storage.objects;
create policy "clip_whiteboards_storage_insert_coaches"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'clip-whiteboards'
  and public.is_coach()
);

drop policy if exists "clip_whiteboards_storage_update_coaches" on storage.objects;
create policy "clip_whiteboards_storage_update_coaches"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'clip-whiteboards'
  and public.is_coach()
)
with check (
  bucket_id = 'clip-whiteboards'
  and public.is_coach()
);

drop policy if exists "clip_whiteboards_storage_delete_coaches" on storage.objects;
create policy "clip_whiteboards_storage_delete_coaches"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'clip-whiteboards'
  and public.is_coach()
);
