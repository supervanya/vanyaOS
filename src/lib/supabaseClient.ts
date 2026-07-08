// Supabase is the only backend (ADR-002): Postgres + Auth + RLS, called
// directly from the browser. No server function needed for ordinary CRUD —
// RLS is the security boundary. See docs/ARCHITECTURE.md.

import { createClient } from "@supabase/supabase-js"

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY — copy .env.example to .env.local and fill them in.",
  )
}

export const supabase = createClient(url, publishableKey)
