# VanyaOS — Roadmap (v1)

Sequenced to get you reflecting on your phone **as fast as possible**, then to make it *stick*. Each milestone has a concrete Definition of Done (DoD) — don't move on until it's met.

---

## Phase 0 — Local UI prototype  ✅ **DONE** (closed 2026-06-29)
Settled the *feel* on-device before investing in deploy/sync plumbing.
- TanStack Start (`ssr: false`) on **localStorage**, viewed on the phone over LAN. `src/lib/storage.ts` remains the single swap point for the GitHub layer.
- Full reflection screen — this ended up covering **M1's UI scope** too: 0–5 grouped sliders + composite wellness, habit chips, goal bars, todos with roll-forward, auto-growing journal.
- Plus polish that wasn't even planned: shadcn/ui, device-driven light/dark theme, semantic color tokens (success/warning/error/info), iOS Taptic haptics, confetti habit completion, a date navigator with post-midnight default, and **Copy/Export** as the manual **AI bridge**.

**✅ Met:** the nightly screen is one worth opening; markdown export works as backup + AI input.

> Because the full UI shipped here, **M1 below is effectively folded into M0** — the only thing left is to persist it to GitHub and deploy it.

---

## M0 — Static deploy (on-device data)  *(CURRENT)*
Ship the existing UI to a public URL as an installable PWA, with data staying in
**localStorage on each device** — no server, no GitHub-API writes, no passcode
(nothing on a server to protect). Cross-device sync is deferred to a later
milestone (the server/GitHub-API path from ADR-001).
- **Vite + TanStack Router** static build (`vite build → dist/`) — TanStack *Start* dropped (its static build is broken on the pinned version; see ADR-001 revision).
- **PWA** (`vite-plugin-pwa`) manifest + service worker → installable on the home screen.
- Deploy to **GitHub Pages** (public repo, free) at `https://supervanya.github.io/vanyaOS/` via a GitHub Actions workflow; base path `/vanyaOS/`.

**DoD:** open the URL on your phone, install it to the home screen, complete a reflection, and have it persist in that device's localStorage. No server, no login.

> Tradeoff: localStorage-only means **no phone↔Mac sync** — each device keeps its own data; Copy/Export markdown is the bridge. Adding sync later = the deferred server path.

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
