alter table public.clip_whiteboards
drop constraint if exists clip_whiteboards_base_mode_check;

alter table public.clip_whiteboards
add constraint clip_whiteboards_base_mode_check
check (base_mode in ('blank', 'playbook', 'image'));
