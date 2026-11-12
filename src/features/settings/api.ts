import { currentUserId } from "@/lib/auth"
import { METRIC_TIMINGS, type MetricTiming } from "@/lib/config"
import type { TablesUpdate } from "@/lib/database.types"
import { oneOf } from "@/lib/parse"
import { trackSave } from "@/lib/saveStatus"
import { supabase } from "@/lib/supabaseClient"

// Settings CRUD (M3): full config rows (uuid, archived, sort_order) for the
// /settings screen — unlike the active-only config other screens read
// (features/config). Mutations are by row uuid. Archive, never delete:
// historical entry values keep their FK targets, and seeding checks keys
// unfiltered by archived, so an archived default stays archived.

export type MetricRow = {
  id: string
  key: string
  label: string
  groupName: string
  higherIsBetter: boolean
  scale: number
  timing: MetricTiming
  sortOrder: number
  archived: boolean
}
export type HabitRow = {
  id: string
  key: string
  label: string
  sortOrder: number
  archived: boolean
}
export type GoalRow = {
  id: string
  key: string
  label: string
  progress: number
  note: string | null
  sortOrder: number
  archived: boolean
}

// Stable slug for a new row's key, from its label ("Cold shower" -> cold_shower).
function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60)
}

export async function listMetricRows(): Promise<MetricRow[]> {
  const { data, error } = await supabase.from("metrics").select("*").order("sort_order")
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    key: r.key,
    label: r.label,
    groupName: r.group_name,
    higherIsBetter: r.higher_is_better,
    scale: r.scale,
    timing: oneOf(METRIC_TIMINGS, r.timing, "metrics.timing"),
    sortOrder: r.sort_order,
    archived: r.archived,
  }))
}

export async function listHabitRows(): Promise<HabitRow[]> {
  const { data, error } = await supabase.from("habits").select("*").order("sort_order")
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    key: r.key,
    label: r.label,
    sortOrder: r.sort_order,
    archived: r.archived,
  }))
}

export async function listGoalRows(): Promise<GoalRow[]> {
  const { data, error } = await supabase.from("goals").select("*").order("sort_order")
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    key: r.key,
    label: r.label,
    progress: r.progress,
    note: r.note,
    sortOrder: r.sort_order,
    archived: r.archived,
  }))
}

export type ConfigTable = "metrics" | "habits" | "goals" | "retro_areas"

// Columns every config table has. Snake_case rows are assembled here so callers
// stay camelCase; table-specific columns go through updateMetric / updateGoal.
export type ConfigPatch = Partial<{ label: string; sortOrder: number; archived: boolean }>

function commonColumns(patch: ConfigPatch) {
  const row: Pick<TablesUpdate<"metrics">, "label" | "sort_order" | "archived"> = {}
  if (patch.label !== undefined) row.label = patch.label
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder
  if (patch.archived !== undefined) row.archived = patch.archived
  return row
}

export async function updateConfigRow(
  table: ConfigTable,
  id: string,
  patch: ConfigPatch,
): Promise<void> {
  const { error } = await supabase.from(table).update(commonColumns(patch)).eq("id", id)
  if (error) throw error
}

export async function updateMetric(
  id: string,
  patch: ConfigPatch &
    Partial<{ groupName: string; higherIsBetter: boolean; timing: MetricTiming }>,
): Promise<void> {
  const row: TablesUpdate<"metrics"> = commonColumns(patch)
  if (patch.groupName !== undefined) row.group_name = patch.groupName
  if (patch.higherIsBetter !== undefined) row.higher_is_better = patch.higherIsBetter
  // Moves where the slider is asked from now on; recorded values stay put.
  if (patch.timing !== undefined) row.timing = patch.timing
  const { error } = await supabase.from("metrics").update(row).eq("id", id)
  if (error) throw error
}

export async function updateGoal(
  id: string,
  patch: ConfigPatch & Partial<{ progress: number; note: string | null }>,
): Promise<void> {
  const row: TablesUpdate<"goals"> = commonColumns(patch)
  if (patch.progress !== undefined) row.progress = patch.progress
  if (patch.note !== undefined) row.note = patch.note
  const { error } = await supabase.from("goals").update(row).eq("id", id)
  if (error) throw error
}

export async function updateSortOrders(
  table: ConfigTable,
  rows: { id: string; sortOrder: number }[],
): Promise<void> {
  await Promise.all(rows.map((r) => updateConfigRow(table, r.id, { sortOrder: r.sortOrder })))
}

export async function addMetricRow(input: {
  label: string
  groupName: string
  higherIsBetter: boolean
  sortOrder: number
}): Promise<void> {
  const { error } = await supabase.from("metrics").insert({
    key: slugify(input.label),
    label: input.label,
    group_name: input.groupName,
    higher_is_better: input.higherIsBetter,
    scale: 5,
    timing: "evening", // new metrics start in the evening; flip it in the row
    sort_order: input.sortOrder,
  })
  if (error) throw error
}

export async function addHabitRow(label: string, sortOrder: number): Promise<void> {
  const { error } = await supabase
    .from("habits")
    .insert({ key: slugify(label), label, sort_order: sortOrder })
  if (error) throw error
}

export async function addGoalRow(label: string, sortOrder: number): Promise<void> {
  const { error } = await supabase
    .from("goals")
    .insert({ key: slugify(label), label, progress: 0, sort_order: sortOrder })
  if (error) throw error
}

export async function addRetroAreaRow(label: string, sortOrder: number): Promise<void> {
  const { error } = await supabase
    .from("retro_areas")
    .insert({ key: slugify(label), label, sort_order: sortOrder })
  if (error) throw error
}

// --- Morning preferences ------------------------------------------------------
// One `user_settings` row per account, written on the first change. No row
// means the defaults: the app opens on /morning until noon.

export type MorningPrefs = {
  /** Whether `/` opens on /morning until today's morning is set. */
  redirect: boolean
  /** When the morning closes, in minutes after local midnight. */
  closesAt: number
}

export const DEFAULT_MORNING_PREFS: MorningPrefs = { redirect: true, closesAt: 12 * 60 }

export async function loadMorningPrefs(): Promise<MorningPrefs> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("morning_redirect, morning_closes_at")
    .maybeSingle()
  if (error) throw error
  if (!data) return DEFAULT_MORNING_PREFS
  return { redirect: data.morning_redirect, closesAt: data.morning_closes_at }
}

export function saveMorningPrefs(prefs: MorningPrefs): Promise<void> {
  return trackSave(writeMorningPrefs(prefs))
}

async function writeMorningPrefs(prefs: MorningPrefs) {
  // user_id defaults to auth.uid(), and RLS only shows this account's row, so
  // the upsert finds or creates exactly that one.
  const userId = await currentUserId()
  const { error } = await supabase.from("user_settings").upsert({
    user_id: userId,
    morning_redirect: prefs.redirect,
    morning_closes_at: prefs.closesAt,
  })
  if (error) throw error
}
