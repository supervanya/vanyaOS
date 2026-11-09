// Composite wellness: mean of the metrics you set, with symptoms inverted via
// (max - value). On the 0-5 scale that's 5 - value (0 = best symptom day ->
// contributes 5). Mirrors the `entry_wellness_scores` SQL view
// (docs/ARCHITECTURE.md), which averages only saved values, so the live
// client-side score and the AI coach's server-side view agree — this copy
// exists because the slider needs a value before anything is saved.

import type { TrendSeries } from "@/features/trends/api"
import type { Config } from "@/lib/config"
import type { DayEntry } from "./api"

/** Null until at least one slider is set. */
export function wellness(entry: Pick<DayEntry, "metrics">, config: Config): number | null {
  const vals = config.metrics.flatMap((m) => {
    const v = entry.metrics[m.id]
    if (v === undefined) return []
    return [m.higherIsBetter ? v : m.scale - v]
  })
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

export type WellnessTone = "good" | "ok" | "bad"

/** The band a 0-5 score falls in, as colored on Reflect and its calendar. */
export const wellnessTone = (score: number): WellnessTone =>
  score >= 3.75 ? "good" : score >= 2.5 ? "ok" : "bad"

/**
 * Every logged day's wellness, rebuilt from the Trends history. A day logged
 * with habits but no slider is present with a null score.
 */
export function wellnessByDate(series: TrendSeries, config: Config): Map<string, number | null> {
  const metricsByDate = new Map<string, Record<string, number>>()
  const day = (date: string) => {
    let metrics = metricsByDate.get(date)
    if (!metrics) metricsByDate.set(date, (metrics = {}))
    return metrics
  }
  for (const [id, points] of Object.entries(series.metrics))
    for (const p of points) day(p.date)[id] = p.value
  for (const points of Object.values(series.habits)) for (const p of points) day(p.date)
  return new Map([...metricsByDate].map(([date, metrics]) => [date, wellness({ metrics }, config)]))
}
