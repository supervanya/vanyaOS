# VanyaOS — Requirements (v1)

**One-line vision:** A phone-first evening ritual whose real purpose is to capture structured nightly signal an **AI turns into action items and honest goal-tracking**. The reflection screen is the data-capture front end for an AI coaching loop.

> **North star:** every design decision optimizes one question — *is this the kind of signal an AI can turn into good action items and goal progress?* The reflection UI is the means; the AI loop is the end.

**Status:** A **running local prototype** exists — a TanStack Start (SPA) app driven by localStorage, ported from the original HTML mockup (`vanyaos_evening_reflection_super-early-prototype.html`). It runs locally and is viewable on the phone over LAN; deploy + GitHub sync are deferred (see ROADMAP **Phase 0**).

---

## Locked decisions (from requirements grill, 2026-06-19)

| Area | Decision | Why |
|---|---|---|
| Form factor | Cloud-hosted **PWA**, installable on phone; one URL on phone + Mac | True cross-device with zero hand-rolled sync |
| Source of truth | **One Markdown file per day** in a private git repo | Portable, versioned, no DB, future-proof for the SMART report |
| Cross-device | **Eventual sync** — both devices hit the same backend; no realtime co-editing | A reflection happens once, in one sitting; realtime sync is 10x cost for ~0 value here |
| Primary device | **Phone** (evening, touch sliders) | Drives mobile-first, big tap targets |
| v1 core | **Evening reflection + habits** (incl. goal glance + tomorrow's todos) | The daily heartbeat; generates the data everything else needs |
| Slider scale | **0–5**, symptoms inverted ("0 is best"), folded into a composite **wellness score** | Thumb-fast on a phone; 0 captures a true none/skipped |
| Habits | **Binary** done / not-done (chips) | Cleanest data, one tap, easy streaks |
| Config | **Config files** (JSON/MD) edited by hand; no in-app Settings UI in v1 | Lists rarely change; ship the ritual faster |
| Lists | Seed from the prototype; you edit `config/*.json` directly | Unblocks the build; lists aren't precious |
| Auth | **Single passcode gate** + signed cookie (in M0) | Public URL holding symptom/mood data should not be world-readable |
| Todos | Unfinished todos **roll forward** to the next day | Nothing falls through; no re-typing recurring items |
| Themes | **Life-themes / focus areas**; minimal `active_theme` stamped into each entry's frontmatter | Makes history filterable later; full theme management deferred |
| Offline | Online-first; offline is a nice-to-have | Wifi is always present where reflection happens |

**The AI loop is the north star — not deferred.** The *automated* report comes later, but the value is available **now**: the Copy/Export buttons emit clean markdown you paste into an AI for action items + goal progress. Only the automation of that call is later work.

**Explicitly deferred (NOT in v1):** automated SYNC (import notes/calendar/email), EXPORT integrations to other platforms, fitness-area retrospectives (RE), the four fitness MD files (Financial/Health/Exercise/Work), in-app Settings UI, and theme management.

---

## v1 scope — the nightly reflection entry

Everything below is filled on **one screen** (the prototype is the visual spec):

1. **Metric sliders (0–5)**, grouped:
   - *Discipline* → Eating health, Movement health
   - *Stimulation* → IQ stimulation
   - *Symptoms (inverted, 0 = best)* → Brain fog, Lower back pain
   - A live **composite wellness score** = mean of all metrics with symptoms flipped (`5 − value`).
2. **Habit check-off** — tap chips on/off for the day's habits.
3. **Goal glance** — read-only list of goals with a manually-set progress bar (what you're building toward).
4. **Free-text reflection** — a textarea + **"Copy to notes"** button (plain-text export to your notes app).
5. **Tomorrow's todos** — quick capture, split into *must-do tomorrow* / *this week*, each a checkable item. **Unfinished items roll forward** to the next day automatically. (The TODO half of the core.)
6. **Save** — writes/overwrites today's `.md` file (frontmatter + body) and commits it. The current **`active_theme`** (from config) is stamped into the entry's frontmatter.

**Done for the night** = sliders set, habits ticked, reflection written, saved → a commit lands in the repo and reopening the app shows today's entry.

---

## Resolved decisions (was: open questions)

All five open questions from the requirements grill are now closed:

1. **Metric/habit/goal lists** — ✅ Start from the prototype's set (eating, movement, IQ, brain fog, back pain; habits: Strength, Breathwork, 7k steps, No dessert, Book at night; goals: VO2 max→48, Yoga month, No brain fog). You edit `config/*.json` directly anytime; these are a seed, not canonical.
2. **"Themes"** — ✅ *Life-themes / focus areas* (e.g. "this month = recovery"), **not** visual skins. v1 ships a minimal version: a single `active_theme` defined in config and stamped into each entry's frontmatter, so history is filterable by theme later. Theme *management* (add/switch in-app) is deferred. Visual skins/dark mode are a separate, trivial concern if ever wanted.
3. **Privacy** — ✅ A **single passcode gate** + signed cookie is required (built in M0), not optional. "Optimize for simplicity" applies to everything *behind* the gate, not to leaving symptom data on an open URL.
4. **Slider scale** — ✅ **0–5** (thumb-fast; 0 = none/skipped). Symptom inversion is `5 − value` (0 = best symptom day); the older `6 − value` (1–5) and `10 − value` (0–10) are superseded.
5. **Goal progress** — ✅ **Manually set** in `config/goals.json` for v1; auto-computed progress is a later SMART/SYNC feature.

---

## Future backlog (post-v1, see ROADMAP.md)

- **History & trends** (M2): past entries, habit streaks, metric sparklines — the "open it daily" hook.
- **SYNC**: calendar → todos, notes → reflection seed, email.
- **EXPORT**: push reflections/todos to other platforms.
- **SMART report**: AI synthesis across everything (cheap *because* the frontmatter is clean).
- **RE / fitness-area retros**: periodic deep-dives on Financial / Health / Exercise / Work, each a portable MD file.
- **Settings UI** + **themes**.
