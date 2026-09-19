# VanyaOS

A personal life-OS PWA: a React 19 SPA on Vite 8 with TanStack Router (file-based routes) and TanStack Query, Tailwind v4 + shadcn/ui, and Supabase (Postgres + RLS + Auth + one Edge Function). Bun is the runtime; GitHub Pages hosts it. TypeScript 7, strict.

```bash
bun --bun run dev     # dev server on :3000
bun run check         # format check + lint + typecheck — run before saying you're done
bun run test          # vitest
bun --bun run build   # production build
bun run format        # Prettier, whole repo
bun run lint:fix      # Oxlint auto-fixes
bun run db:types      # regenerate src/lib/database.types.ts from the local Supabase stack
```

Git hooks (Lefthook, installed by `bun install`) lint, format and typecheck every commit and run the tests before every push; CI runs the same checks on every PR and they must pass to merge. Don't bypass them with `--no-verify` or `LEFTHOOK=0` — fix what they report.

## Where code goes

| Path | Holds |
|---|---|
| `src/routes/` | One file per page: its loader and layout. Thin — no data code. |
| `src/features/<name>/` | Everything for one feature: `api.ts` (Supabase calls, row mapping), `queries.ts` (`queryOptions`), its components and hooks, and their tests. |
| `src/components/` | UI shared by several features. `ui/` is shadcn/ui. |
| `src/lib/` | Generic helpers only: Supabase client, auth, dates, parsing, errors, the query client. `database.types.ts` is generated — never edit it. |
| `supabase/` | Migrations and the `ai-coach` Edge Function (Deno, not part of the Vite project). |

## Conventions

How to write React here — data loading, mutations, effects, components — is in [docs/conventions/react.md](docs/conventions/react.md). Read it before touching a component. The short version:

- **Data goes through TanStack Query.** A route's loader calls `ensureQueryData`; components read with `useSuspenseQuery`; writes use `useOptimisticList` or invalidate the queries they change. Never fetch in a `useEffect`.
- **Types come from the database.** Rows are typed by the generated `Database` type. Text columns pinned by a `CHECK` constraint are narrowed with `oneOf()`. Anything from outside the program (localStorage, Edge Function responses, `catch`) is `unknown` until checked — no `as` casts on it; use `errorMessage(err)` for errors.
- **Imports** cross folders through `@/…`; siblings may use `./…`. Parent-relative `../` imports fail lint.
- **Tests** sit next to the code they test (`*.test.ts[x]`) and run in Vitest.

## Planning

Three layers. Don't mix them up — each one rots if it absorbs the others' content.

| Layer | Location | Holds |
|---|---|---|
| Strategy | [docs/ROADMAP.md](docs/ROADMAP.md) | Milestones, Definitions of Done, risks, value-ordered backlog. Changes rarely. |
| Work items | GitHub Issues | Every feature, polish item, bug, and piece of feedback. Changes constantly. |
| Decisions | [docs/adr/](docs/adr/) | Architecture decision records. One per irreversible technical choice. |

**Never add granular polish items to ROADMAP.md** — they belong in issues. ROADMAP.md changes only when a milestone's _scope_ or _DoD_ changes, or a milestone closes. Read the relevant milestone section before starting an issue: its DoD is the acceptance bar, not the issue body.

### Issue conventions

Every issue gets exactly one `type/` label and one `size/` label, plus a milestone.

- **`type/`**: `type/bug` (broken behavior) · `type/polish` (works, but feels wrong — the biggest bucket) · `type/feature` (new capability) · `type/chore` (deps, config, refactor, docs)
- **`size/`** — estimated _effort_, never importance: `size/xs` (< 30 min) · `size/s` (~1 hour) · `size/m` (a session) · `size/l` (multiple sessions). A `size/l` is a smell: split it into sub-issues before starting.
- **`priority/high`** — optional, only for issues that should jump the queue within their milestone (e.g. a bug that corrupts data). No label means normal priority.
- **Milestone** — `M4`, `M5`, `M6`, or `Backlog`, matching ROADMAP.md. Not the current milestone and not urgent → `Backlog`.
- **Dependencies** — write `Blocked by #12` in the body. Add the `blocked` label only while it is _actually_ blocked. For a parent/child breakdown, use GitHub sub-issues.

### Working an issue

1. Branch off `main` — never commit to `main` directly.
2. Reference the issue in the PR body as `Closes #47` so it closes on merge.
3. Verify against the issue's acceptance criteria _and_ the milestone DoD before saying it's done.
4. Anything out of scope you notice along the way becomes a new issue, not a bigger diff.

## Things that bite

- **Supabase migrations**: verify against the local stack before `db push`. Several tables carry historical entry data — the app archives, it never hard-deletes. After a migration, run `bun run db:types` and commit the result — CI fails when the types drift from the migrations.
- **API keys**: BYO provider keys live in an RLS-protected `ai_settings` row. The browser never reads the key back, and the Edge Function must never log it.
- **Retro docs**: the coach writes a _new version_, never overwrites — the owner hand-edits the same document between runs.
- **The dashboard is the scope-creep vector.** Everything on it must be actionable in one tap or a glance; anything needing a form lives in its own section.
