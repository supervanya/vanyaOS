// Composite wellness: mean of the metrics you set, with symptoms inverted via
// (max - value). On the 0-5 scale that's 5 - value (0 = best symptom day ->
// contributes 5). Mirrors the `entry_wellness_scores` SQL view
// (docs/ARCHITECTURE.md), which averages only saved values, so the live
// client-side score and the AI coach's server-side view agree — this copy
// exists because the slider needs a value before anything is saved.

import type { TrendSeries } from "@/features/trends/api"
import type { Config, Metric } from "@/lib/config"
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
 * with habits or an intention but no slider is present with a null score.
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
  for (const date of series.intentionDates) day(date)
  return new Map(
    [...metricsByDate]
      .toSorted(([a], [b]) => a.localeCompare(b))
      .map(([date, metrics]) => [date, wellness({ metrics }, config)]),
  )
}

/**
 * Days with a morning and no evening yet: an intention or a morning slider, but
 * no evening slider, reflection or lived rating — the same signals that lock
 * the morning (`eveningStarted`). Their wellness, if any, rests on the morning
 * sliders alone, so it's shown as partial rather than beside full days as if
 * it were one. Habit ticks don't count either way: the dashboard takes them
 * all day.
 */
export function morningOnlyDates(series: TrendSeries, metrics: Metric[]): Set<string> {
  const morning = new Set(series.intentionDates)
  const evening = new Set(series.writtenEveningDates)
  for (const m of metrics)
    for (const p of series.metrics[m.id] ?? [])
      (m.timing === "morning" ? morning : evening).add(p.date)
  return new Set([...morning].filter((date) => !evening.has(date)))
}
