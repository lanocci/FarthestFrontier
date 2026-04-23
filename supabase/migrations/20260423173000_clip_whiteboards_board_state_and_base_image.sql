alter table public.clip_whiteboards
add column if not exists board_state jsonb;

alter table public.clip_whiteboards
add column if not exists base_image_path text;
