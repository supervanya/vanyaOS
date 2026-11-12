-- Per-account preferences that aren't config rows (metrics/habits/goals) and
-- aren't secrets (ai_settings). One row per account, created on the first
-- change; no row means every default below.
create table public.user_settings (
  user_id uuid primary key references auth.users default auth.uid(),
  -- Whether `/` opens on /morning until today's morning is set.
  morning_redirect boolean not null default true,
  -- When the morning closes: `/` stops redirecting, and "Skip today" goes
  -- away. Minutes after local midnight; 720 = 12:00.
  morning_closes_at smallint not null default 720
    check (morning_closes_at between 0 and 1439),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.user_settings to authenticated;

alter table public.user_settings enable row level security;

create policy "user_settings_owner" on public.user_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();
