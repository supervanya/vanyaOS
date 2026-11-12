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
| AI coach | **One provider-agnostic Edge Function** (`ai-coach`) using the **AI SDK** (`ai` + provider packages) to call the *user's own* provider with the *user's own* key from `ai_settings`; also serves a **live model catalog** (`list-models`) fetched from the provider's API so the app never ships stale model lists | The only server-side code; the app holds **zero AI secrets** — no provider lock-in, each account brings its own key |
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
 ┌─────────────┐                                     │  Edge Fn: ai-coach        │──▶ user's chosen provider
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
  -- M5: when the slider is asked. The ONLY difference between a morning and an
  -- evening metric — values, scale, Trends and wellness treat them the same.
  timing text not null default 'evening' check (timing in ('morning', 'evening')),
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

-- One row per day, the entry "header" — both halves of the day (M5). The
-- morning creates the row; the evening fills in the rest.
create table entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users,
  entry_date date not null,
  theme text,                        -- active_theme stamped at creation
  intention text not null default '',  -- morning half (M5)
  intention_lived text check (intention_lived in ('no', 'partly', 'yes')),  -- set in the evening; null = not rated
  reflection text not null default '', -- evening half
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

-- Per-account preferences that aren't config rows or secrets (M5). One row
-- per account, created on the first change; no row means the defaults.
create table user_settings (
  user_id uuid primary key references auth.users default auth.uid(),
  morning_redirect boolean not null default true,   -- `/` opens on /morning until it's set
  morning_closes_at smallint not null default 720   -- minutes after local midnight; 720 = 12:00
    check (morning_closes_at between 0 and 1439),
  updated_at timestamptz not null default now()
);

-- Per-user AI configuration: BYO provider + key (no app-held AI secrets).
-- RLS-protected; consider Supabase Vault encryption before any multi-user future.
create table ai_settings (
  user_id uuid primary key references auth.users,
  provider text not null check (provider in ('anthropic', 'openai', 'google')),
  model text not null,
  api_key text not null,
  updated_at timestamptz not null default now()
);

-- Retro areas (seeded: Finances, Health, Exercise, Work) — Settings-managed,
-- same CRUD+archive pattern as habits.
create table retro_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users default auth.uid(),
  key text not null,
  label text not null,
  sort_order int not null default 0,
  archived boolean not null default false,
  unique (user_id, key)
);

-- Each retro run snapshots the area's living state-of-affairs markdown doc.
-- Version 1 is a manual paste (no AI); later versions are coach-produced.
-- The area's "current doc" = its latest row; history is every prior row.
create table retros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users default auth.uid(),
  area_id uuid not null references retro_areas on delete cascade,
  doc_md text not null,              -- updated state-of-affairs after this run
  ai_summary text,                   -- what the coach noticed/changed (null for manual edits/seeds)
  model text,                        -- provider/model used (null for manual)
  created_at timestamptz not null default now()
);

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
-- security_invoker so the view runs as the querying user and RLS on the
-- underlying tables applies (definer views bypass RLS).
create view entry_wellness_scores with (security_invoker = on) as
select
  e.id as entry_id,
  avg(case when m.higher_is_better then v.value else m.scale - v.value end) as wellness
from entries e
join entry_metric_values v on v.entry_id = e.id
join metrics m on m.id = v.metric_id
group by e.id;
```

### One day, two halves (M5)

A day is still one `entries` row. The morning half is `intention` plus the values of metrics whose `timing` is `morning`; the evening half is `reflection`, `intention_lived`, the evening metric values and the habit checks. There are no morning tables: every reader (Trends, `entry_wellness_scores`, the retro intake, the coach's tools) keeps reading one place, and a morning slider counts toward wellness exactly like an evening one. The cost is that a morning-only day has a wellness score built from a few values.

- **Two save functions, one per half.** `save_morning(entry_date, theme, intention, metric_values)` upserts the day row and writes only `intention` and morning-timed metric values. `save_day` gains `intention_lived` and writes only `reflection`, evening-timed metric values and habit checks. Each filters `metric_values` by `metrics.timing` in SQL, so a stale client can't make one half clear the other's sliders (`save_day` deletes a metric value sent as null).
- **The morning locks once the evening is started.** "Started" means `reflection` is non-empty, or any evening-timed metric value exists, or `intention_lived` is set. `save_morning` raises when the day is locked — the UI going read-only is a courtesy, the function is the rule. Habit checks don't count: the dashboard writes them all day.
- **Morning-only days.** A day with a morning (an intention or a morning slider) but no evening yet (no evening slider, reflection or lived rating — the lock's signals; habit ticks don't count) keeps its score but is marked as morning only: a small sun on its Reflect calendar tile and a ring on the Trends wellness line. Reflect's "vs last" skips such days. Computed client-side from the Trends history (`morningOnlyDates`); the SQL view is unchanged.
- **Changing a metric's `timing`** in Settings moves where it is asked from then on. Existing values are untouched; a past day keeps whatever was recorded.
- **Drafts.** Each half has its own localStorage draft (`vanyaos:draft:morning:<date>` beside the existing evening key), so an unsynced morning edit and an unsynced evening edit can't overwrite each other. The two are reconciled differently: the evening draft wins only when it is newer than the saved row, but a morning draft exists only while it is unsynced, so it always wins unless the day is locked (then it is dropped). Comparing timestamps for the morning would lose an offline intention to any later habit tap, because every evening-side save bumps the row's `updated_at`. Two devices editing the same morning is last-writer-wins.
- **Landing.** Until the morning closes (`user_settings.morning_closes_at`, 12:00 by default), and unless the redirect is turned off (`user_settings.morning_redirect`), `/` redirects to `/morning` when today has no intention text and no morning metric value, unless "Skip today" was tapped (a per-date localStorage flag — device-local on purpose) or the day is locked. Not before 04:00, while the app's day (`defaultEntryDate`) is still yesterday's. The check runs in the index route's `beforeLoad` (`features/entries/landing.ts`); if today's morning can't be loaded it lets the dashboard open.

### Tasks: one list, three surfaces

The dashboard (`/`), the morning page (`/morning`) and the reflection screen (`/reflect`) all read/write the same `tasks` rows — there is exactly one todo state in the system. Completing a task sets `completed_at` (kept, giving completion history for the future SMART report); "rescheduling" is just changing `scope`. The old roll-forward mechanism is gone: nothing is copied between days because tasks don't belong to days.

**The 1-3-5 rule** (`CAPS` in `src/lib/storage.ts`): the weekly board = tasks in scope `today`+`week`, hard-capped at 1 big / 3 medium / 5 small per size — completed items still count (done work occupied its slot). Adding or promoting past a cap opens a swap chooser (evict a board item to `someday`, or park the incoming one); there is no silent overflow.

### App surfaces

| Route | Purpose |
|---|---|
| `/` | **Command center** — the 1-3-5 board (hard caps + swap), habit chips (writes today's entry), goal glance, projects card (WIP-1, tap-to-swap), today's intention (read-only, M5), links to Morning and Reflect |
| `/morning` | M5: the morning intention — textarea, morning sliders, the same task list. Read-only once the evening is started |
| `/reflect` | The evening reflection (moved from `/`); shows the morning half read-only, asks "did I live it?", embeds the same task list |
| `/settings` | M3: CRUD + archive for metrics/habits/goals, goal progress editing. M5: morning/evening toggle per metric; whether and until when the app opens on `/morning` |
| `/login` | Magic link + paste-the-link sign-in |

## Save flow

The nightly ritual has two distinct actions now, not one — this matters for cost and for not calling the AI on every keystroke:

0. **AI setup (once).** Settings → AI: pick provider + model, paste your API key → `ai_settings` row. The `ai-coach` Edge Function verifies the caller's JWT, reads *their* row, and dispatches to the matching provider adapter — it never sees an app-level key because there isn't one.

0b. **Retro flow (interactive).** An area's current doc is its latest `retros` row (seeded by pasting existing markdown). "Run retrospective" opens a coaching **session**, not a one-shot call: the client sends `ai-coach` (task `retro`) the current doc + entries since the area's last retro (reflections, and from M5 each day's morning intention and lived rating) + any user-added context, and the coach — prompted as a sharp, goal-driven expert for that area — works through a structured retrospective *with* the user: multiple turns, the coach prompting with new information, proposed doc changes, and new goals. The session's conclusion (updated doc + change summary) is written as a NEW `retros` row (never overwriting — the doc is also hand-editable between runs, which writes a manual version). Session turns are stateless server-side: the client resends the running transcript each turn; only the final doc version persists. Areas show a due-nudge one month after their last run.

1. **Continuous autosave (silent, no AI call).** Morning and evening each autosave their own half the same way (see "One day, two halves"). As you edit sliders/habits/reflection/todos, changes write to a **local draft buffer in localStorage first** (instant, survives a dropped connection), then sync to the corresponding Postgres rows in the background (debounced). This is the same UX as today's autosave — just backed by Postgres instead of being the only copy.
2. **Explicit "Finish reflection" (triggers the AI coach, M7).** A single tap invokes `ai-coach` with task `synthesize-entry` and the entry's id. The function reads the entry + recent history, calls the user's provider, and writes one row to `ai_reports`.
3. The client is subscribed to `ai_reports` inserts for that entry via **Supabase Realtime** — the coaching output appears automatically, no refresh, no polling.
4. On load, the app reads `entries` + child rows for the selected date (and the open `tasks` list) directly via the Supabase client, gated by RLS to the logged-in user.

## Non-goals for v2 (architectural)

No multi-user sign-up flow (schema is scoped for it via `user_id`, but there's no invite/account-creation surface — single account only), no offline write-queue beyond the local draft buffer, no markdown export, no realtime *co-editing* (a reflection happens once, in one sitting, on one device at a time).
