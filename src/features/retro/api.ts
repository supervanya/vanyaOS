import { currentUserId } from "@/lib/auth"
import { supabase } from "@/lib/supabaseClient"

export type RetroArea = {
  id: string
  key: string
  label: string
  sortOrder: number
  archived: boolean
}

const RETRO_AREA_DEFAULTS = [
  { key: "finances", label: "Finances" },
  { key: "health", label: "Health" },
  { key: "exercise", label: "Exercise" },
  { key: "work", label: "Work" },
]

// Same seeding contract as config defaults: insert missing keys only, checked
// UNFILTERED by archived so an archived default stays archived.
export async function listRetroAreas(): Promise<RetroArea[]> {
  const userId = await currentUserId()
  const { data: existing, error } = await supabase
    .from("retro_areas")
    .select("*")
    .order("sort_order")
  if (error) throw error
  const have = new Set((existing ?? []).map((r) => r.key))
  const missing = RETRO_AREA_DEFAULTS.filter((d) => !have.has(d.key)).map((d, i) => ({
    user_id: userId,
    key: d.key,
    label: d.label,
    sort_order: (existing?.length ?? 0) + i,
  }))
  let rows = existing ?? []
  if (missing.length) {
    const { data: inserted, error: insErr } = await supabase
      .from("retro_areas")
      .insert(missing)
      .select("*")
    if (insErr) throw insErr
    rows = [...rows, ...(inserted ?? [])]
  }
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    label: r.label,
    sortOrder: r.sort_order,
    archived: r.archived,
  }))
}

// Latest COACH RUN per area (model is null for manual seeds/edits — those
// must not reset the due clock or the intake cutoff; a retrospective is a
// session, not a save).
export async function latestRetroDates(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("retros")
    .select("area_id, created_at")
    .not("model", "is", null)
    .order("created_at", { ascending: false })
  if (error) throw error
  const out: Record<string, string> = {}
  for (const r of data ?? []) {
    if (!(r.area_id in out)) out[r.area_id] = r.created_at
  }
  return out
}

const DUE_AFTER_DAYS = 30
export function isRetroDue(lastRunISO: string | undefined): boolean {
  if (!lastRunISO) return false // never-seeded areas show "start", not "due"
  return Date.now() - new Date(lastRunISO).getTime() > DUE_AFTER_DAYS * 86400_000
}
