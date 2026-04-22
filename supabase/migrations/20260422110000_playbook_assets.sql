create table if not exists public.playbook_assets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  side text not null check (side in ('offense', 'defense')),
  formation text not null,
  play_type text not null,
  image_path text not null,
  audience text not null default 'coaches' check (audience in ('all', 'guardians', 'coaches')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (side, formation, play_type)
);

alter table if exists public.playbook_assets
add column if not exists title text not null default '';

alter table if exists public.playbook_assets
add column if not exists side text not null default 'offense';

alter table if exists public.playbook_assets
add column if not exists formation text not null default '';

alter table if exists public.playbook_assets
add column if not exists play_type text not null default '';

alter table if exists public.playbook_assets
add column if not exists image_path text not null default '';

alter table if exists public.playbook_assets
add column if not exists audience text not null default 'coaches';

alter table if exists public.playbook_assets
add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'playbook_assets_side_formation_play_type_key'
  ) then
    alter table public.playbook_assets
    add constraint playbook_assets_side_formation_play_type_key unique (side, formation, play_type);
  end if;
end $$;

drop trigger if exists playbook_assets_set_updated_at on public.playbook_assets;

create trigger playbook_assets_set_updated_at
before update on public.playbook_assets
for each row
execute function public.set_updated_at();

alter table public.playbook_assets enable row level security;

drop policy if exists "playbook_assets_select_team_members" on public.playbook_assets;
create policy "playbook_assets_select_team_members"
on public.playbook_assets
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

drop policy if exists "playbook_assets_manage_coaches" on public.playbook_assets;
create policy "playbook_assets_manage_coaches"
on public.playbook_assets
for all
to authenticated
using (public.is_coach())
with check (public.is_coach());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'playbooks',
  'playbooks',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

drop policy if exists "playbooks_select_team_members" on storage.objects;
create policy "playbooks_select_team_members"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'playbooks'
  and public.is_team_member()
);

drop policy if exists "playbooks_insert_coaches" on storage.objects;
create policy "playbooks_insert_coaches"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'playbooks'
  and public.is_coach()
);

drop policy if exists "playbooks_update_coaches" on storage.objects;
create policy "playbooks_update_coaches"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'playbooks'
  and public.is_coach()
)
with check (
  bucket_id = 'playbooks'
  and public.is_coach()
);

drop policy if exists "playbooks_delete_coaches" on storage.objects;
create policy "playbooks_delete_coaches"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'playbooks'
  and public.is_coach()
);
