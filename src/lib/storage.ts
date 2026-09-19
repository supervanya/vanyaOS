// Settings CRUD — the last of the pre-feature-module store. #75 moves it to
// src/features/settings and deletes this file.

import { supabase } from "./supabaseClient"
import type { TablesUpdate } from "./database.types"

// --- Settings CRUD (M3) ------------------------------------------------------
// Full rows (uuid, archived, sort_order) for the /settings screen. Mutations
// are by row uuid. Archive, never delete — historical entry values keep their
// FK targets. seedMissingDefaults checks keys UNFILTERED by archived, so an
// archived default stays archived instead of resurrecting on next load.

export type MetricRow = {
  id: string
  key: string
  label: string
  groupName: string
  higherIsBetter: boolean
  scale: number
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
export function slugify(label: string): string {
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
  patch: ConfigPatch & Partial<{ groupName: string; higherIsBetter: boolean }>,
): Promise<void> {
  const row: TablesUpdate<"metrics"> = commonColumns(patch)
  if (patch.groupName !== undefined) row.group_name = patch.groupName
  if (patch.higherIsBetter !== undefined) row.higher_is_better = patch.higherIsBetter
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
