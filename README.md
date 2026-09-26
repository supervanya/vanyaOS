# VanyaOS

A personal life-OS, installed on the phone as a PWA: a command-center dashboard (the week's 1-3-5 tasks, habits, goals, one project in progress), a nightly reflection with wellness sliders, trends over time, and AI-coached retrospectives on areas of life, run with your own AI provider key.

**Live:** [supervanya.github.io/vanyaOS](https://supervanya.github.io/vanyaOS/) · **Where it's going:** [docs/ROADMAP.md](docs/ROADMAP.md) · **How it's built:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

React 19 on Vite 8 with TanStack Router and TanStack Query, Tailwind v4 + shadcn/ui, and Supabase (Postgres with row-level security, magic-link auth, one Edge Function). TypeScript 7, Bun.

## Run it locally

You need [Bun](https://bun.sh) and Docker (for the local Supabase stack).

```bash
bun install                  # also installs the git hooks
bunx supabase start          # local Postgres + Auth; applies supabase/migrations
cp .env.example .env.local   # then paste the API URL and publishable key `supabase start` printed
bun --bun run dev            # http://localhost:3000
```

Sign in with any email: the magic link lands in the local mail inbox at http://localhost:54324, not a real mailbox. To work against a copy of production data instead, run `bun run db:mirror` (it resets the local database).

The AI coach calls your own provider. Add a key under **Settings → AI coach**; it's stored in your account row and only read by the `ai-coach` Edge Function.

## Commands

| Command | Does |
|---|---|
| `bun --bun run dev` | Dev server with hot reload, reachable from a phone on the same network |
| `bun run check` | Format check, lint (type-aware), typecheck and unused-code check — what CI runs |
| `bun run test` | Vitest |
| `bun --bun run build` | Production build to `dist/` |
| `bun run format` / `bun run lint:fix` | Fix formatting / auto-fixable lint |
| `bun run db:types` | Regenerate `src/lib/database.types.ts` after a migration |

Commits are formatted, linted and typechecked by a pre-commit hook; pushes run the tests. Every PR runs the same checks in CI, and they must pass to merge.

## Contributing

Read [AGENTS.md](AGENTS.md) first: where code goes, the conventions, and how issues and planning work (humans and AI agents follow the same file). The React patterns are in [docs/conventions/react.md](docs/conventions/react.md). Work is tracked in [GitHub Issues](https://github.com/supervanya/vanyaOS/issues); branch off `main` and open a PR that says `Closes #<issue>`.

## Deploy

Merging to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

1. Applies new migrations to the hosted Supabase project and deploys the Edge Function.
2. Builds the app with the production Supabase URL and publishable key (repository variables).
3. Publishes `dist/` to GitHub Pages under `/vanyaOS/`.

Migrations go first, so the schema never lags the app. Pull requests never get production credentials: CI applies the migrations to a throwaway local Postgres instead, and fails a new migration whose timestamp sorts before one already on `main`.

## Docs

- [ROADMAP.md](docs/ROADMAP.md): milestones and what "done" means for each
- [ARCHITECTURE.md](docs/ARCHITECTURE.md): the system, the schema, the AI coach
- [REQUIREMENTS.md](docs/REQUIREMENTS.md): the original product requirements
- [adr/](docs/adr/): the decisions behind the stack (Vite + TanStack Router, Supabase)
