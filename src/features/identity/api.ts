import { supabase } from "@/lib/supabaseClient"

// The account's name lives in its auth metadata, not a table: the stored
// session already carries it, so reading it costs no request and no migration.

/** The app's name until an account picks one, and for signed-out visitors. */
const DEFAULT_APP_NAME = "MyOS"

/** Longest name the form accepts. iOS cuts Home Screen labels at about 12 characters. */
export const MAX_NAME_LENGTH = 20

/** "Vanya" → "VanyaOS"; no name yet → the default. */
export function appNameFor(name: string | null): string {
  return name ? `${name}OS` : DEFAULT_APP_NAME
}

/** The name as typed, trimmed with inner spaces collapsed; null when blank. */
export function cleanName(input: string): string | null {
  return input.trim().replace(/\s+/g, " ") || null
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
