# VanyaOS — Requirements (v2)

**One-line vision:** A phone-first evening ritual whose real purpose is to capture structured nightly signal an **AI turns into action items and honest goal-tracking**. The reflection screen is the data-capture front end for an AI coaching loop.

> **North star:** every design decision optimizes one question — *is this the kind of signal an AI can turn into good action items and goal progress?* The reflection UI is the means; the AI loop is the end.

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
| Config | **DB tables** (metrics/habits/goals) edited directly for now; no in-app Settings UI yet | Cheap now that there's a real DB; unblocks a future settings screen without a schema change |
| Users | **Solo** — one account, just Vanya | Multi-user is explicitly out of scope; schema happens to be `user_id`-scoped anyway (free isolation, not a commitment to build accounts for others) |
| Todos | Unfinished todos **roll forward** to the next day | Nothing falls through; no re-typing recurring items |
| Themes | **Life-themes / focus areas**; minimal `active_theme` stamped on each entry | Makes history filterable later; full theme management deferred |
| Offline | Online-first, but a **local draft buffer** (localStorage) protects an in-progress entry from a dropped connection | Wifi is usually present, but a save should never be lost to a network hiccup |
| Markdown export | **Dropped** — no Copy/Export button in v2 | DB rows are the only source of truth; export can return later as a generated view if ever wanted |

**The AI loop is no longer manual-first.** M2 (see ROADMAP) automates exactly the loop already validated by hand: an explicit "Finish reflection" tap triggers a server-side call to the Claude API, which writes action items + goal-progress notes back to the entry. No copy, no paste.

**Explicitly deferred (NOT in v2):** chat-style coach (ask-anything over your history — automated synthesis ships first), automated SYNC (import notes/calendar/email), EXPORT integrations to other platforms, fitness-area retrospectives (RE), in-app Settings UI, theme management, multi-user sign-up.

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
5. **Tomorrow's todos** — quick capture, split into *must-do tomorrow* / *this week*, each checkable. **Unfinished items roll forward** to the next day automatically.
6. **Autosave** — every change writes to a local draft buffer instantly, then syncs to Postgres in the background. The active **theme** is stamped on the entry at creation.
7. **Finish reflection** — an explicit action, distinct from autosave, that triggers the AI coach: a server call synthesizes the entry into action items + goal-progress notes, which appear automatically once ready.

**Done for the night** = sliders set, habits ticked, reflection written, "Finish reflection" tapped → the entry is durably stored in Postgres (visible from any device on the same account), and coaching output appears without further action.

---

## Resolved decisions (superseding the 2026-06-19 grill)

1. **Storage** — ✅ Postgres via Supabase. Markdown-in-git is dropped; see ADR-002.
2. **Auth** — ✅ Real magic-link login via Supabase Auth, replacing the single-passcode-gate plan. Solo account only.
3. **AI loop** — ✅ Automated, not manual. Validated by hand first (the north star is proven, not a bet), then built as a server-triggered Edge Function call.
4. **Config** — ✅ Moved into DB tables (still hand-edited for now, no Settings UI), rather than JSON files in the repo.
5. **Export** — ✅ Dropped for v2. Was the manual AI bridge in M0; the bridge is now automated, so the button has no remaining job.
6. **Slider scale, habits, todos roll-forward, themes** — unchanged from the original grill (see history in git for the earlier v1 rationale).

---

## Future backlog (post-v2, see ROADMAP.md)

- **Chat coach** — ask-anything interface over your stored history, once automated synthesis (M2) is proven.
- **History power-ups** — correlations (e.g. "back pain ↔ low movement"), weekly digests.
- **In-app Settings UI** — now cheaper than before since metrics/habits/goals are already DB rows, not files.
- **SYNC** — calendar → todos, notes → reflection seed, email.
- **RE / fitness-area retros** — periodic deep-dives on Financial / Health / Exercise / Work.
- **Multi-user** — explicitly out of scope; would mean a sign-up flow and possibly billing, not a schema change.
