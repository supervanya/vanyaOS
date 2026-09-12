# Working on VanyaOS

A personal life-OS PWA: TanStack Start + React on Vite, Tailwind + shadcn/ui, Supabase (Postgres + RLS + Edge Functions), Bun as the runtime, deployed via GitHub Pages.

```bash
bun --bun run dev     # dev server on :3000
bun --bun run test    # vitest
bun --bun run build   # production build
```

## Where planning lives

Three layers. Don't mix them up — each one rots if it absorbs the others' content.

| Layer | Location | Holds |
|---|---|---|
| Strategy | [docs/ROADMAP.md](docs/ROADMAP.md) | Milestones, Definitions of Done, risks, value-ordered backlog. Changes rarely. |
| Work items | GitHub Issues | Every feature, polish item, bug, and piece of feedback. Changes constantly. |
| Decisions | [docs/adr/](docs/adr/) | Architecture decision records. One per irreversible technical choice. |

**Never add granular polish items to ROADMAP.md** — they belong in issues. ROADMAP.md changes only when a milestone's *scope* or *DoD* changes, or a milestone closes.

Read the relevant milestone section of ROADMAP.md before starting work on an issue. The DoD there is the acceptance bar, not the issue body.

## Issue conventions

Every issue gets exactly one `type/` label and one `size/` label, plus a milestone.

**`type/`** — what kind of work it is:
- `type/bug` — broken behavior
- `type/polish` — works, but feels wrong (the biggest bucket in practice)
- `type/feature` — new capability
- `type/chore` — deps, config, refactor, docs

**`size/`** — estimated *effort*, never importance:
- `size/xs` (< 30 min) · `size/s` (~1 hour) · `size/m` (a session) · `size/l` (multiple sessions)

A `size/l` is a smell: try to split it into sub-issues before starting.

**`priority/high`** — optional, and only for issues that should jump the queue within their milestone (e.g. a bug that corrupts data). No label means normal priority; there's no low or medium.

**Milestone** — `M4`, `M5`, `M6`, or `Backlog`, matching ROADMAP.md. If it doesn't belong to the current milestone and isn't urgent, it goes to `Backlog`.

**Dependencies** — write `Blocked by #12` in the issue body; GitHub renders it as a live link with open/closed state. Add the `blocked` label only while it is *actually* blocked, and remove it when the blocker closes. For a parent/child breakdown, use GitHub sub-issues so the parent gets a progress bar.

## Working an issue

1. Branch off `main` — never commit to `main` directly.
2. Reference the issue in the PR body as `Closes #47` so it closes on merge.
3. Verify against the issue's acceptance criteria *and* the milestone DoD before saying it's done.
4. Anything you notice along the way that's out of scope becomes a new issue, not a bigger diff.

## Triage

`/triage` takes a raw dump of notes and files them as properly labeled issues. Use it rather than filing them ad hoc — it keeps the taxonomy consistent.

## Things that bite

- **Supabase migrations**: verify against the local stack before `db push`. Several tables carry historical entry data — the app archives, it never hard-deletes.
- **API keys**: BYO provider keys live in an RLS-protected `ai_settings` row. Never log them in Edge Functions.
- **Retro docs**: the coach writes a *new version*, never overwrites — the owner hand-edits the same document between runs.
- **The dashboard is the scope-creep vector.** Everything on it must be actionable in one tap or a glance; anything needing a form lives in its own section.
