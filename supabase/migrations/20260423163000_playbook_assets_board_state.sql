alter table public.playbook_assets
add column if not exists board_state jsonb;
