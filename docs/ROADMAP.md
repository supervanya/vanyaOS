# VanyaOS — Roadmap (v3)

**Main value prop: a one-stop shop for everything in my life.**

1. **TODO** ✅ — a place to see and set current to-do lists, habits, and goals *(shipped, M2–M3)*
2. **REF** ✅ — reflect every evening on the day / habits / wellbeing *(shipped)*
3. **RE** ✅ — retrospectives on fitness areas of life: finances, health, exercise, work *(shipped, M4)*
4. **MOR** — set an intention every morning, and meet it again in the evening *(M5)*
5. **SMART** — holistic AI coach over everything together: ask it anything *(M6)*, and it synthesizes each night *(M7)*
6. **SYNC** — bring in data from notes / calendar / email *(backlog)*
7. **OUT** — export into other platforms *(backlog)*

Each milestone has a concrete Definition of Done (DoD) — don't move on until it's met.

> **Granular work lives in [GitHub Issues](https://github.com/supervanya/vanyaOS/issues), not here.** This file holds milestone *scope*, DoDs, and risks. Individual features, polish items, and bugs are issues, labeled by `type/` and `size/` and assigned to the matching milestone — see [CLAUDE.md](../CLAUDE.md) for the conventions.

> **2026-07-17 re-scope:** before any AI reports, build out the app surface — a real dashboard, a living todo list, and in-app settings. The AI coach (previously M2) moves to M4. Decisions from this grill: todos become **one living list** (not per-day snapshots), the dashboard is **glanceable + actionable** (not just a nav hub), and settings are **full CRUD + archive** (not visibility toggles).

> **2026-10-04 re-scope:** M4 closed. The **chat coach** moves up from the deferred backlog to **M5**: being able to ask the coach a question at any time is now the biggest gap. The nightly coach moves to M6 and polish to M7.

> **2026-11-12 re-scope:** the **morning intention (MOR)** goes ahead of everything and becomes **M5**. The day has only had an evening half; without a stated intention there is nothing for the reflection, or the coach, to measure the day against. Chat coach shifts to M6, nightly coach to M7, polish to M8. Decisions from this grill: one row per day holds both halves (no separate morning tables), a metric is asked in the morning *or* the evening, morning sliders count toward wellness like any other, the morning half **locks once the evening is started**, and the evening adds a one-tap **"did I live it?"** rating.

---

## Phase 0 — Local UI prototype  ✅ **DONE** (closed 2026-06-29)
Settled the *feel* on-device: full reflection screen (0–5 grouped sliders + composite wellness, habit chips, goal bars, todos, auto-growing journal) on localStorage, plus polish (shadcn/ui, dark mode, haptics, confetti, date navigator).

## M0 — Static deploy  ✅ **DONE** (validated 2026-06-30)
GitHub Pages PWA, installed and used on-phone. Critically: **the manual AI loop was validated** — a real export pasted into an AI produced action items good enough to justify the ritual. The north star is proven, not a hypothesis.

## M1 — Accounts & durable storage (Supabase)  ✅ **DONE** (merged 2026-07-17)
Real magic-link login (plus paste-the-link sign-in so the installed PWA can authenticate despite iOS storage partitioning), normalized Postgres schema behind RLS, incremental config seeding, local draft buffer so a dropped connection can't lose an entry. Phone and Mac see the same rows.

---

## M2 — Command-center dashboard  ✅ **DONE** (built 2026-07-18)
The app opens onto a **command center at `/`** organized by the 1-3-5 framework (surfaced in the UI as Large/Medium/Small — the digits are caps, not sizes); the reflection moved to `/reflect`. (Amended from the original "dashboard + todos" scope after the framework grill: sizes/caps and projects added, areas hierarchy cut.)

- **Living task list** (`tasks` table, no entry FK) with a **size** per task; the weekly board is **hard-capped at 1 Large / 3 Medium / 5 Small** — adding or promoting past a cap forces a swap to Someday (the chooser lists the current slot-holders; no silent overflow). `today` is a pull from the week; `someday` is the parking lot; roll-forward machinery deleted.
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

## M4 — BYO-AI foundation + Retrospectives  ✅ **DONE** (closed 2026-10-04)
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

**✅ Met:** real coaching sessions run with Vanya's own key through the full chain (client → JWT-verified Edge Function → RLS-read `ai_settings` → provider), tool use included. The due-nudge check (#15) carries over to polish.

---

## M5 — Morning intention  *(MOR)*
The day gets a morning half: what you want from it, how you're starting it, and what you'll do. The evening reflection then shows it back to you and asks whether you lived it.

- **`/morning`** — an intention textarea, the **morning sliders**, and the same task board as everywhere else (compact) for pulling tasks into Today. Autosaves like the evening, through its own local draft. No new task state.
- **One row per day, two halves.** `entries` gains `intention` and `intention_lived`; morning slider values go in `entry_metric_values` beside the evening ones. No separate morning tables — Trends, wellness, the retro intake and the coach's tools keep reading one place. Morning and evening save through **separate functions**, each writing only its own half, so neither can clobber the other.
- **A metric is morning *or* evening** — a `timing` toggle per metric in Settings; existing metrics are evening. Beyond *when it's asked*, a morning slider is an ordinary slider: same scale, in Trends, and counted in the day's wellness score. A day with only a morning check-in therefore has a score.
- **Evening shows the morning read-only.** `/reflect` opens with this morning's intention and slider values (hidden when there are none), lists only the evening sliders for input, and adds one tap: **did I live it? — No / Partly / Yes**.
- **The morning locks once the evening is started** — reflection text, any evening slider, or the lived rating. Enforced by the save function, not just the UI. Habit chips don't count: they're ticked from the dashboard all day. Past days with no evening stay editable, so a missed morning can be backfilled until its evening is written.
- **The app opens on `/morning` until today's intention is set** — before noon only, with a "Skip today" tap remembered on the device. After noon it opens on the dashboard as usual.
- **Dashboard**: a read-only glance card with today's intention (tap → `/morning`), next to the existing link to Reflect. No form on the dashboard.
- **Fed to the coach.** The retro intake carries each day's intention, its lived rating and a follow-through tally alongside the reflections. The chat coach (M6) and nightly synthesis (M7) read the same columns — no extra plumbing here.
- **Not in scope:** real navigation (#26 stays in polish), metrics asked at both times of day, structured morning prompts, morning habits.

**DoD:** on a real morning the app opens on `/morning`; write an intention, set a morning slider, pull a task into Today. The dashboard shows the intention all day. That evening `/reflect` shows the morning read-only, you tap No / Partly / Yes, and the morning half is then locked on both devices. Run a retro and the coach refers to an intention and whether it was lived.

---

## M6 — Chat coach  *(SMART v1 — rides on M4's plumbing)*
A conversation with the coach you can open any time, about anything in the system: goals, the task board, past reflections, and retro docs. It moves up from the deferred backlog because this is what gets wanted most, and M4 already proved the plumbing (real key, tool use).

- **The coach looks things up instead of getting everything at once.** Every question starts with a small fixed brief: today's date, today's morning intention, goals with progress and notes, the weekly board, the active project, and each retro area with its last-run date. Everything else comes through **read-only tools** the model calls as needed: reflections by date range (each day's morning intention and lived rating come with it), full-text search over reflections and intentions, tasks (including completion history), retro docs (any version), and metric/habit trends.
- **Tools run on the server, inside `ai-coach`**, through the client scoped to the signed-in user, so RLS still limits every read. No service role. Answers stream in.
- **No vector store yet.** Use Postgres full-text search plus date ranges first. Add embeddings only if search clearly misses things that mean the same but use different words. Similarity search also can't find what *stopped* being mentioned, which is exactly the "what slipped?" case.
- **Read-only.** The coach can suggest changes but can't add, complete, or edit anything. Tools that write come later, each behind a confirm tap.
- **Conversations are saved** as threads, archived and never deleted, so you can come back to one.
- It lives in its own section. The dashboard gets at most a one-tap entry point, not a chat box.

**DoD:** ask "what are my most important to-dos this week?" and get an answer that weighs goals against the board and points out something from past reflections that slipped, with the dates it came from. Then ask a follow-up in the same thread, and find the thread again the next day.

---

## M7 — Nightly AI coach  *(SMART v2)*
Automates the loop validated by hand in M0, now provider-agnostic for free:
- Explicit **"Finish reflection"** action (separate from silent autosave) → the same `ai-coach` Edge Function, task `synthesize-entry` → action items + goal-progress notes into `ai_reports`. The synthesis reads the day's morning intention and lived rating next to the reflection.
- **Realtime** subscription on `ai_reports` → output appears without a refresh.
- **Feeds the chat coach.** Each night's synthesis also pulls out the commitments made in the reflection ("open loops"), so the chat coach can answer "what slipped?" with a query instead of re-reading weeks of journal.

**DoD:** tap "Finish reflection" on a real entry and see AI-generated action items appear in the same session, without touching another app.

---

## M8 — Polish & daily-use hardening
Whatever two weeks of real use across dashboard + reflection + retros + settings demands.

**DoD:** you've used it daily for two weeks and stopped noticing the tool.

---

## Deferred backlog (value order)
1. **History & trends** — past-day browser, habit streaks, wellness sparklines (plain SQL now). The dashboard is its natural home.
2. **SYNC** — notes / calendar / email in (value-prop #6). Hardest, most fragile — stays last-ish.
3. **OUT** — export to other platforms (value-prop #7).
4. **Offline support** — the app works disconnected, with strict validation on anything captured offline and the last few months readable without a connection. A real architectural commitment (local store, sync reconciliation, conflict rules), not a polish item — needs a design pass before any code. Distinct from M1's local draft buffer, which only protects a single in-flight entry.
5. **Multi-user** — explicitly out of scope; RLS already isolates by `user_id`, nothing else planned. (BYO keys already assume per-user AI config, so this wouldn't touch the AI layer.)

---

## Risks to watch
- **The dashboard becomes a junk drawer.** "One-stop shop" is the value prop *and* the scope-creep vector. Everything on the dashboard must be actionable-in-one-tap or a glance; anything needing a form lives in its section.
- **Two rituals instead of one.** The morning must stay under ~60s or it gets skipped, and a skipped morning must cost nothing: no guilt state, no broken evening. The noon redirect is the one pushy element — if it annoys, cut it before cutting the page.
- **A partial day looks like a whole one.** Morning sliders count toward wellness, so a morning-only day has a score built from one or two values. Watch Trends and the calendar for days that read better or worse than they were.
- **The morning lock strands a typo.** Locking keeps the intention honest for "did I live it?", but a mistake noticed at night can't be fixed. If that bites, loosen the lock to the text only — don't remove it.
- **Tedium kills the ritual.** The nightly entry must stay under ~90s. Embedding the living task list in Reflect must not add friction to the parts that already work.
- **Todo migration data loss.** Per-entry todos → `tasks` is the first destructive-ish migration; migrate undone items forward, keep completed history queryable, verify on local stack before `db push`.
- **Settings CRUD invites deletes.** Archive-only in the UI — a hard delete would orphan historical entry values.
- **API keys at rest.** BYO keys live in an RLS-protected Postgres row — fine for the current threat model, but consider Supabase Vault encryption before any multi-user future. Never log keys in the Edge Function.
- **Retro doc drift.** The coach rewrites a document the owner also hand-edits — every run must version, never overwrite silently, and the summary must say what it changed.
- **The chat coach's brief turns into a data dump.** The fixed context is for what almost every question needs. Everything else stays a tool call, or cost and answer quality both get worse as history grows.
- **Journal text in transit.** Tool arguments and results carry reflections. The "never log" rule in `ai-coach` covers them as much as it covers keys.
- **AI coach slippage.** SMART is the north star. Keep M6 read-only and narrow. If it drags, cut chat UI polish, not the tool loop.
