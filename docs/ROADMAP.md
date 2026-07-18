# VanyaOS — Roadmap (v3)

**Main value prop: a one-stop shop for everything in my life.**

1. **TODO** — a place to see and set current to-do lists, habits, and goals *(M2–M3)*
2. **REF** ✅ — reflect every evening on the day / habits / wellbeing *(shipped)*
3. **RE** — retrospectives on fitness areas of life: finances, health, exercise, work *(backlog)*
4. **SMART** — holistic AI report on everything together *(M4)*
5. **SYNC** — bring in data from notes / calendar / email *(backlog)*
6. **OUT** — export into other platforms *(backlog)*

Each milestone has a concrete Definition of Done (DoD) — don't move on until it's met.

> **2026-07-17 re-scope:** before any AI reports, build out the app surface — a real dashboard, a living todo list, and in-app settings. The AI coach (previously M2) moves to M4. Decisions from this grill: todos become **one living list** (not per-day snapshots), the dashboard is **glanceable + actionable** (not just a nav hub), and settings are **full CRUD + archive** (not visibility toggles).

---

## Phase 0 — Local UI prototype  ✅ **DONE** (closed 2026-06-29)
Settled the *feel* on-device: full reflection screen (0–5 grouped sliders + composite wellness, habit chips, goal bars, todos, auto-growing journal) on localStorage, plus polish (shadcn/ui, dark mode, haptics, confetti, date navigator).

## M0 — Static deploy  ✅ **DONE** (validated 2026-06-30)
GitHub Pages PWA, installed and used on-phone. Critically: **the manual AI loop was validated** — a real export pasted into an AI produced action items good enough to justify the ritual. The north star is proven, not a hypothesis.

## M1 — Accounts & durable storage (Supabase)  ✅ **DONE** (merged 2026-07-17)
Real magic-link login (plus paste-the-link sign-in so the installed PWA can authenticate despite iOS storage partitioning), normalized Postgres schema behind RLS, incremental config seeding, local draft buffer so a dropped connection can't lose an entry. Phone and Mac see the same rows.

---

## M2 — Command-center dashboard  ✅ **DONE** (built 2026-07-18)
The app opens onto a **command center at `/`** organized by the 1-3-5 framework; the reflection moved to `/reflect`. (Amended from the original "dashboard + todos" scope after the framework grill: sizes/caps and projects added, areas hierarchy cut.)

- **Living task list** (`tasks` table, no entry FK) with a **size** per task; the weekly board is **hard-capped at 1 big / 3 medium / 5 small** — adding or promoting past a cap forces a swap to Someday (the chooser lists the current slot-holders; no silent overflow). `today` is a pull from the week; `someday` is the parking lot; roll-forward machinery deleted.
- **Projects · WIP limit 1** — one `in_progress` (enforced by a DB partial unique index), the rest parked; tap to swap.
- **Habit chips + goal glance** inline on the dashboard (habits write today's entry, same autosave path as the reflection).
- **`/reflect` embeds the same board** (compact) — one todo state in the system.
- **Areas hierarchy (Health→Work→Systems→Projects): cut** — parked until a felt need.

**✅ Met:** tasks/caps/swap, projects WIP-1 (DB-level rejection of a second active verified), habit parity, and `/reflect` parity all verified end-to-end locally; migration applied to the hosted project.

---

## M3 — Settings: full control over the setup
An in-app `/settings` area that kills the last reason to touch the Supabase dashboard or redeploy for config.

- **Metrics / habits / goals**: add, rename, reorder, and **archive** (never delete — historical entries keep their data; archived items disappear from Reflect/Dashboard).
- **Goals**: progress + note editable in-app (replaces hand-editing rows).
- Schema: `archived` flag on `metrics` / `habits` / `goals`; config queries filter it.
- config.ts seeding demotes to first-run bootstrap only — after that, Settings is the source of truth.

**DoD:** you add a new habit, hide a metric you stopped tracking, and bump a goal's progress — all from your phone, and the reflection screen reflects it immediately.

---

## M4 — Automated AI coach  *(SMART v1 — moved from M2)*
Automates exactly the loop validated by hand in M0. Unchanged in shape:
- Explicit **"Finish reflection"** action (separate from silent autosave).
- **`synthesize-entry` Edge Function** — the only server-side code: reads the entry + recent history, calls the Claude API, writes to `ai_reports`. Holds `ANTHROPIC_API_KEY`.
- **Realtime** subscription on `ai_reports` → coaching output appears without a refresh.

**DoD:** tap "Finish reflection" on a real entry and see AI-generated action items appear in the same session, without touching another app.

---

## M5 — Polish & daily-use hardening
Whatever two weeks of real use across dashboard + reflection + settings demands: draft-buffer edge cases, magic-link UX friction, anything clunky.

**DoD:** you've used it daily for two weeks and stopped noticing the tool.

---

## Deferred backlog (value order)
1. **History & trends** — past-day browser, habit streaks, wellness sparklines (plain SQL now). The dashboard is its natural home.
2. **RE / fitness-area retros** — periodic deep-dives on Finances / Health / Exercise / Work (value-prop #3).
3. **Chat coach** — ask-anything over your history, once M4's synthesis is proven.
4. **SYNC** — notes / calendar / email in (value-prop #5). Hardest, most fragile — stays last-ish.
5. **OUT** — export to other platforms (value-prop #6).
6. **Multi-user** — explicitly out of scope; RLS already isolates by `user_id`, nothing else planned.

---

## Risks to watch
- **The dashboard becomes a junk drawer.** "One-stop shop" is the value prop *and* the scope-creep vector. Everything on the dashboard must be actionable-in-one-tap or a glance; anything needing a form lives in its section.
- **Tedium kills the ritual.** The nightly entry must stay under ~90s. Embedding the living task list in Reflect must not add friction to the parts that already work.
- **Todo migration data loss.** Per-entry todos → `tasks` is the first destructive-ish migration; migrate undone items forward, keep completed history queryable, verify on local stack before `db push`.
- **Settings CRUD invites deletes.** Archive-only in the UI — a hard delete would orphan historical entry values.
- **AI coach slippage.** SMART is the north star and it's now two milestones out. If M2+M3 drag, cut scope there rather than letting M4 slide further.
