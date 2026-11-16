import { supabase } from "@/lib/supabaseClient"
import { DEFAULT_APP_NAME } from "./manifest"

// The account's name lives in its auth metadata, not a table: the stored
// session already carries it, so reading it costs no request and no migration.

/** Longest name accepted. iOS cuts Home Screen labels at about 12 characters. */
export const MAX_NAME_LENGTH = 20

/** "Vanya" → "VanyaOS"; no name yet → the default. */
export function appNameFor(name: string | null): string {
  return name ? `${name}OS` : DEFAULT_APP_NAME
}

/** The name as typed, trimmed with inner spaces collapsed; null when blank. */
export function cleanName(input: string): string | null {
  const name = input.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH).trim()
  return name || null
}

/** The signed-in account's name, or null when it has none (or nobody is signed in). */
export async function loadName(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const name: unknown = data.session?.user.user_metadata["display_name"]
  return typeof name === "string" ? cleanName(name) : null
}

export async function saveName(name: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ data: { display_name: name } })
  if (error) throw error
}
