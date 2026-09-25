// Day entries (ADR-002 / ARCHITECTURE.md): one `entries` row per day with its
// metric values and habit checks in child tables, plus a local draft buffer
// (localStorage) so a dropped connection mid-edit can't lose an entry —
// Postgres is always the source of truth once a sync succeeds; the draft is a
// transient write-ahead copy, not a competing store.

import type { LoadedConfig } from "@/features/config/api"
import { currentUserId } from "@/lib/auth"
import { isRecord } from "@/lib/parse"
import { supabase } from "@/lib/supabaseClient"

export type DayEntry = {
  date: string // YYYY-MM-DD
  theme: string
  metrics: Record<string, number> // only sliders you've set; untouched ones are absent
  habits: Record<string, boolean>
  reflection: string
  updatedAt: string
}

export async function listDayDates(): Promise<string[]> {
  const userId = await currentUserId()
  const { data, error } = await supabase
    .from("entries")
    .select("entry_date")
    .eq("user_id", userId)
    .order("entry_date")
  if (error) throw error
  return data.map((r) => r.entry_date)
}

// Null only when the day has no row. A failed read throws instead: taken for
// an empty day, it would open a blank editor whose first autosave overwrites
// the saved entry.
async function fetchEntryRow(userId: string, date: string) {
  const { data, error } = await supabase
    .from("entries")
    .select("*")
    .eq("user_id", userId)
    .eq("entry_date", date)
    .maybeSingle()
  if (error) throw error
  return data
}

// Hydrates an `entries` row into the same DayEntry shape the UI has always
// used, keyed by metric/habit *slug* (not the Postgres row uuid).
async function hydrateEntry(
  row: {
    id: string
    entry_date: string
    theme: string | null
    reflection: string | null
    updated_at: string
  },
  config: LoadedConfig,
): Promise<DayEntry> {
  const [metricRes, habitRes] = await Promise.all([
    supabase.from("entry_metric_values").select("metric_id, value").eq("entry_id", row.id),
    supabase.from("entry_habits").select("habit_id, done").eq("entry_id", row.id),
  ])
  if (metricRes.error) throw metricRes.error
  if (habitRes.error) throw habitRes.error

  const metricKeyById = Object.fromEntries(
    Object.entries(config.metricRowId).map(([key, id]) => [id, key]),
  )
  const habitKeyById = Object.fromEntries(
    Object.entries(config.habitRowId).map(([key, id]) => [id, key]),
  )

  const metrics: Record<string, number> = {}
  for (const v of metricRes.data) {
    const key = metricKeyById[v.metric_id]
    if (key) metrics[key] = v.value
  }
  const habits: Record<string, boolean> = {}
  for (const h of habitRes.data) {
    const key = habitKeyById[h.habit_id]
    if (key) habits[key] = h.done
  }

  return {
    date: row.entry_date,
    theme: row.theme ?? config.activeTheme,
    metrics,
    habits,
    reflection: row.reflection ?? "",
    updatedAt: row.updated_at,
  }
}

export async function loadDay(date: string, config: LoadedConfig): Promise<DayEntry | null> {
  const userId = await currentUserId()
  const row = await fetchEntryRow(userId, date)
  return row ? hydrateEntry(row, config) : null
}

// A fresh entry for `date`. (Todos no longer roll forward — the living task
// list simply persists; see the tasks section below.)
async function newEntry(date: string, config: LoadedConfig): Promise<DayEntry> {
  return {
    date,
    theme: config.activeTheme,
    // No slider starts with a value: only the ones you set are saved, so a
    // habits-only day doesn't record a fake 0 on every metric.
    metrics: {},
    habits: Object.fromEntries(config.habits.map((h) => [h.id, false])),
    reflection: "",
    updatedAt: new Date().toISOString(),
  }
}

// A day as the page should show it. `unsynced` means it came from a local
// draft that never reached Postgres, so it still needs saving.
export type LoadedDay = { entry: DayEntry; unsynced: boolean }

// Reconciles the remote entry with any local draft, preferring whichever is
// freshest by `updatedAt` — protects an in-progress edit from a dropped sync.
export async function loadOrInitDay(date: string, config: LoadedConfig): Promise<LoadedDay> {
  const [remote, draft] = await Promise.all([
    loadDay(date, config),
    Promise.resolve(loadDraft(date)),
  ])
  if (draft && (!remote || draft.updatedAt > remote.updatedAt))
    return { entry: draft, unsynced: true }
  return { entry: remote ?? (await newEntry(date, config)), unsynced: false }
}

export async function saveDay(entry: DayEntry, config: LoadedConfig): Promise<void> {
  const userId = await currentUserId()

  const { data: entryRow, error } = await supabase
    .from("entries")
    .upsert(
      { user_id: userId, entry_date: entry.date, theme: entry.theme, reflection: entry.reflection },
      { onConflict: "user_id,entry_date" },
    )
    .select()
    .single()
  if (error || !entryRow) throw error ?? new Error("Failed to save entry")

  const entryId = entryRow.id

  // Values for archived or unknown metrics have no row id and are skipped.
  const metricRows = Object.entries(entry.metrics).flatMap(([key, value]) => {
    const metricId = config.metricRowId[key]
    return metricId ? [{ entry_id: entryId, metric_id: metricId, value }] : []
  })
  if (metricRows.length) {
    const { error: mErr } = await supabase
      .from("entry_metric_values")
      .upsert(metricRows, { onConflict: "entry_id,metric_id" })
    if (mErr) throw mErr
  }

  const habitRows = Object.entries(entry.habits).flatMap(([key, done]) => {
    const habitId = config.habitRowId[key]
    return habitId ? [{ entry_id: entryId, habit_id: habitId, done }] : []
  })
  if (habitRows.length) {
    const { error: hErr } = await supabase
      .from("entry_habits")
      .upsert(habitRows, { onConflict: "entry_id,habit_id" })
    if (hErr) throw hErr
  }
}

// --- Local draft buffer -----------------------------------------------------
// Write-ahead cache only: instant on every keystroke, cleared once a Postgres
// sync succeeds. Never read as a source of truth on its own — only used to
// win a freshness comparison against the remote row in loadOrInitDay.

const DRAFT_PREFIX = "vanyaos:draft:"
const draftKey = (date: string) => `${DRAFT_PREFIX}${date}`
const hasWindow = () => typeof window !== "undefined"

export function saveDraft(entry: DayEntry): void {
  if (hasWindow()) localStorage.setItem(draftKey(entry.date), JSON.stringify(entry))
}

export function loadDraft(date: string): DayEntry | null {
  if (!hasWindow()) return null
  const raw = localStorage.getItem(draftKey(date))
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isDayEntry(parsed) ? parsed : null
  } catch {
    return null
  }
}

// Drafts come back from localStorage, which may hold an older shape — check
// before trusting it, and fall back to the remote entry if it doesn't match.
function isDayEntry(value: unknown): value is DayEntry {
  return (
    isRecord(value) &&
    typeof value.date === "string" &&
    typeof value.theme === "string" &&
    typeof value.reflection === "string" &&
    typeof value.updatedAt === "string" &&
    isRecord(value.metrics) &&
    Object.values(value.metrics).every((x) => typeof x === "number") &&
    isRecord(value.habits) &&
    Object.values(value.habits).every((x) => typeof x === "boolean")
  )
}

export function clearDraft(date: string): void {
  if (hasWindow()) localStorage.removeItem(draftKey(date))
}
