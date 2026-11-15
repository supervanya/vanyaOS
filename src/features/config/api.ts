// The account's tracked metrics, habits and goals (ADR-002 / ARCHITECTURE.md):
// Postgres rows scoped by RLS. A new account starts with none.

import {
  METRIC_TIMINGS,
  THEME_DEFAULTS,
  type Config,
  type Goal,
  type Habit,
  type Metric,
} from "@/lib/config"
import { oneOf } from "@/lib/parse"
import { supabase } from "@/lib/supabaseClient"

// Config rows keyed by their stable slug (`key` in Postgres, `id` in the UI
// shape) plus the slug -> row-uuid maps needed to write child tables.
export type LoadedConfig = Config & {
  metricRowId: Record<string, string>
  habitRowId: Record<string, string>
}

export async function loadConfig(): Promise<LoadedConfig> {
  // Archived rows are invisible to the app but keep their uuid, so historical
  // entry values still join (and old wellness scores still include them).
  const [metricRes, habitRes, goalRes] = await Promise.all([
    supabase.from("metrics").select("*").eq("archived", false).order("sort_order"),
    supabase.from("habits").select("*").eq("archived", false).order("sort_order"),
    supabase.from("goals").select("*").eq("archived", false).order("sort_order"),
  ])
  if (metricRes.error) throw metricRes.error
  if (habitRes.error) throw habitRes.error
  if (goalRes.error) throw goalRes.error

  const metrics: Metric[] = metricRes.data.map((r) => ({
    id: r.key,
    label: r.label,
    group: r.group_name,
    higherIsBetter: r.higher_is_better,
    scale: r.scale,
    timing: oneOf(METRIC_TIMINGS, r.timing, "metrics.timing"),
  }))
  const habits: Habit[] = habitRes.data.map((r) => ({ id: r.key, label: r.label }))
  const goals: Goal[] = goalRes.data.map((r) => ({
    id: r.key,
    label: r.label,
    progress: r.progress,
    ...(r.note !== null && { note: r.note }),
  }))

  return {
    ...THEME_DEFAULTS,
    metrics,
    habits,
    goals,
    metricRowId: Object.fromEntries(metricRes.data.map((r) => [r.key, r.id])),
    habitRowId: Object.fromEntries(habitRes.data.map((r) => [r.key, r.id])),
  }
}
