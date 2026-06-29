# VanyaOS — Roadmap (v1)

Sequenced to get you reflecting on your phone **as fast as possible**, then to make it *stick*. Each milestone has a concrete Definition of Done (DoD) — don't move on until it's met.

---

## M0 — Skeleton & pipeline  *(de-risk the boring-but-fatal parts first)*
Prove the plumbing before building features.
- Next.js app on Vercel with a live HTTPS URL.
- PWA manifest + service worker → installable to phone home screen.
- Single **passcode gate** (signed cookie).
- `/api/day` can **write and read a `.md` file** in the private GitHub repo (round-trip a dummy entry).

**DoD:** Open the URL on your phone, install it, log in with the passcode, hit "save," and see a commit appear in your journal repo. No real UI yet.

> Why first: GitHub-API auth + Vercel env vars + PWA install are exactly the things that quietly eat a weekend. Find the friction now, not after you've built the UI.

---

## M1 — The nightly ritual  *(the core; port the existing mockup)*
Turn `vanyaos_evening_reflection_super-early-prototype.html` into the real `/reflect` screen, wired to `/api/day`.
- Grouped 1–5 sliders + live composite wellness score (symptoms inverted).
- Habit chips (binary, from `config/habits.json`).
- Goal glance with manual progress bars (`config/goals.json`).
- Free-text reflection + "Copy to notes".
- Tomorrow's todos (today / this week), checkable; **unfinished items roll forward** from the most recent prior day on open.
- Save → today's `.md`; reopening loads & edits today's entry. Active life-theme (`config/app.json`) is stamped into frontmatter.

**DoD:** You complete a **real reflection tonight on your phone**, it commits to git, and reopening shows it. This is the moment VanyaOS becomes real.

---

## M2 — History & continuity  *(the "open it every day" hook)*
A ritual with no memory gets abandoned. This is what makes it sticky.
- Browse past days (list + single-day view).
- Habit **streak / consistency** display.
- Simple **metric sparklines** (wellness + per-metric trend).

**DoD:** You can see your last 7–14 days, a habit streak, and a wellness trend line — and it makes you want to keep the streak alive.

---

## M3 — Polish & daily-use hardening  *(only what real usage demands)*
- Offline PWA cache + write queue (the deferred nice-to-have), *if* spotty connection annoys you.
- Tighter auth / per-day edit history if wanted.
- Smooth out whatever felt clunky after 2 weeks of real use.

**DoD:** You've used it daily for two weeks and stopped noticing the tool.

---

## Deferred backlog (post-v1)
Roughly in value order. Each is additive — none requires changing the day-file contract.

1. **SMART report** — AI synthesis across all `days/*.md`. Cheap now: the frontmatter is already clean structured data. *Highest payoff for least effort post-v1.*
2. **History power-ups** — correlations (e.g. "back pain ↔ low movement"), weekly digests.
3. **SYNC** — calendar → todos; notes → reflection seed; email. (Hardest, most fragile — that's why it's deferred.)
4. **RE / fitness-area retros** — periodic deep-dives on Financial / Health / Exercise / Work as `fitness/*.md`.
5. **EXPORT** — push reflections/todos to other platforms.
6. **Settings UI** + **themes** (life-themes / focus areas).

---

## Risks to watch
- **Tedium kills it.** If the nightly entry takes >90s, you'll quit. Guard M1's speed jealously; resist adding fields.
- **Storing intimate data on a public URL** without the passcode gate. M0 makes it required, not optional.
- **Scope creep back toward "everything in my life."** The whole grill narrowed this to one ritual — every deferred item stays deferred until M2's DoD is met.
- **GitHub API friction.** If it bites, switch to the Fly.io + volume fallback (ARCHITECTURE.md) without touching the UI or data model.
