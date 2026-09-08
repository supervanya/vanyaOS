# Multi-tenancy readiness audit

**Date:** 2026-09-07 · **Scope:** schema/RLS, `ai-coach` edge function, client auth & storage,
hosting, CI, ops scripts · **Question asked:** what breaks if VanyaOS is opened to other users?

The RLS foundation is sound: every table is `user_id`-scoped, `retros_owner` validates the parent
FK, grants are per-table and fail-closed, and the `entry_wellness_scores` definer-view leak was
already caught and fixed (`20260807000000_view_security_invoker.sql`). The blockers are not in the
row policies — they are around them.

**Minimum bar before user #2:** C1–C5. Ship H6 and H7 in the same pass — they are cheap, and H7 is
what stops the rest from regressing.

---

## Critical

### C1. BYO API keys are stored in plaintext

`supabase/migrations/20260808033856_byo_ai_retros.sql:11` — `api_key text not null`.

RLS stops other *users* reading it, but not the service role, the Supabase dashboard, a `pg_dump`,
a PITR backup, or anyone holding the access token. Today that is one key; with other users it is
their billing and our liability. `docs/ROADMAP.md:108` already flags this as the multi-user
prerequisite.

**Fix:** move to Supabase Vault, or a `pgsodium` encrypted column decrypted only inside the edge
function. Drop the plaintext column in the same migration.

### C2. `scripts/db-mirror-prod.sh` copies all production data — including `auth` — to a laptop

`supabase db dump --linked --data-only --schema auth,public`. With one user this is a convenience.
With other users it is every person's journal (health and mental-health content), every plaintext
API key, and the auth schema, unencrypted in `/tmp` and in a local Postgres.

**Fix:** replace with anonymized or synthetic seed data before user #2, not after.

### C3. No sign-out anywhere, and drafts are not user-scoped

`grep -rn signOut src/` returns nothing — no logout in `AppShell.tsx` or anywhere else. Sessions
persist in `localStorage` and refresh indefinitely. Compounding it, the draft key is date-only:

```ts
const draftKey = (date: string) => `${DRAFT_PREFIX}${date}`   // src/lib/storage.ts:302
```

On a shared or family device, user B opening today's reflection loads user A's unsaved draft.

**Fix:** add sign-out that calls `supabase.auth.signOut()` **and** clears all `DRAFT_PREFIX*` keys;
namespace the draft key by user id.

### C4. No account deletion, and the FKs make it impossible anyway

All 11 `user_id uuid not null references auth.users` declarations lack `on delete cascade`.
Deleting a user in the Supabase dashboard fails on foreign-key violation — a deletion request
cannot be honored.

**Fix:** add `on delete cascade`; ship delete-my-account and export-my-data paths. For a journal
holding health data with real users this is a legal obligation, not a nicety.

### C5. Signup is wide open and email delivery will silently fail

`enable_signup = true`, no invite gate, no allowlist — anyone who finds the Pages URL can create an
account, seed config rows, and invoke the edge function on our quota. Separately,
`[auth.rate_limit] email_sent = 2`: Supabase's built-in SMTP is throttled to a couple of emails per
hour and is explicitly not for production, so magic links stop arriving as soon as more than one
person signs up.

**Fix:** custom SMTP (Resend/Postmark) **and** an invite allowlist before opening the door.

---

## High

### H6. `entry_metric_values` / `entry_habits` check the parent entry but not the metric/habit

`supabase/migrations/20260701010018_init_schema.sql:159-173`:

```sql
exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid())
```

Nothing validates that `metric_id` / `habit_id` belong to the caller. A user can insert rows in
their own entry pointing at another user's metric uuid. Not a read leak (the join is RLS-filtered
after `security_invoker`), but it is cross-tenant write coupling: it blocks the victim from ever
deleting that metric row, and it is a uuid-existence oracle.

**Fix:** add the ownership `exists` check for the referenced metric/habit — the `retros_owner`
policy already does this correctly; copy that pattern.

### H7. Zero tests, and no CI guard that RLS is on

`find src -name "*.test.*"` returns nothing despite vitest being wired up. One cross-user leak has
already shipped (the definer view). The same class recurs the moment a table is added with a
`grant` but without `enable row level security` — that table is then readable by every
authenticated user, with no error anywhere.

**Fix:**
1. CI assertion that every table in `public` has RLS enabled and at least one policy, and that
   every view is `security_invoker`.
2. A two-user integration test proving user A cannot read or write any of user B's rows.

### H8. `ai-coach` has no rate limit, `CORS: *`, and caller-controlled limits

`supabase/functions/ai-coach/index.ts:35` — `Access-Control-Allow-Origin: "*"` lets any origin call
it with a stolen JWT. `maxTokens` and the `messages` array are unbounded from the client. And
`list-models` accepts an arbitrary `provider` + `apiKey`, making it a free credential-validation
oracle against Anthropic/OpenAI/Google for any authenticated user.

**Fix:** pin CORS to the Pages origin, clamp `maxTokens` and payload size server-side, add
per-user invocation limits.

### H9. The paste-the-link login flow is a session-fixation vector

`src/routes/login.tsx:16` — `extractTokenHash` accepts any pasted token and calls `verifyOtp`.
"Paste this link to fix your sign-in" makes the victim log into the *attacker's* account and
journal into it. Solo, irrelevant; multi-user, a real phishing path.

**Fix:** show which email the token resolves to and require confirmation; only accept tokens whose
URL origin matches the app.

---

## Medium

- **Silent seeding failures.** `seedMissingDefaults` (`src/lib/storage.ts:120`) discards every
  insert error and runs on each load — two tabs racing produce partial config with no signal. Fine
  when one person can debug it; a support burden at scale.
- **No per-user quotas or observability.** No row caps, no usage view, no abuse alerting. One user
  can grow the DB or edge-invocation count without limit.
- **Static hosting means no security headers.** GitHub Pages cannot set CSP/HSTS/frame-ancestors.
  Worth moving to Cloudflare Pages or Netlify once other people's data sits behind the login.
- **Realtime is enabled** but unused; ensure nothing joins the `supabase_realtime` publication
  without an RLS review.
- **No audit trail** on destructive actions. Archive is used for config rows, but entries, tasks
  and retros deletions leave nothing behind.

---

## Clean

- **Markdown rendering.** `src/components/Markdown.tsx` uses react-markdown with no `rehype-raw`,
  so AI and user content cannot inject markup.
- **Edge function auth.** `ai-coach` uses the caller's JWT rather than the service role, so the
  `ai_settings` read goes through RLS.
- **Key never reaches the browser.** `getAiSettings` deliberately omits `api_key`
  (`src/lib/storage.ts:629`).
- **Grants are per-table and fail-closed** — a new table without its own grant 403s rather than
  leaking.
