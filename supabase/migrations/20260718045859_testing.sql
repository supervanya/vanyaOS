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
