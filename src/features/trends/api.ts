import type { LoadedConfig } from "@/features/config/api"
import { supabase } from "@/lib/supabaseClient"
import type { Point } from "./math"

// Per-item daily series for the Trends screen, keyed by metric/habit slug.
// Habit points are 1 (done) or 0 (missed).
export type TrendSeries = {
  firstDate: string | null // earliest entry returned; where "All" starts
  metrics: Record<string, Point[]>
  habits: Record<string, Point[]>
  // The halves of the day that aren't sliders: days with a morning intention,
  // and days whose evening wrote a reflection or a lived rating. Sorted.
  intentionDates: string[]
  writtenEveningDates: string[]
}

// Every logged value, oldest first. Child rows are embedded under their entry,
// so it's one request however long the history — and PostgREST's row cap
// counts entries (one per day), not the far more numerous per-metric child rows.
export async function loadTrendSeries(config: LoadedConfig): Promise<TrendSeries> {
  // Reflections are only checked for being written: their text is fetched by
  // neither request, which keeps the whole-history read small.
  const [{ data, error }, reflected] = await Promise.all([
    supabase
      .from("entries")
      .select(
        "entry_date, intention, intention_lived, entry_metric_values(metric_id, value), entry_habits(habit_id, done)",
      )
      .order("entry_date"),
    supabase.from("entries").select("entry_date").neq("reflection", "").order("entry_date"),
  ])
  if (error) throw error
  if (reflected.error) throw reflected.error

  const metricKeyById = invert(config.metricRowId)
  const habitKeyById = invert(config.habitRowId)
  const reflectedDates = new Set(reflected.data.map((r) => r.entry_date))
  const series: TrendSeries = {
    firstDate: data[0]?.entry_date ?? null,
    metrics: {},
    habits: {},
    intentionDates: [],
    writtenEveningDates: [],
  }
  for (const entry of data) {
    const date = entry.entry_date
    if (entry.intention.trim()) series.intentionDates.push(date)
    if (entry.intention_lived !== null || reflectedDates.has(date))
      series.writtenEveningDates.push(date)
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
