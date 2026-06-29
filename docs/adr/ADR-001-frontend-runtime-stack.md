# ADR-001: Frontend & runtime stack — TanStack Start (SPA mode)

**Status:** Accepted
**Date:** 2026-06-29
**Deciders:** Vanya (solo)
**Supersedes:** the Next.js choice in the initial ARCHITECTURE.md draft

## Context

VanyaOS v1 is a phone-first PWA (installable on phone + Mac, one URL) whose source of truth is **one Markdown file per day in a private GitHub repo**, written via the GitHub Contents API. There is **no database**. A **single passcode** should gate access since intimate data sits behind a public URL. Online-first; SYNC/EXPORT/SMART are deferred.

The initial draft reached for Next.js purely as "a place to keep a server-side secret." The owner rejected it: the App-Router/SSR machinery is weight this app doesn't need, and the preference is to go all-in on the **TanStack ecosystem**.

The real forcing function is **not rendering strategy** — it's that the GitHub write-credential must live *somewhere*. That single choice determines whether a server is needed at all.

## Decision

Build the app with **TanStack Start configured as a pure SPA (`ssr: false`)**:

- **TanStack Router** for typed client routing, **TanStack Query** for client cache, **React** + **Vite**.
- **TanStack Start server functions** (`createServerFn`, run by Nitro) are the *only* server surface. They hold the GitHub token (env var) and perform all Contents API reads/writes, and they validate the passcode.
- **PWA** via `vite-plugin-pwa` (manifest + service worker) for phone install.
- **No SSR.** Server functions are typed RPC, not page rendering — none of the Next App-Router weight.
- One deployable (Nitro), targeting **Cloudflare Workers / Netlify** (Node as fallback).

The data contract (day-file schema, config files, roll-forward, save flow) is **unchanged** — only the app shell/runtime changes.

## Options Considered

### Option A: TanStack Start, `ssr: false` (CHOSEN)
| Dimension | Assessment |
|-----------|------------|
| Complexity | Low — SPA + typed server fns, no SSR |
| Cost | Free tier (Workers/Netlify) |
| Secret handling | Strong — token server-held; real passcode gate |
| Deployables | 1 |
| Ecosystem maturity | Newer/smaller than Next, but Vite-based and stable enough for a solo app |

**Pros:** All-TanStack; no SSR weight; GitHub token never reaches the client; passcode is a genuine server-side gate; single deploy; TanStack Query pairs cleanly with server-fn calls.
**Cons:** TanStack Start is younger than Next (smaller community, faster-moving APIs); still ships *a* server runtime (Nitro), so not a zero-backend static deploy.

### Option B: TanStack Router — pure static SPA, no backend
| Dimension | Assessment |
|-----------|------------|
| Complexity | Lowest — static files only |
| Cost | Free (any static host) |
| Secret handling | Weaker — repo-scoped PAT stored encrypted on-device, PIN-unlocked |
| Deployables | 1 (static) |

**Pros:** Zero server; deploy to GitHub Pages; absolute minimum fluff; `api.github.com` supports CORS so the browser can call the Contents API directly.
**Cons:** GitHub token lives on each device (encrypted); "passcode" degrades from a real gate to a local unlock. Rejected because the owner preferred to keep the credential server-side.

### Option C: TanStack Router SPA + separate backend (Hono on Bun/Workers)
| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium — two services |
| Cost | Free tier |
| Secret handling | Strong — token in backend |
| Deployables | 2 |

**Pros:** Cleanest frontend/backend separation; backend reusable for future SYNC.
**Cons:** Two things to deploy and version. Dominated by Option A, which gets the same secrecy from one deployable. Rejected.

## Trade-off Analysis

The decision reduced to **where the GitHub write-token lives**. Keeping it server-side (A/C) buys real secret isolation and a true passcode gate at the cost of running *some* server. Putting it on-device (B) buys a zero-backend static deploy at the cost of a weaker credential posture. The owner chose secrecy over the last bit of simplicity.

Given that a server surface is therefore required, **A beats C**: TanStack Start's server functions provide exactly that surface inside the same app and deploy, with no SSR. C's separate backend adds a second deployable for no additional benefit at this scale.

## Consequences

- **Easier:** secret handling and passcode become trivial (env var + signed HTTP-only cookie checked in server fns); one repo, one deploy; fully TanStack as desired.
- **Harder / to watch:** TanStack Start is younger than Next — expect occasional breaking releases and thinner docs; pin versions. Server functions mean we can't deploy to a *pure* static host (need a Nitro-capable target).
- **To revisit:** if SYNC (calendar/notes/email) lands later, the server-function layer is where those integrations live — confirm it scales before committing to it as the integration home. The Fly.io + persistent-volume fallback (filesystem + `git`) remains available if the GitHub Contents API ever feels limiting.

## Action Items
1. [ ] Scaffold TanStack Start with `ssr: false`; add TanStack Router + TanStack Query.
2. [ ] Add `vite-plugin-pwa` (manifest + service worker); verify phone install.
3. [ ] Implement passcode server fn → signed HTTP-only cookie; gate all GitHub server fns on it.
4. [ ] Implement `day` read/write server fns against the GitHub Contents API (create/update with blob SHA).
5. [ ] Choose Nitro deploy target (Cloudflare Workers or Netlify) and wire `GITHUB_TOKEN` + `APP_PASSCODE` env vars.
6. [ ] Confirm GitHub fine-grained PAT scope = the journal repo only, contents read/write.
