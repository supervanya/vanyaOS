-- M2 command center: promote todos to ONE living task list (1-3-5 sizes) and
-- add projects with a WIP limit of one. See docs/ARCHITECTURE.md + ROADMAP M2.

-- ---------------------------------------------------------------------------
-- tasks: the living list. No entry_id — tasks don't belong to days.
-- ---------------------------------------------------------------------------

create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users default auth.uid(),
  scope text not null check (scope in ('today', 'week', 'someday')),
  size text not null default 'small' check (size in ('big', 'medium', 'small')),
  text text not null,
  completed_at timestamptz,            -- null = open; timestamps double as history
  archived boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- projects: parking lot + exactly one in progress (the WIP-1 rule).
-- ---------------------------------------------------------------------------

create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users default auth.uid(),
  name text not null,
  emoji text,
  status text not null default 'parking_lot' check (status in ('in_progress', 'parking_lot')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- WIP-1 enforced at the DB, not just the UI.
create unique index one_project_in_progress on projects (user_id) where status = 'in_progress';

-- ---------------------------------------------------------------------------
-- Access: RLS policies AND table-level grants. The init migration's
-- `grant ... on all tables` only covered tables that existed then — a new
-- table without its own grant 403s before RLS is even consulted.
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on tasks, projects to authenticated;

alter table tasks enable row level security;
alter table projects enable row level security;

create policy "tasks_owner" on tasks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "projects_owner" on projects
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Data migration: each user's most recent entry donates its undone todos to
-- the living list ('tomorrow' -> 'today'); everything else was roll-forward
-- noise. Then the per-entry todos table is gone for good.
-- ---------------------------------------------------------------------------

insert into tasks (user_id, scope, size, text, sort_order, created_at)
select
  t.user_id,
  case t.scope when 'tomorrow' then 'today' else 'week' end,
  'small',
  t.text,
  t.sort_order,
  now()
from todos t
join entries e on e.id = t.entry_id
where not t.done
  and e.entry_date = (
    select max(e2.entry_date) from entries e2 where e2.user_id = t.user_id
  );

drop table todos;
