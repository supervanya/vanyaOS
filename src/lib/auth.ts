// Solo-account auth (Supabase Auth, email + password) — see ADR-002 / ARCHITECTURE.md.
// The router checks the session before every navigation (routes/__root.tsx);
// data code asks for the user id when it has to write `user_id` explicitly.

import { isAuthRetryableFetchError } from "@supabase/supabase-js"
import { supabase } from "./supabaseClient"

/**
 * Whether an account is signed in, for the router's guard. A stored access
 * token that has expired is refreshed first; if that refresh fails only
 * because the network is unreachable (a cold start offline, or before the
 * connection is back), the account is still signed in: Supabase keeps the
 * session and retries the refresh, so the page's own loader fails and offers a
 * retry instead of sending the user to /login. Any other failure counts as
 * signed out.
 */
export async function isSignedIn(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.getSession()
    return data.session !== null || isAuthRetryableFetchError(error)
  } catch {
    return false
  }
}

// For the `user_id` column on writes. Read from the stored session, not
// getUser() (a network round-trip per call — every autosave paid it): RLS
// already rejects any row whose user_id isn't the caller's auth.uid().
// Offline with an expired token, this throws the network error, not
// "Not authenticated".
export async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  if (data.session) return data.session.user.id
  throw error ?? new Error("Not authenticated")
}

/** Calls `onChange` when the user signs in or out (not on token refreshes). */
export function onSignInOrOut(onChange: (signedIn: boolean) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") onChange(true)
    if (event === "SIGNED_OUT") onChange(false)
  })
  return () => data.subscription.unsubscribe()
}
