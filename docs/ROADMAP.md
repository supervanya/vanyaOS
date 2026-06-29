# VanyaOS — Roadmap (v1)

Sequenced to get you reflecting on your phone **as fast as possible**, then to make it *stick*. Each milestone has a concrete Definition of Done (DoD) — don't move on until it's met.

---

## Phase 0 — Local UI prototype  *(CURRENT — settle the experience before any deploy)*
Prove the *feel* on your phone before investing in deploy/sync plumbing.
- TanStack Start (`ssr: false`) running **locally**, viewed on the phone over LAN (`http://<mac-lan-ip>:3000`).
- **localStorage** persistence, no backend — `src/lib/storage.ts` is the single swap point for the future GitHub layer.
- Full reflection screen: 0–5 grouped sliders + wellness, habit chips, goal bars, todos (with roll-forward), journal.
- **Copy today** + **Export all (.md)** → the canonical day-file markdown. Doubles as the **AI bridge**: paste into an AI for action items / goal progress.

**DoD:** You reflect on your phone for a few nights, the UI feels right, and you're exporting markdown to back up + feed an AI. Only then graduate to M0.

> Why first: you reprioritized the AI coaching loop and "settle the UI first." localStorage + export delivers both with zero infra. Deploy/GitHub/passcode (M0) is wasted effort until the nightly screen is one you actually want to open.

---

## M0 — Deploy & persistence pipeline  *(graduate here once Phase 0's UI is settled)*
Prove the plumbing before building features.
- TanStack Start app (`ssr: false`) deployed (Cloudflare Workers / Netlify) with a live HTTPS URL.
- PWA manifest + service worker (`vite-plugin-pwa`) → installable to phone home screen.
- Single **passcode gate** — passcode server fn → signed HTTP-only cookie.
- A `day` **server function** can **write and read a `.md` file** in the private GitHub repo (round-trip a dummy entry).

**DoD:** Open the URL on your phone, install it, log in with the passcode, hit "save," and see a commit appear in your journal repo. No real UI yet.

> Why first: GitHub-API auth + deploy env vars (`GITHUB_TOKEN`, `APP_PASSCODE`) + PWA install are exactly the things that quietly eat a weekend. Find the friction now, not after you've built the UI.

---

## M1 — The nightly ritual  *(the core; port the existing mockup)*
Turn `vanyaos_evening_reflection_super-early-prototype.html` into the real `/reflect` route, wired to the `day` server function.
- Grouped 0–5 sliders + live composite wellness score (symptoms inverted).
- Habit chips (binary, from `config/habits.json`).
- Goal glance with manual progress bars (`config/goals.json`).
- Free-text reflection + "Copy to notes".
- Tomorrow's todos (tomorrow / this week), checkable; **unfinished items roll forward** from the most recent prior day on open.
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

1. **Automated AI report (the north star)** — synthesis across all entries into action items + goal progress. Available **manually today** via Copy/Export → paste to an AI; this item is only about *automating* that call (e.g. a server fn calling Claude post-deploy). Cheap because the markdown is already clean.
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
- **Phase 0 data loss.** localStorage is the only store until M0 — a cache-clear wipes everything, and phone/Mac hold separate data. The export button is your backup; export regularly.
