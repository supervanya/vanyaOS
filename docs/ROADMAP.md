# VanyaOS — Roadmap (v2)

Sequenced to get you reflecting on your phone **as fast as possible**, then to make it *stick*, then to close the AI loop for real. Each milestone has a concrete Definition of Done (DoD) — don't move on until it's met.

> **2026-06-30 pivot:** the GitHub-markdown storage model is dropped for **Supabase (Postgres + Auth + one Edge Function)**. See [ADR-002](adr/ADR-002-supabase-backend-pivot.md). Phase 0 and M0 below are unchanged historical fact — they validated the ritual UI and the AI loop *by hand*, on localStorage. Everything from M1 onward targets the new backend.

---

## Phase 0 — Local UI prototype  ✅ **DONE** (closed 2026-06-29)
Settled the *feel* on-device before investing in deploy/sync plumbing.
- TanStack Router on Vite, localStorage store, viewed on the phone over LAN.
- Full reflection screen: 0–5 grouped sliders + composite wellness, habit chips, goal bars, todos with roll-forward, auto-growing journal.
- Plus polish that wasn't even planned: shadcn/ui, device-driven light/dark theme, semantic color tokens, iOS haptics, confetti habit completion, a date navigator with post-midnight default, and Copy/Export as the manual AI bridge.

**✅ Met:** the nightly screen is one worth opening; markdown export worked as backup + AI input.

---

## M0 — Static deploy (on-device data)  ✅ **DONE** (validated 2026-06-30)
Shipped the UI to a public URL as an installable PWA, data in localStorage — no server, no login.
- Vite + TanStack Router static build, deployed to GitHub Pages via GitHub Actions.
- PWA manifest + service worker → installed on the phone home screen.
- **Validated live:** installed from the real URL, completed a real reflection, and — critically — **pasted a real export into an AI and got action items good enough to justify the whole ritual.** The north star is proven, not a hypothesis.

**Superseded, not wasted:** the localStorage-only storage layer is being replaced starting M1. Whatever test data is sitting in localStorage right now is prototype data — it's fine to let it go; nothing from it needs to migrate.

---

## M1 — Accounts & durable storage (Supabase)  *(CURRENT)*
Replace localStorage with a real backend before building anything (like history) that depends on the data actually surviving. This is the milestone that makes M0's data-loss risk go away for good.
- Create the Supabase project; apply the schema from ARCHITECTURE.md (`entries`, `entry_metric_values`, `entry_habits`, `todos`, `metrics`, `habits`, `goals`) with RLS policies scoping every table to the logged-in account.
- Seed `metrics`/`habits`/`goals` rows from the current `config.ts` defaults.
- Build the login screen: email → magic link → session. Solo account.
- Replace `src/lib/storage.ts`'s localStorage calls with Supabase client calls, keeping the same function shapes so the UI barely changes.
- Add the **local draft buffer**: autosave still writes to localStorage first (instant, offline-safe), then syncs to Postgres in the background.

**DoD:** log in on your phone via magic link, complete a real reflection, and see the *same* entry when you open the same URL on your Mac (same account, same rows). A dropped connection mid-edit doesn't lose the entry.

---

## M2 — Automated AI coach  *(closes the loop you already validated by hand)*
M0 proved the manual loop works. This automates exactly that — no new UX risk, just removing the copy/paste.
- Add an explicit **"Finish reflection"** action, distinct from the silent autosave (so the AI isn't called on every keystroke).
- Write and deploy the `synthesize-entry` **Supabase Edge Function**: reads the entry + its metrics/habits/todos, calls the **Claude API**, writes one row to `ai_reports`.
- Subscribe to `ai_reports` inserts via **Supabase Realtime** so the coaching output (action items + goal-progress notes) appears automatically, no refresh.
- Remove the now-redundant Copy/Export button.

**DoD:** tap "Finish reflection" on a real entry and see AI-generated action items appear on-screen within the same session — without touching another app.

---

## M3 — History & continuity  *(the "open it every day" hook — now safe to build)*
A ritual with no memory gets abandoned. This was sequenced *after* M1 on purpose: streaks and trends are only worth building on data that's actually durable and synced across devices, which wasn't true until now.
- Browse past days (list + single-day view) via plain SQL queries against `entries`.
- Habit **streak / consistency** display.
- Simple **metric sparklines** (wellness + per-metric trend), using the `entry_wellness_scores` view.

**DoD:** you can see your last 7–14 days, a habit streak, and a wellness trend line, consistent whether you check on phone or Mac — and it makes you want to keep the streak alive.

---

## M4 — Polish & daily-use hardening  *(only what real usage demands)*
- Harden the local-draft-buffer/Postgres reconciliation if any edge cases show up in real use (e.g. two devices editing the same day close together).
- Tighten magic-link UX if email delivery ever feels slow (password fallback is a Supabase Auth config change, not a rebuild).
- Smooth out whatever felt clunky after two weeks of real use on the new backend.

**DoD:** you've used it daily for two weeks on the Supabase backend and stopped noticing the tool.

---

## Deferred backlog (post-v2)
Roughly in value order. None requires another schema rewrite — the tables already anticipate them.

1. **Chat coach** — ask-anything interface over your stored history ("how's my back pain trending"), once M2's automated synthesis is proven out.
2. **History power-ups** — correlations (e.g. "back pain ↔ low movement"), weekly digests — plain SQL over the same tables.
3. **In-app Settings UI** — editing `metrics`/`habits`/`goals` from the app instead of directly in Supabase. Cheaper now than it would've been on JSON files.
4. **SYNC** — calendar → todos; notes → reflection seed; email. (Hardest, most fragile — still deferred.)
5. **RE / fitness-area retros** — periodic deep-dives on Financial / Health / Exercise / Work.
6. **Multi-user** — explicitly out of scope; RLS already isolates by `user_id`, but there's no sign-up flow, invites, or billing, and none is planned.

---

## Risks to watch
- **Tedium kills it.** If the nightly entry takes >90s, you'll quit. Keep "Finish reflection" a single tap, separate from the silent autosave — don't let the AI call add friction to the parts that already work.
- **Offline write loss.** Postgres has no built-in offline story the way localStorage did — the local draft buffer (M1) exists specifically to prevent a dropped connection from eating an entry. Watch this in real use; harden in M4 if it ever actually bites.
- **Magic-link deliverability.** If email delays or spam-filtering ever locks you out at night, add a password fallback (Supabase Auth config, no rebuild) rather than tolerating friction on the one moment that matters.
- **Scope creep back toward "everything in my life."** Every deferred item stays deferred until the milestone ahead of it is actually done — the chat coach doesn't get pulled forward before M2 is proven, history power-ups don't get pulled forward before M3 is proven.
- **Vendor lock to Supabase.** Mitigated in practice — it's Postgres underneath, so a `pg_dump` is always an escape hatch if the platform ever stops fitting.
