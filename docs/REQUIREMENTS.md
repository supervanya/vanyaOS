# VanyaOS — Requirements (v3)

**One-line vision:** A phone-first **one-stop shop for everything in my life** — daily tasks, habits, goals, and an evening reflection whose structured signal an **AI turns into action items and honest goal-tracking**.

**The six pillars (roadmap value prop, 2026-07-17):**
1. **TODO** — see and set current to-do lists, habits, and goals
2. **REF** ✅ — reflect every evening on the day / habits / wellbeing
3. **RE** — retrospectives on fitness areas: finances, health, exercise, work
4. **SMART** — holistic AI report across everything
5. **SYNC** — bring in data from notes / calendar / email
6. **OUT** — export into other platforms

> **North star (unchanged):** every design decision optimizes one question — *is this the kind of signal an AI can turn into good action items and goal progress?* The daily surfaces (dashboard, reflection) are the means; the AI loop is the end. It was validated by hand in M0 before a line of automation was built.

**Status:** M0 shipped and was validated — deployed to GitHub Pages, installed on the phone home screen, used for real reflections. The manual AI loop (Copy/Export → paste into an AI) was **tried and confirmed to produce genuinely useful action items** — the north star is no longer a hypothesis, it's proven. That validation is what justifies building the automated version next (see ROADMAP).

**Pivot (2026-06-30):** the GitHub-markdown storage model is dropped. See [ADR-002](adr/ADR-002-supabase-backend-pivot.md) and ARCHITECTURE.md v2 for the new Supabase-based backend.

---

## Locked decisions (updated 2026-06-30)

| Area | Decision | Why |
|---|---|---|
| Form factor | Cloud-hosted **PWA**, installable on phone; one URL on phone + Mac | True cross-device with zero hand-rolled sync |
| Source of truth | **Postgres** (Supabase) — normalized tables, not a file | Real schema, queryable history, no markdown parsing |
| Auth | **Real login**, magic link (passwordless email) via Supabase Auth | Solo account, not a shared passcode; no password to type nightly |
| Cross-device | **Eventual sync** — both devices log into the same account, same rows; no realtime co-editing | A reflection happens once, in one sitting; realtime sync is 10x cost for ~0 value here |
| Primary device | **Phone** (evening, touch sliders) | Drives mobile-first, big tap targets |
| v1→v2 core | **Evening reflection + habits** (incl. goal glance + tomorrow's todos) **+ automated AI coaching** | The daily heartbeat, now closing the loop automatically instead of via manual paste |
| Slider scale | **0–5**, symptoms inverted ("0 is best"), folded into a composite **wellness score** | Thumb-fast on a phone; 0 captures a true none/skipped |
| Habits | **Binary** done / not-done (chips) | Cleanest data, one tap, easy streaks |
| Config | **DB tables** (metrics/habits/goals), managed in-app once M3's Settings ships; `config.ts` demotes to first-run seed only | The DB was already the source of truth; Settings makes it editable from the phone |
| Users | **Solo** — one account, just Vanya | Multi-user is explicitly out of scope; schema happens to be `user_id`-scoped anyway (free isolation, not a commitment to build accounts for others) |
| Todos | **One living list** (`tasks` table, scopes today/week/someday), shown on both the dashboard and the reflection screen | "Current to-dos" is a real thing you open the app for; roll-forward copying is deleted — an undone task simply stays. `completed_at` gives history for free |
| 1-3-5 rule | Tasks carry a **size** (big/medium/small); the weekly board is **hard-capped at 1/3/5 per size** — going over forces a swap to Someday | ~80 competing things → the constraint forces picking. No silent overflow, ever |
| Projects | **WIP limit 1** — `projects` table, exactly one `in_progress` (DB-enforced), rest in the parking lot, tap to swap | "The single biggest unlock": one project at a time, by construction |
| Areas hierarchy | Health→Work→Systems→Projects **not built** (no areas table/UI) | Cut in the 2026-07-18 grill — parked until a felt need |
| Home screen | **Dashboard at `/`** — glanceable *and* actionable: check tasks, toggle habits, glance goals, navigate to Reflect/Settings | One-stop shop: run the day without drilling into sections. Reflection moves to `/reflect` |
| Settings | **Full CRUD + archive** at `/settings` for metrics/habits/goals (add, rename, reorder, archive; goal progress editable) | Control over the app's setup without the Supabase dashboard or a redeploy. Archive, never delete — history survives |
| Themes | **Life-themes / focus areas**; minimal `active_theme` stamped on each entry | Makes history filterable later; full theme management deferred |
| Offline | Online-first, but a **local draft buffer** (localStorage) protects an in-progress entry from a dropped connection | Wifi is usually present, but a save should never be lost to a network hiccup |
| Markdown export | **Dropped** — no Copy/Export button in v2 | DB rows are the only source of truth; export can return later as a generated view if ever wanted |

**The AI loop is no longer manual-first.** M4 (see ROADMAP) automates exactly the loop already validated by hand: an explicit "Finish reflection" tap triggers a server-side call to the Claude API, which writes action items + goal-progress notes back to the entry. No copy, no paste. It deliberately ships *after* the M2 dashboard/todos and M3 settings build-out.

**Explicitly deferred:** chat-style coach (ask-anything over your history — automated synthesis ships first), history & trends views, automated SYNC (import notes/calendar/email), EXPORT integrations to other platforms, fitness-area retrospectives (RE), theme management, multi-user sign-up.

---

## v2 scope — the nightly reflection entry

Everything below is filled on **one screen**:

1. **Metric sliders (0–5)**, grouped:
   - *Discipline* → Eating health, Movement health
   - *Stimulation* → IQ stimulation, Reading
   - *Symptoms (inverted, 0 = best)* → Brain fog, Lower back pain
   - A live **composite wellness score** = mean of all metrics with symptoms flipped (`scale − value`).
2. **Habit check-off** — tap chips on/off for the day's habits.
3. **Goal glance** — read-only list of goals with a manually-set progress bar.
4. **Free-text reflection** — a textarea, auto-growing.
5. **Todos** — the shared living task list (today / week / someday), embedded from the same `tasks` table the dashboard uses. No per-day copies, no roll-forward — undone tasks simply stay.
6. **Autosave** — every change writes to a local draft buffer instantly, then syncs to Postgres in the background. The active **theme** is stamped on the entry at creation.
7. **Finish reflection** — an explicit action, distinct from autosave, that triggers the AI coach: a server call synthesizes the entry into action items + goal-progress notes, which appear automatically once ready.

**Done for the night** = sliders set, habits ticked, reflection written, "Finish reflection" tapped → the entry is durably stored in Postgres (visible from any device on the same account), and coaching output appears without further action.

---

## Resolved decisions (superseding the 2026-06-19 grill)

1. **Storage** — ✅ Postgres via Supabase. Markdown-in-git is dropped; see ADR-002.
2. **Auth** — ✅ Real magic-link login via Supabase Auth, replacing the single-passcode-gate plan. Solo account only.
3. **AI loop** — ✅ Automated, not manual. Validated by hand first (the north star is proven, not a bet), then built as a server-triggered Edge Function call.
4. **Config** — ✅ DB tables, editable in-app once M3's Settings ships (add/rename/reorder/archive); `config.ts` is a first-run seed only.
5. **Export** — ✅ Dropped for v2. Was the manual AI bridge in M0; the bridge is now automated, so the button has no remaining job.
6. **Todos (2026-07-17)** — ✅ promoted from per-day snapshots to one living `tasks` list; roll-forward deleted. Slider scale, habits, themes — unchanged from the original grill.

---

## Future backlog (post-v2, see ROADMAP.md)

- **Chat coach** — ask-anything interface over your stored history, once automated synthesis (M2) is proven.
- **History power-ups** — correlations (e.g. "back pain ↔ low movement"), weekly digests.
- **SYNC** — calendar → todos, notes → reflection seed, email.
- **RE / fitness-area retros** — periodic deep-dives on Financial / Health / Exercise / Work.
- **Multi-user** — explicitly out of scope; would mean a sign-up flow and possibly billing, not a schema change.
