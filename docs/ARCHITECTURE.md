# VanyaOS — Architecture (v1)

## Recommended stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js (App Router) + React**, mobile-first, PWA (manifest + service worker) | One repo for UI + API, installable on phone, port the existing `v2.html` screen directly |
| Backend | **Next.js API routes** (serverless) | No separate server to run; holds the git token server-side |
| Storage / source of truth | **Private GitHub repo**, one `.md` per day, written via the **GitHub Contents API** | Honors "markdown in a git repo I own"; no database; versioned for free |
| Auth | **Single passcode** (one env-var secret, signed cookie) | It's a public URL with intimate data; full accounts are overkill for one user |
| Hosting | **Vercel** (free tier) | Zero-ops deploy, instant HTTPS URL, great PWA support |

**Why this beats the alternatives:** A persistent server (Fly/Railway + a real git checkout) lets you use plain `fs.writeFile` + `git commit`, which is simpler *code* — but it's a box to babysit. Vercel + GitHub API is **lowest-ops** for a solo prototype and still keeps Markdown-in-git as the source of truth. A plain database (KV/SQLite) would be simplest of all but **breaks the portable-markdown requirement** — rejected.

> **Fallback:** if the GitHub Contents API (one commit per save) ever feels janky, swap the storage layer for **Fly.io + a persistent volume holding a git checkout**. The frontend and data model don't change — only the save/load functions.

## System shape

```
 ┌─────────────┐        ┌─────────────────────┐        ┌──────────────────┐
 │  Phone PWA  │  HTTPS │  Next.js on Vercel  │  API   │  Private GitHub  │
 │  (installed)│ <────> │  - /reflect (UI)    │ <────> │  repo            │
 └─────────────┘        │  - /api/day (R/W)   │        │  YYYY-MM-DD.md   │
 ┌─────────────┐        │  - passcode gate    │        │  config/*.json   │
 │  Mac browser│ <────> │                     │        │  fitness/*.md    │
 └─────────────┘        └─────────────────────┘        └──────────────────┘
   Both devices → same URL → same files = "handoff" with no sync engine.
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
wellness: 6.6                 # computed composite (symptoms inverted)
metrics:
  eating_health: 7
  movement_health: 6
  iq_stimulation: 7
  brain_fog: 3                # raw value; direction lives in config
  lower_back_pain: 4
habits:                       # only the ones done today
  strength: true
  breathwork: true
  no_dessert: true
todos:                        # each item tracks done-state for roll-forward
  today:
    - { text: "Call dentist", done: false }
  week:
    - { text: "Draft Q3 plan", done: false }
---

## Reflection
Felt sharp after the morning walk; back tightened up by evening...
```

### Todo roll-forward

Todos live in each day's frontmatter. When a **new day's entry is first opened**, the app reads the most recent prior day and copies forward every item with `done: false` (preserving its `today`/`week` scope). Completed items stay in their original day's file as history. This is purely load-time behavior — no separate todo store.

## Config schemas

```jsonc
// config/metrics.json
[
  { "id": "eating_health",   "label": "Eating health",   "group": "Discipline",   "higher_is_better": true,  "scale": 10 },
  { "id": "brain_fog",       "label": "Brain fog",       "group": "Symptoms",     "higher_is_better": false, "scale": 10 }
]

// config/habits.json
[ { "id": "strength", "label": "Strength" }, { "id": "breathwork", "label": "Breathwork" } ]

// config/goals.json
[ { "id": "vo2", "label": "VO2 max → 48", "progress": 0.62, "note": "62%" } ]

// config/app.json — single active life-theme (theme management is deferred)
{ "active_theme": "recovery", "themes": ["recovery", "deep-work"] }
```

`higher_is_better: false` is how symptom inversion is handled — no special-casing in code. The wellness score = mean of `value` for positive metrics and `scale − value` for inverted ones.

## Save flow

1. User taps **Save** → POST `/api/day` with the entry JSON.
2. API route validates, renders the `.md` (frontmatter + body), reads today's file SHA if it exists.
3. PUT to GitHub Contents API (create or update) → a commit lands.
4. On load, GET today's file (and `config/*`) → hydrate the screen. If today exists, it's editable, not duplicated.

## Non-goals for v1 (architectural)

No realtime sync, no offline write-queue, no multi-user, no database, no integrations. Each is a clean later addition because the data contract (markdown + frontmatter) doesn't change.
