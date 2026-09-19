// Solo-account auth (Supabase Auth, magic link) — see ADR-002 / ARCHITECTURE.md.
// The router checks the session before every navigation (routes/__root.tsx);
// data code asks for the user id when it has to write `user_id` explicitly.

import type { Session } from "@supabase/supabase-js"
import { supabase } from "./supabaseClient"

/** The stored session, or null — a failed read counts as signed out. */
export async function currentSession(): Promise<Session | null> {
  try {
    const { data } = await supabase.auth.getSession()
    return data.session
  } catch {
    return null
  }
}

// For the `user_id` column on writes. Read from the stored session, not
// getUser() (a network round-trip per call — every autosave paid it): RLS
// already rejects any row whose user_id isn't the caller's auth.uid().
export async function currentUserId(): Promise<string> {
  const session = await currentSession()
  if (!session) throw new Error("Not authenticated")
  return session.user.id
}

/** Calls `onChange` when the user signs in or out (not on token refreshes). */
export function onSignInOrOut(onChange: (signedIn: boolean) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") onChange(true)
    if (event === "SIGNED_OUT") onChange(false)
  })
  return () => data.subscription.unsubscribe()
}
