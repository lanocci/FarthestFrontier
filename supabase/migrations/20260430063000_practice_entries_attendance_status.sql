alter table public.practice_entries
add column if not exists attendance_status text
check (attendance_status in ('present', 'absent'));
