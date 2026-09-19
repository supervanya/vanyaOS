import type { LoadedConfig } from "@/features/config/api"
import { supabase } from "@/lib/supabaseClient"
import type { Point } from "./math"

// Per-item daily series for the Trends screen, keyed by metric/habit slug.
// Habit points are 1 (done) or 0 (missed).
export type TrendSeries = {
  firstDate: string | null // earliest entry returned; where "All" starts
  metrics: Record<string, Point[]>
  habits: Record<string, Point[]>
}

// Every logged value, oldest first. Child rows are embedded under their entry,
// so it's one request however long the history — and PostgREST's row cap
// counts entries (one per day), not the far more numerous per-metric child rows.
export async function loadTrendSeries(config: LoadedConfig): Promise<TrendSeries> {
  const { data, error } = await supabase
    .from("entries")
    .select("entry_date, entry_metric_values(metric_id, value), entry_habits(habit_id, done)")
    .order("entry_date")
  if (error) throw error

  const metricKeyById = invert(config.metricRowId)
  const habitKeyById = invert(config.habitRowId)
  const series: TrendSeries = { firstDate: data?.[0]?.entry_date ?? null, metrics: {}, habits: {} }
  for (const entry of data ?? []) {
    const date = entry.entry_date
    for (const v of entry.entry_metric_values) {
      append(series.metrics, metricKeyById[v.metric_id], { date, value: v.value })
    }
    for (const h of entry.entry_habits) {
      append(series.habits, habitKeyById[h.habit_id], { date, value: h.done ? 1 : 0 })
    }
  }
  return series
}

const invert = (map: Record<string, string>) =>
  Object.fromEntries(Object.entries(map).map(([key, value]) => [value, key]))

// Archived items have no slug in `config`, so their rows are skipped.
function append(bySlug: Record<string, Point[]>, slug: string | undefined, point: Point) {
  if (slug) (bySlug[slug] ??= []).push(point)
}
