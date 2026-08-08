-- M4: bring-your-own AI provider + retrospectives (docs/ROADMAP.md M4).

-- Per-user AI configuration: BYO provider + key. The app holds zero AI
-- secrets — each account stores its own. RLS-protected; consider Supabase
-- Vault encryption before any multi-user future.
create table ai_settings (
  user_id uuid primary key references auth.users default auth.uid(),
  provider text not null check (provider in ('anthropic', 'openai', 'google')),
  model text not null,
  api_key text not null,
  updated_at timestamptz not null default now()
);

-- Retro areas (seeded app-side: Finances, Health, Exercise, Work) —
-- Settings-managed, same CRUD+archive pattern as habits.
create table retro_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users default auth.uid(),
  key text not null,
  label text not null,
  sort_order int not null default 0,
  archived boolean not null default false,
  unique (user_id, key)
);

-- Each retro run (or manual edit/seed) snapshots the area's living
-- state-of-affairs markdown doc. The area's current doc = its latest row;
-- history is every prior row. Never overwrite.
create table retros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users default auth.uid(),
  area_id uuid not null references retro_areas on delete cascade,
  doc_md text not null,
  ai_summary text,                   -- what the coach changed (null for manual versions)
  model text,                        -- "provider:model" used (null for manual)
  created_at timestamptz not null default now()
);

create index retros_area_latest on retros (area_id, created_at desc);

-- Grants + RLS. Table-level grants are required per-table (the init
-- migration's blanket grant only covered then-existing tables).
grant select, insert, update, delete on ai_settings, retro_areas, retros to authenticated;

alter table ai_settings enable row level security;
alter table retro_areas enable row level security;
alter table retros enable row level security;

create policy "ai_settings_owner" on ai_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "retro_areas_owner" on retro_areas
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "retros_owner" on retros
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
