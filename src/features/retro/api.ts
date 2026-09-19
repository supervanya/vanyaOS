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

export type RetroVersion = {
  id: string
  docMd: string
  aiSummary: string | null
  model: string | null
  createdAt: string
}

export async function latestRetro(areaId: string): Promise<RetroVersion | null> {
  const { data, error } = await supabase
    .from("retros")
    .select("id, doc_md, ai_summary, model, created_at")
    .eq("area_id", areaId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    id: data.id,
    docMd: data.doc_md,
    aiSummary: data.ai_summary,
    model: data.model,
    createdAt: data.created_at,
  }
}

// The intake cutoff for a session: when the coach last actually ran for this
// area. Manual doc edits in between must not swallow the reflections that
// happened before them. Null = no coach run yet (intake scans everything).
export async function latestCoachRunAt(areaId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("retros")
    .select("created_at")
    .eq("area_id", areaId)
    .not("model", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data?.created_at ?? null
}

// Every save is a NEW version — the doc history is the point.
export async function saveRetroVersion(
  areaId: string,
  docMd: string,
  aiSummary: string | null,
  model: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("retros")
    .insert({ area_id: areaId, doc_md: docMd, ai_summary: aiSummary, model })
  if (error) throw error
}

// Intake for a retro session: EVERYTHING the journal captured in the window —
// per-metric slider values (averaged, with trend), habit completion, wellness,
// and any written reflections. Slider-only days are first-class signal: most
// entries have no text, and the coach must still see the numbers.
