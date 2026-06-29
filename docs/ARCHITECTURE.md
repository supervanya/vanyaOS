# VanyaOS — Architecture (v1)

## Recommended stack

> Stack decision recorded in [ADR-001](adr/ADR-001-frontend-runtime-stack.md).
>
> **Phase 0 (current):** the app runs **locally** with **localStorage** as the store and no backend yet — the server functions, passcode, and GitHub writes described below are the M0 *graduation* target, not what exists today. The export button already emits the exact day-file markdown documented here, so the storage swap (`src/lib/storage.ts` → a GitHub server fn) is the only change needed. See ROADMAP **Phase 0**.

| Layer | Choice | Why |
|---|---|---|
| Frontend | **TanStack Start (`ssr: false`) + TanStack Router + React**, Vite, mobile-first | SPA with zero SSR weight; one repo for UI + server fns; port the prototype screen directly |
| Backend | **TanStack Start server functions** (Nitro) | Typed RPC, the only server surface; holds the GitHub token + checks the passcode — no separate service |
| Data cache | **TanStack Query** over the server functions | Caches today's entry + config; clean mutations on save |
| Storage / source of truth | **Private GitHub repo**, one `.md` per day, written via the **GitHub Contents API** | Honors "markdown in a git repo I own"; no database; versioned for free |
| Auth | **Single passcode** → server fn validates env secret, issues a signed HTTP-only cookie | Public URL with intimate data; full accounts are overkill for one user |
| PWA | **`vite-plugin-pwa`** (manifest + service worker) | Installable on the phone home screen |
| Hosting | **Cloudflare Workers / Netlify** (Nitro preset; Node fallback) | Zero-ops, instant HTTPS; not tied to Vercel/Next |

**Why this shape (see ADR-001 for the full comparison):** the only reason a server exists at all is to keep the GitHub write-token off the client and run a real passcode gate. TanStack Start's server functions provide exactly that surface *inside the same SPA and deploy* — no SSR, no second service. A pure static SPA (Option B) was rejected because it would push the token onto each device; a separate backend (Option C) adds a deployable for no gain at this scale. A plain database would be simplest of all but **breaks the portable-markdown requirement** — rejected.

> **Fallback:** if the GitHub Contents API (one commit per save) ever feels janky, swap the storage layer for **Fly.io + a persistent volume holding a git checkout**. The frontend and data model don't change — only the save/load functions.

## System shape

```
 ┌─────────────┐        ┌──────────────────────────┐        ┌──────────────────┐
 │  Phone PWA  │  HTTPS │  TanStack Start (ssr:off)│  API   │  Private GitHub  │
 │  (installed)│ <────> │  SPA shell: /reflect     │ <────> │  repo            │
 └─────────────┘        │  server fns:             │        │  YYYY-MM-DD.md   │
 ┌─────────────┐        │   - day read/write       │        │  config/*.json   │
 │  Mac browser│ <────> │   - passcode → cookie    │        │  fitness/*.md    │
 └─────────────┘        └──────────────────────────┘        └──────────────────┘
   Both devices → same URL → same files = "handoff" with no sync engine.
   Server fns (Nitro) are the only server surface; they hold GITHUB_TOKEN.
```

## Data repo layout (the source of truth)

```
vanya-journal/                 (private GitHub repo, separate from app code)
  days/
    2026-06-19.md              one file per day — frontmatter + journal body
  config/
    metrics.json               slider definitions (id, label, group, direction)
    habits.json                habit list (id, label)
    goals.json                 goals + manual progress
  fitness/                     (deferred / RE module)
    financial.md  health.md  exercise.md  work.md
```

## Day file schema

The split is the whole point: **frontmatter = machine-readable** (powers the future SMART report for free), **body = human-readable** journal.

```markdown
---
date: 2026-06-19
theme: recovery               # active_theme stamped from config (for later filtering)
wellness: 3.4                 # computed composite on 0–5 (symptoms inverted)
metrics:
  eating_health: 4
  movement_health: 3
  iq_stimulation: 4
  brain_fog: 2                # raw value 0–5; direction lives in config
  lower_back_pain: 2
habits:                       # only the ones done today
  strength: true
  breathwork: true
  no_dessert: true
todos:                        # each item tracks done-state for roll-forward
  tomorrow:
    - { text: "Call dentist", done: false }
  week:
    - { text: "Draft Q3 plan", done: false }
---

## Reflection
Felt sharp after the morning walk; back tightened up by evening...
```

### Todo roll-forward

Todos live in each day's frontmatter. When a **new day's entry is first opened**, the app reads the most recent prior day and copies forward every item with `done: false` (preserving its `tomorrow`/`week` scope). Completed items stay in their original day's file as history. This is purely load-time behavior — no separate todo store.

## Config schemas

```jsonc
// config/metrics.json
[
  { "id": "eating_health",   "label": "Eating health",   "group": "Discipline",   "higher_is_better": true,  "scale": 5 },
  { "id": "brain_fog",       "label": "Brain fog",       "group": "Symptoms",     "higher_is_better": false, "scale": 5 }
]

// config/habits.json
[ { "id": "strength", "label": "Strength" }, { "id": "breathwork", "label": "Breathwork" } ]

// config/goals.json
[ { "id": "vo2", "label": "VO2 max → 48", "progress": 0.62, "note": "62%" } ]

// config/app.json — single active life-theme (theme management is deferred)
{ "active_theme": "recovery", "themes": ["recovery", "deep-work"] }
```

`higher_is_better: false` is how symptom inversion is handled — no special-casing in code. The wellness score = mean of `value` for positive metrics and `(max − value)` for inverted ones. On the 0–5 scale that's `5 − value` (0 = best symptom day → contributes 5).

## Save flow

1. User taps **Save** → calls the `day` write **server function** with the entry JSON (cookie checked first).
2. The server fn validates, renders the `.md` (frontmatter + body), reads today's file SHA if it exists.
3. PUT to GitHub Contents API (create or update) → a commit lands.
4. On load, GET today's file (and `config/*`) → hydrate the screen. If today exists, it's editable, not duplicated.

## Non-goals for v1 (architectural)

No realtime sync, no offline write-queue, no multi-user, no database, no integrations. Each is a clean later addition because the data contract (markdown + frontmatter) doesn't change.
