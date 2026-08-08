# VanyaOS — Roadmap (v3)

**Main value prop: a one-stop shop for everything in my life.**

1. **TODO** ✅ — a place to see and set current to-do lists, habits, and goals *(shipped, M2–M3)*
2. **REF** ✅ — reflect every evening on the day / habits / wellbeing *(shipped)*
3. **RE** — retrospectives on fitness areas of life: finances, health, exercise, work *(M4)*
4. **SMART** — holistic AI report on everything together *(M5)*
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

## M3 — Settings: full control over the setup  ✅ **DONE** (built 2026-07-18)
An in-app `/settings` area — the last reason to touch the Supabase dashboard or redeploy for config is gone.

- **Metrics / habits / goals**: add, rename (inline, saves on blur), reorder (up/down), and **archive** (never delete — historical entries keep their data; archived items vanish from Reflect/Dashboard but sit in a restorable Archived list).
- **Goals**: progress slider + note editable in-app.
- Schema: `archived` flag on all three config tables; `loadConfig` filters it. Seeding checks keys *unfiltered*, so an archived default stays archived instead of resurrecting.
- New metrics get a slugified stable `key`; renames touch only the label.

**✅ Met:** added a habit, renamed a metric, archived another (confirmed gone from Reflect and not re-seeded), bumped a goal's progress — all verified against the DB.

---

## M4 — BYO-AI foundation + Retrospectives  *(CURRENT — re-scoped 2026-08-07)*
RE jumps out of the backlog, and it forces the AI plumbing to ship with it: a retro is *run by the coach*. Two halves, one milestone:

**(a) Bring-your-own AI provider** — no provider lock-in, no app-held API keys:
- Settings gains an **AI section**: pick a provider (Anthropic / OpenAI / Google), pick a model, paste *your own* API key → stored in an RLS-protected `ai_settings` row.
- One **provider-agnostic Edge Function** (`ai-coach`): verifies the caller's JWT, reads *their* provider/model/key, dispatches to the right provider adapter. The app itself holds zero AI secrets — the old `ANTHROPIC_API_KEY`-as-server-secret design is dead.

**(b) Retrospectives** — each area is a **living state-of-affairs markdown doc**, and running a retro is an **interactive coaching session**, not a silent doc rewrite:
- `retro_areas` (seeded: Finances, Health, Exercise, Work) — DB rows, managed in Settings like everything else.
- Seed an area by **pasting your existing markdown** (e.g. the financial-fitness doc with all the numbers and checklists) — that becomes version 1, no AI involved.
- **Run retrospective** is a four-step session:
  1. **Intake** — the coach takes *everything*: the area's current doc, all new signal since the area's last retro (reflections, entries — usually nothing relevant, sometimes a journal line matters), plus **anything the user adds up front** (new numbers, events, context).
  2. **The prompted retrospective** — the session works through a structured retro, not a freeform chat.
  3. **Coach voice** — the AI talks like a coach who is proficient and *incredibly sharp* at getting goals done and improving the posture of that area (financial fitness, physical fitness, …). Direct, goal-driven, no fluff.
  4. **Output back at the user** — the coach *prompts the user* with the new information, the changes it proposes to the state-of-affairs doc, and **new goals** based on everything given.
- The session's product is an **updated doc + change summary**, written as a new version — full history kept, never overwriting, and the doc stays hand-editable between runs.
- **Cadence: on-demand + monthly due-nudge** — each area shows a gentle "due" state when a month has passed since its last retro; the dashboard gets a small indicator. No forced schedule.

**DoD:** paste the real financial-fitness markdown into the Finances area, run a retrospective with your own API key against your chosen provider, and have an actual back-and-forth where the coach surfaces changes and proposes next goals — ending with an updated doc that reflects the session (or correctly concluded nothing changed) — plus the due-nudge appearing a month out.

---

## M5 — Nightly AI coach  *(SMART v1 — rides on M4's plumbing)*
Automates the loop validated by hand in M0, now provider-agnostic for free:
- Explicit **"Finish reflection"** action (separate from silent autosave) → the same `ai-coach` Edge Function, task `synthesize-entry` → action items + goal-progress notes into `ai_reports`.
- **Realtime** subscription on `ai_reports` → output appears without a refresh.

**DoD:** tap "Finish reflection" on a real entry and see AI-generated action items appear in the same session, without touching another app.

---

## M6 — Polish & daily-use hardening
Whatever two weeks of real use across dashboard + reflection + retros + settings demands.

**DoD:** you've used it daily for two weeks and stopped noticing the tool.

---

## Deferred backlog (value order)
1. **History & trends** — past-day browser, habit streaks, wellness sparklines (plain SQL now). The dashboard is its natural home.
2. **Chat coach** — ask-anything over your history, once M4/M5's coach plumbing is proven.
3. **SYNC** — notes / calendar / email in (value-prop #5). Hardest, most fragile — stays last-ish.
4. **OUT** — export to other platforms (value-prop #6).
5. **Multi-user** — explicitly out of scope; RLS already isolates by `user_id`, nothing else planned. (BYO keys already assume per-user AI config, so this wouldn't touch the AI layer.)

---

## Risks to watch
- **The dashboard becomes a junk drawer.** "One-stop shop" is the value prop *and* the scope-creep vector. Everything on the dashboard must be actionable-in-one-tap or a glance; anything needing a form lives in its section.
- **Tedium kills the ritual.** The nightly entry must stay under ~90s. Embedding the living task list in Reflect must not add friction to the parts that already work.
- **Todo migration data loss.** Per-entry todos → `tasks` is the first destructive-ish migration; migrate undone items forward, keep completed history queryable, verify on local stack before `db push`.
- **Settings CRUD invites deletes.** Archive-only in the UI — a hard delete would orphan historical entry values.
- **API keys at rest.** BYO keys live in an RLS-protected Postgres row — fine for the current threat model, but consider Supabase Vault encryption before any multi-user future. Never log keys in the Edge Function.
- **Retro doc drift.** The coach rewrites a document the owner also hand-edits — every run must version, never overwrite silently, and the summary must say what it changed.
- **AI coach slippage.** SMART is the north star. M4 deliberately builds its plumbing (provider adapters, Edge Function) so M5 is a thin milestone — if M4 drags, cut retro polish, not the AI foundation.
