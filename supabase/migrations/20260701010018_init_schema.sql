-- VanyaOS v2 schema (ADR-002 / ARCHITECTURE.md).
-- Every table is scoped by user_id and gated by RLS (`user_id = auth.uid()`).
-- Single-tenant today, but the isolation is free.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Config tables: metrics / habits / goals. DB-editable now (no in-app
-- Settings UI yet) instead of the old hardcoded config.ts.
-- ---------------------------------------------------------------------------

create table metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users default auth.uid(),
  key text not null,                 -- e.g. 'brain_fog'
  label text not null,
  group_name text not null,          -- 'Discipline' | 'Stimulation' | 'Symptoms'
  higher_is_better boolean not null default true,
  scale int not null default 5,
  sort_order int not null default 0,
  unique (user_id, key)
);

create table habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users default auth.uid(),
  key text not null,
  label text not null,
  sort_order int not null default 0,
  unique (user_id, key)
);

create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users default auth.uid(),
  key text not null,
  label text not null,
  progress numeric not null default 0,   -- 0..1, manually set
  note text,
  sort_order int not null default 0,
  unique (user_id, key)
);

-- ---------------------------------------------------------------------------
-- Entries: one row per day, plus child tables for metrics/habits/todos.
-- ---------------------------------------------------------------------------

create table entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users default auth.uid(),
  entry_date date not null,
  theme text,                        -- active_theme stamped at creation
  reflection text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

create table entry_metric_values (
  entry_id uuid not null references entries on delete cascade,
  metric_id uuid not null references metrics,
  value numeric not null,
  primary key (entry_id, metric_id)
);

create table entry_habits (
  entry_id uuid not null references entries on delete cascade,
  habit_id uuid not null references habits,
  done boolean not null default false,
  primary key (entry_id, habit_id)
);

create table todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users default auth.uid(),
  entry_id uuid not null references entries on delete cascade,
  scope text not null check (scope in ('tomorrow', 'week')),
  text text not null,
  done boolean not null default false,
  sort_order int not null default 0
);

-- The AI coach's output. One (or more, if regenerated) row per entry.
create table ai_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users default auth.uid(),
  entry_id uuid not null references entries on delete cascade,
  content text not null,             -- action items + goal-progress synthesis
  model text not null,
  created_at timestamptz not null default now()
);

-- Wellness score computed once, in SQL, so both the frontend and the AI-coach
-- Edge Function get the same number without duplicating the formula.
create view entry_wellness_scores as
select
  e.id as entry_id,
  avg(case when m.higher_is_better then v.value else m.scale - v.value end) as wellness
from entries e
join entry_metric_values v on v.entry_id = e.id
join metrics m on m.id = v.metric_id
group by e.id;

-- ---------------------------------------------------------------------------
-- updated_at maintenance on entries
-- ---------------------------------------------------------------------------

create function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger entries_set_updated_at
  before update on entries
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Grants: RLS policies only restrict *rows* an operation can touch — the
-- role still needs the underlying table-level GRANT or every query 403s
-- regardless of policy. Local Supabase's `auto_expose_new_tables` defaults
-- to off, matching the hosted default, so this is required, not optional.
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- Row-Level Security: every table scoped to the owning account.
-- ---------------------------------------------------------------------------

alter table metrics enable row level security;
alter table habits enable row level security;
alter table goals enable row level security;
alter table entries enable row level security;
alter table entry_metric_values enable row level security;
alter table entry_habits enable row level security;
alter table todos enable row level security;
alter table ai_reports enable row level security;

create policy "metrics_owner" on metrics
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "habits_owner" on habits
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "goals_owner" on goals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "entries_owner" on entries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "todos_owner" on todos
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "ai_reports_owner" on ai_reports
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- entry_metric_values / entry_habits have no user_id column of their own;
-- ownership is via the parent entry.
create policy "entry_metric_values_owner" on entry_metric_values
  for all using (
    exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid())
  ) with check (
    exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid())
  );

create policy "entry_habits_owner" on entry_habits
  for all using (
    exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid())
  ) with check (
    exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid())
  );
