import { metricsAt, type Metric } from "@/lib/config"
import type { DayEntry } from "./api"

/**
 * Whether the day's evening is started, which locks its morning half
 * (ARCHITECTURE.md "One day, two halves"). The same three conditions
 * `save_morning` checks in SQL: a reflection that isn't blank (`btrim`, so only
 * spaces count as blank), a lived rating, or a value on any evening-timed
 * metric. Habit checks don't count — the dashboard writes them all day.
 *
 * `metrics` is the configured list, so a value on an archived evening metric
 * (dropped when a day is loaded) is missed here; `save_morning` still refuses.
 */
export function eveningStarted(
  day: Pick<DayEntry, "reflection" | "intentionLived" | "metrics">,
  metrics: Metric[],
): boolean {
  return (
    /[^ ]/.test(day.reflection) ||
    day.intentionLived !== null ||
    metricsAt(metrics, "evening").some((m) => day.metrics[m.id] !== undefined)
  )
}
