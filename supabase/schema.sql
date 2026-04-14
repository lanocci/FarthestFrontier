create extension if not exists pgcrypto;

create table if not exists public.position_masters (
  id text primary key,
  label text not null,
  side text not null check (side in ('offense', 'defense')),
  created_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grade_label text not null,
  grade_band text not null check (grade_band in ('lower', 'middle', 'upper')),
  guardian_name text not null,
  favorite_skill text,
  offense_position_id text not null references public.position_masters(id),
  defense_position_id text not null references public.position_masters(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.goal_templates (
  id uuid primary key default gen_random_uuid(),
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
  goal_template_id uuid references public.goal_templates(id) on delete set null,
  goal_text text not null,
  log_date date not null default current_date,
  note text,
  submitted_by_role text not null check (submitted_by_role in ('coach', 'guardian')),
  created_at timestamptz not null default now()
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

create trigger materials_set_updated_at
before update on public.materials
for each row
execute function public.set_updated_at();
