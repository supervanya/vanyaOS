# ADR-002: Backend pivot — Supabase (Postgres + Auth + Edge Functions)

**Status:** Accepted
**Date:** 2026-06-30
**Deciders:** Vanya (solo)
**Supersedes:** ADR-001 in full (both its options were about hiding a GitHub write-token; that constraint no longer exists)

## Context

M0 shipped a static SPA (Vite + TanStack Router) on GitHub Pages with **localStorage** as the only store — validated the ritual UI, the manual AI loop (Copy/Export → paste into an AI → real, useful action items), and that the reflection is fast enough to survive nightly use.

Two problems now block the next milestone:

1. **No durable, cross-device storage.** Each device's localStorage is a separate, cache-clearable copy. History/streaks (the "open it daily" hook) are worthless if the data under them can vanish.
2. **The owner no longer wants the GitHub-markdown model at all.** Real login (not a shared passcode) and a proper relational schema are wanted, plus the AI loop should be **built into the product**, not a manual paste.

This invalidates ADR-001 at the root: that ADR's entire decision was "where does the GitHub write-token live." With GitHub dropped as the storage backend, the token question disappears and a new one replaces it — where do accounts, structured data, and the AI call live?

## Decision

Adopt **Supabase** as the entire backend:

- **Postgres** (managed) — normalized schema (`entries`, `entry_metric_values`, `entry_habits`, `todos`, `metrics`, `habits`, `goals`, `ai_reports`), not a document/markdown blob. See ARCHITECTURE.md for DDL.
- **Supabase Auth** — real accounts, magic-link (passwordless) sign-in. Session handled by the Supabase JS client, persisted for PWA use.
- **Row-Level Security** — every table scoped `user_id = auth.uid()`. Single-tenant today (just Vanya), but the isolation is free and means multi-user is a policy change, not a schema rewrite, if ever wanted.
- **Frontend stays a static Vite SPA on GitHub Pages, unchanged.** The Supabase JS client talks to Postgres/Auth directly from the browser over HTTPS; RLS is the security boundary instead of a server-held secret. No server function needed for ordinary CRUD.
- **One Supabase Edge Function** (`synthesize-entry`) is the only server-side code in the whole system — it exists solely to hold the `ANTHROPIC_API_KEY` and call the Claude API. Invoked by the client (`supabase.functions.invoke(...)`) after an explicit "Finish reflection" action; writes its result to `ai_reports`.
- **Markdown is dropped entirely.** No `.md` files, no frontmatter, no Copy/Export button in v1. Postgres rows are the only source of truth.

## Options Considered

### Option A: Supabase (CHOSEN)
| Dimension | Assessment |
|---|---|
| Complexity | Low — one platform for DB + auth + RLS + edge functions |
| Cost | Free tier covers solo use indefinitely |
| Secret handling | `ANTHROPIC_API_KEY` lives only in the Edge Function's env |
| Deployables | Frontend (unchanged, GitHub Pages) + 1 Edge Function |
| Fit with existing work | Keeps the GitHub Pages/Actions deploy already built for M0 |

**Pros:** Real Postgres with SQL and RLS (not a bespoke document store); built-in auth with magic link out of the box; Realtime subscriptions available for pushing the AI report back to the UI without polling; doesn't require abandoning the static-hosting deploy already shipped.
**Cons:** Vendor dependency on Supabase specifically (mitigated — it's Postgres underneath; a `pg_dump` always gets you a portable escape hatch).

### Option B: Convex
| Dimension | Assessment |
|---|---|
| Complexity | Low — reactive TS-native DB + colocated functions |
| Cost | Free tier |
| Secret handling | Functions hold secrets; auth needs a bolted-on provider (Clerk/Auth.js) |
| Deployables | Frontend + Convex functions |

**Pros:** Excellent TypeScript ergonomics, reactive queries feel native to React.
**Cons:** Not SQL/Postgres — a different mental model with a smaller query/tooling ecosystem than Postgres; no first-party auth, so login still means integrating a separate provider. Rejected: Supabase gets equivalent DX plus real SQL plus built-in auth in one platform.

### Option C: Revive TanStack Start server functions + hosted Postgres (Neon/Fly) + Auth.js/Better-Auth
| Dimension | Assessment |
|---|---|
| Complexity | Highest — three integrated pieces to wire and deploy |
| Cost | Free tiers, but more moving parts to keep free |
| Secret handling | Strong — token/keys server-held |
| Deployables | Server (Nitro) + Postgres + auth provider |

**Pros:** Most control; reuses the server-function pattern ADR-001 originally chose.
**Cons:** Re-enters exactly the TanStack Start static-build breakage that ADR-001's revision fled, *and* requires leaving GitHub Pages for a Nitro-capable host, *and* means integrating auth by hand. Most moving pieces for no advantage over Option A at this scale. Rejected.

## Trade-off Analysis

The old forcing function (hide a GitHub token) is gone; the new one is "get real accounts + a real schema + an automated AI call with the least new infrastructure." Supabase collapses auth + database + the one bit of server-side secrecy needed (the Claude API key) into a single platform, and — unlike reviving TanStack Start — it doesn't force abandoning the GitHub Pages deploy that already works. Convex is a close second but trades away SQL and bundles no auth. Option C is strictly more complex than A for no added benefit here.

## Consequences

- **Easier:** real login (magic link, no cookie/session code to write), a real relational schema queryable with SQL (streaks/sparklines in M3 become plain queries, not hand-rolled markdown parsing), RLS instead of hand-rolled authorization, Realtime instead of polling for the AI result.
- **Harder / to watch:** the frontend now needs a **local draft buffer** (write-ahead to localStorage, synced to Postgres in the background) so a flaky connection mid-reflection doesn't lose an entry — Postgres has no offline story by itself the way localStorage did. Magic-link delivery depends on email deliverability; if that ever becomes annoying, add a password fallback in Supabase Auth (one config change, no schema change).
- **To revisit:** if VanyaOS ever becomes multi-user, RLS policies already assume `user_id` scoping — the schema doesn't need to change, only sign-up flow and any admin surface.

## Action Items
1. [ ] Create the Supabase project; apply the schema in ARCHITECTURE.md (`entries`, `entry_metric_values`, `entry_habits`, `todos`, `metrics`, `habits`, `goals`, `ai_reports`) with RLS policies on every table.
2. [ ] Enable magic-link auth; build the login screen (email → "check your inbox" → session).
3. [ ] Seed `metrics`/`habits`/`goals` rows from the current `config.ts` defaults for the account.
4. [ ] Replace `src/lib/storage.ts`'s localStorage calls with Supabase client calls; keep the same function signatures so the UI barely changes.
5. [ ] Add the local-draft-buffer write-ahead so autosave survives a dropped connection.
6. [ ] Write and deploy the `synthesize-entry` Edge Function (reads an entry, calls Claude API, writes `ai_reports`); wire an explicit "Finish reflection" button to invoke it.
7. [ ] Subscribe to `ai_reports` inserts via Supabase Realtime so the coaching output appears without a manual refresh.
