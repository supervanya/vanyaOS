// The journal signal a retro's intake carries: what the coach reads about the
// days since the area's last run. Fetching (Supabase) and formatting (pure, so
// it's unit-tested) are split: `buildIntakeSignal` does both.

import { loadConfig, type LoadedConfig } from "@/features/config/api"
import { INTENTION_LIVED, type IntentionLived } from "@/features/entries/api"
import { shiftISO, todayISO } from "@/lib/dates"
import { oneOf } from "@/lib/parse"
import { supabase } from "@/lib/supabaseClient"

const FIRST_RUN_WINDOW_DAYS = 60

export type IntakeWindow = { since: string; label: string }

/** From the last coach run, or the recent past on an area's first retro. */
export function intakeWindow(sinceISO: string | null, today: string): IntakeWindow {
  return sinceISO
    ? { since: sinceISO.slice(0, 10), label: `since the last retro (${sinceISO.slice(0, 10)})` }
    : {
        since: shiftISO(today, -FIRST_RUN_WINDOW_DAYS),
        label: `last ${FIRST_RUN_WINDOW_DAYS} days (first retro for this area)`,
      }
}

/** One `entries` row in the window: both halves of the day. */
export type IntakeDay = {
  id: string
  date: string // YYYY-MM-DD
  reflection: string
  intention: string
  lived: IntentionLived | null
}

/** Everything the signal is written from, as fetched for the window. */
export type IntakeData = {
  days: IntakeDay[] // oldest first
  values: { entryId: string; metricId: string; value: number }[] // metric row uuids
  habits: { entryId: string; habitId: string; done: boolean }[] // habit row uuids
  wellness: { entryId: string; wellness: number }[] // days with no score are absent
}

type IntakeConfig = Pick<LoadedConfig, "metrics" | "habits" | "metricRowId" | "habitRowId">

export async function buildIntakeSignal(sinceISO: string | null): Promise<string> {
  const window = intakeWindow(sinceISO, todayISO())
  const days = await fetchDays(window.since)
  if (!days.length) return formatIntakeSignal(window.label, emptyData, emptyConfig)
  const [config, data] = await Promise.all([loadConfig(), fetchChildRows(days)])
  return formatIntakeSignal(window.label, data, config)
}

const emptyData: IntakeData = { days: [], values: [], habits: [], wellness: [] }
const emptyConfig: IntakeConfig = { metrics: [], habits: [], metricRowId: {}, habitRowId: {} }

async function fetchDays(since: string): Promise<IntakeDay[]> {
  const { data, error } = await supabase
    .from("entries")
    .select("id, entry_date, reflection, intention, intention_lived")
    .gte("entry_date", since)
    .order("entry_date")
  if (error) throw error
  return data.map((r) => ({
    id: r.id,
    date: r.entry_date,
    reflection: r.reflection ?? "",
    intention: r.intention,
    lived:
      r.intention_lived === null
        ? null
        : oneOf(INTENTION_LIVED, r.intention_lived, "entries.intention_lived"),
  }))
}

async function fetchChildRows(days: IntakeDay[]): Promise<IntakeData> {
  const ids = days.map((d) => d.id)
  const [values, habits, scores] = await Promise.all([
    supabase.from("entry_metric_values").select("entry_id, metric_id, value").in("entry_id", ids),
    supabase.from("entry_habits").select("entry_id, habit_id, done").in("entry_id", ids),
    supabase.from("entry_wellness_scores").select("entry_id, wellness").in("entry_id", ids),
  ])
  if (values.error) throw values.error
  if (habits.error) throw habits.error
  if (scores.error) throw scores.error
  return {
    days,
    values: values.data.map((v) => ({
      entryId: v.entry_id,
      metricId: v.metric_id,
      value: v.value,
    })),
    habits: habits.data.map((h) => ({ entryId: h.entry_id, habitId: h.habit_id, done: h.done })),
    // Days with no slider set have no wellness score (null). Leave them out
    // instead of averaging them in as 0.
    wellness: scores.data.flatMap((x) =>
      x.entry_id !== null && x.wellness !== null
        ? [{ entryId: x.entry_id, wellness: x.wellness }]
        : [],
    ),
  }
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

/**
 * The signal as the coach reads it: numbers first (metrics, habits), then the
 * mornings' intentions and how they were lived, then the written reflections.
 * Every `entries` row is a tracked day, a morning with no evening included.
 */
export function formatIntakeSignal(
  windowLabel: string,
  data: IntakeData,
  config: IntakeConfig,
): string {
  const { days } = data
  if (!days.length) return `(no journal data in the window: ${windowLabel})`

  const lines: string[] = [`Journal signal, ${windowLabel} — ${days.length} day(s) tracked.`]

  // Per-metric: overall average + trend (first half of the window vs second).
  const half = Math.floor(days.length / 2)
  const firstIds = new Set(days.slice(0, half).map((d) => d.id))
  lines.push("", "### Metrics (0-5 sliders, averaged over the window)")
  for (const m of config.metrics) {
    const rowId = config.metricRowId[m.id]
    const vals = data.values.filter((v) => v.metricId === rowId)
    const all = mean(vals.map((v) => v.value))
    if (all === null) continue
    const early = mean(vals.filter((v) => firstIds.has(v.entryId)).map((v) => v.value))
    const late = mean(vals.filter((v) => !firstIds.has(v.entryId)).map((v) => v.value))
    let trend = ""
    if (early != null && late != null && Math.abs(late - early) >= 0.4) {
      trend = ` (trending ${late > early ? "up" : "down"}: ${early.toFixed(1)} -> ${late.toFixed(1)})`
    }
    const timing = m.timing === "morning" ? " [morning]" : ""
    const direction = m.higherIsBetter ? "" : " [0 is best]"
    lines.push(`- ${m.label}${timing}${direction}: avg ${all.toFixed(1)}/${m.scale}${trend}`)
  }

  const wellnessAvg = mean(data.wellness.map((x) => x.wellness))
  if (wellnessAvg !== null) lines.push(`- Composite wellness: avg ${wellnessAvg.toFixed(1)}/5`)

  lines.push("", "### Habits (days completed / days tracked)")
  for (const h of config.habits) {
    const rowId = config.habitRowId[h.id]
    const rows = data.habits.filter((x) => x.habitId === rowId)
    if (!rows.length) continue
    lines.push(`- ${h.label}: ${rows.filter((x) => x.done).length}/${rows.length}`)
  }

  lines.push(...intentionLines(days))

  const scoreById = new Map(data.wellness.map((x) => [x.entryId, x.wellness]))
  const written = days.filter((d) => d.reflection.trim().length > 0)
  lines.push("", "### Written reflections")
  if (written.length) {
    for (const d of written) {
      const w = scoreById.get(d.id)
      lines.push(`- ${d.date}${w != null ? ` (wellness ${w.toFixed(1)}/5)` : ""}: ${d.reflection}`)
    }
    const unwritten = days.length - written.length
    if (unwritten > 0)
      lines.push(
        "",
        `(${unwritten} more day(s) had no written reflection; their sliders, habits and intentions are in the sections above)`,
      )
  } else {
    lines.push("(none in this window - all signal is in the sections above)")
  }

  return lines.join("\n")
}

// Each morning's intention with the evening's verdict on it, then the tally.
function intentionLines(days: IntakeDay[]): string[] {
  const withIntention = days.flatMap((d) => {
    const text = d.intention.trim().replace(/\s+/g, " ")
    return text ? [{ ...d, text }] : []
  })
  const lines = ["", "### Morning intentions"]
  if (!withIntention.length) {
    lines.push("(none in this window - no morning intention was written)")
    return lines
  }
  lines.push(
    `(each morning's stated intention; "lived" is the evening's answer to "did I live it?" - no tag means it wasn't rated)`,
  )
  for (const d of withIntention) {
    const lived = d.lived ? ` [lived: ${d.lived}]` : ""
    lines.push(`- ${d.date}${lived}: ${d.text}`)
  }
  const count = (lived: IntentionLived | null) =>
    withIntention.filter((d) => d.lived === lived).length
  lines.push(
    "",
    `Lived: ${count("yes")} yes / ${count("partly")} partly / ${count("no")} no / ${count(null)} unrated (${withIntention.length} day(s) with an intention)`,
  )
  return lines
}
