# VanyaOS — Architecture (v2)

## Recommended stack

> Backend decision recorded in [ADR-002](adr/ADR-002-supabase-backend-pivot.md), which supersedes [ADR-001](adr/ADR-001-frontend-runtime-stack.md)'s storage/auth sections. ADR-001's frontend choice (TanStack Router on plain Vite, static deploy) is unchanged and still applies.
>
> **M0 (closed):** the app ran on **localStorage**, one device at a time, no login. Everything below is the **M1 graduation target** — a real backend, not what's live at the M0 tag.

| Layer | Choice | Why |
|---|---|---|
| Frontend | **TanStack Router + React**, Vite, mobile-first, `vite build → dist/` | Unchanged from M0 — still a static SPA, no server render |
| Data + Auth | **Supabase** — managed Postgres, built-in Auth, Row-Level Security | One platform for schema + real login; RLS replaces hand-rolled authorization |
| Client access | **Supabase JS client**, called directly from the browser | RLS is the security boundary; no server needed for ordinary reads/writes |
| Login | **Magic link** (passwordless email) via Supabase Auth | No password to type nightly on a phone; still a real account, not a shared passcode |
| AI coach | **One Supabase Edge Function** (`synthesize-entry`) calling the **Claude API** | The only server-side code in the system; exists solely to hold `ANTHROPIC_API_KEY` |
| Realtime | **Supabase Realtime** subscription on `ai_reports` | Coaching output appears in the UI without polling |
| PWA | **`vite-plugin-pwa`** (manifest + service worker) | Installable on the phone home screen — unchanged from M0 |
| Hosting | **GitHub Pages** (unchanged), via the existing Actions workflow | The static frontend didn't need to move; only the data layer changed |

**Why this shape (see ADR-002 for the full comparison):** dropping GitHub-markdown as the storage model removed the entire reason a server-held write-token was needed. Supabase gets you a real schema, real auth, and RLS-based authorization from one platform, without forcing the frontend off the static host it's already deployed to. The *only* server-side code that still exists is the Edge Function that calls Claude — because an API key can never be on the client.

## System shape

```
 ┌─────────────┐                                    ┌────────────────────────────┐
 │  Phone PWA  │ ── Supabase JS client (HTTPS) ────▶ │          Supabase          │
 │ (installed) │    auth · Postgres · Realtime       │  Auth (magic link)        │
 └─────────────┘                                     │  Postgres + RLS           │
 ┌─────────────┐                                     │  Edge Fn: synthesize-entry│──▶ Claude API
 │  Mac browser│ ── same login, same rows ─────────▶ │                            │
 └─────────────┘                                     └────────────────────────────┘
   Both devices log into the same account → same rows = sync, no sync engine to write.
   Static SPA still built with Vite, still deployed to GitHub Pages — unchanged from M0.
```

## Schema (Postgres, via Supabase)

Normalized, not a document blob — history queries (streaks, sparklines, M3) become plain SQL instead of hand-parsed markdown. Every table is scoped by `user_id` and gated by a Row-Level Security policy `using (user_id = auth.uid())` for select/insert/update/delete — single-tenant today, but the isolation is free.

```sql
-- Config, DB-editable. M3 adds `archived boolean not null default false` to all
-- three tables plus the in-app Settings CRUD (add/rename/reorder/archive) —
-- archive, never delete, so historical entry values keep their FK targets.
create table metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users,
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
  user_id uuid not null references auth.users,
  key text not null,
  label text not null,
  sort_order int not null default 0,
  unique (user_id, key)
);

create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users,
  key text not null,
  label text not null,
  progress numeric not null default 0,   -- 0..1, manually set (unchanged from v1)
  note text,
  sort_order int not null default 0,
  unique (user_id, key)
);

-- One row per day, the entry "header."
create table entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users,
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

-- One LIVING task list (M2 re-scope, 2026-07-17) — NOT per-entry snapshots.
-- Replaces the original `todos` table that FK'd each item to a day's entry
-- with roll-forward copying; an undone task now simply stays on the list.
-- Migration: copy the most recent entry's undone todos into `tasks`
-- (scope 'tomorrow' -> 'today'), then drop `todos`.
create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users,
  scope text not null check (scope in ('today', 'week', 'someday')),
  size text not null default 'small' check (size in ('big', 'medium', 'small')),
  text text not null,
  completed_at timestamptz,          -- null = open; timestamps double as history
  archived boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Projects with a WIP limit of ONE: exactly one in_progress, the rest parked.
create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users,
  name text not null,
  emoji text,
  status text not null default 'parking_lot' check (status in ('in_progress', 'parking_lot')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
-- WIP-1 enforced at the DB, not just the UI:
create unique index one_project_in_progress on projects (user_id) where status = 'in_progress';

-- The AI coach's output. One (or more, if regenerated) row per entry.
create table ai_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users,
  entry_id uuid not null references entries on delete cascade,
  content text not null,             -- action items + goal-progress synthesis
  model text not null,
  created_at timestamptz not null default now()
);

-- Wellness score computed once, in SQL, so both the frontend and the Edge
-- Function get the same number without duplicating the formula in two languages.
-- higher_is_better metrics contribute `value`; inverted ones contribute `scale - value`.
create view entry_wellness_scores as
select
  e.id as entry_id,
  avg(case when m.higher_is_better then v.value else m.scale - v.value end) as wellness
from entries e
join entry_metric_values v on v.entry_id = e.id
join metrics m on m.id = v.metric_id
group by e.id;
```

### Tasks: one list, two surfaces

The dashboard (`/`) and the reflection screen (`/reflect`) both read/write the same `tasks` rows — there is exactly one todo state in the system. Completing a task sets `completed_at` (kept, giving completion history for the future SMART report); "rescheduling" is just changing `scope`. The old roll-forward mechanism is gone: nothing is copied between days because tasks don't belong to days.

**The 1-3-5 rule** (`CAPS` in `src/lib/storage.ts`): the weekly board = tasks in scope `today`+`week`, hard-capped at 1 big / 3 medium / 5 small per size — completed items still count (done work occupied its slot). Adding or promoting past a cap opens a swap chooser (evict a board item to `someday`, or park the incoming one); there is no silent overflow.

### App surfaces (M2–M3)

| Route | Purpose |
|---|---|
| `/` | **Command center** — the 1-3-5 board (hard caps + swap), habit chips (writes today's entry), goal glance, projects card (WIP-1, tap-to-swap), nav to Reflect |
| `/reflect` | The evening reflection (moved from `/`); embeds the same task list |
| `/settings` | M3: CRUD + archive for metrics/habits/goals, goal progress editing |
| `/login` | Magic link + paste-the-link sign-in |

## Save flow

The nightly ritual has two distinct actions now, not one — this matters for cost and for not calling the AI on every keystroke:

1. **Continuous autosave (silent, no AI call).** As you edit sliders/habits/reflection/todos, changes write to a **local draft buffer in localStorage first** (instant, survives a dropped connection), then sync to the corresponding Postgres rows in the background (debounced). This is the same UX as today's autosave — just backed by Postgres instead of being the only copy.
2. **Explicit "Finish reflection" (triggers the AI coach).** A single tap invokes the `synthesize-entry` Edge Function with the entry's id. The function reads the entry + its metrics/habits/todos, calls the Claude API, and writes one row to `ai_reports`.
3. The client is subscribed to `ai_reports` inserts for that entry via **Supabase Realtime** — the coaching output appears automatically, no refresh, no polling.
4. On load, the app reads `entries` + child rows for the selected date (and the open `tasks` list) directly via the Supabase client, gated by RLS to the logged-in user.

## Non-goals for v2 (architectural)

No multi-user sign-up flow (schema is scoped for it via `user_id`, but there's no invite/account-creation surface — single account only), no offline write-queue beyond the local draft buffer, no markdown export, no realtime *co-editing* (a reflection happens once, in one sitting, on one device at a time).
