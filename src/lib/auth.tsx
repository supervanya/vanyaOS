// Solo-account auth state (Supabase Auth, magic link). One provider at the
// root; useAuth() elsewhere. See ADR-002 / ARCHITECTURE.md.

import { createContext, useContext, useEffect, useState } from "react"
import type { ReactNode } from "react"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "./supabaseClient"

type AuthState = { session: Session | null; loading: boolean }

const AuthContext = createContext<AuthState>({ session: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setState({ session: data.session, loading: false })
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false })
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
