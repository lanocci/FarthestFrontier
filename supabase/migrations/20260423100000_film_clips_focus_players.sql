alter table public.film_clips
add column if not exists focus_targets text[] not null default '{}'::text[];
