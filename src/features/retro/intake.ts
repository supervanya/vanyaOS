import { loadConfig } from "@/features/config/api"
import { shiftISO, todayISO } from "@/lib/dates"
import { supabase } from "@/lib/supabaseClient"

const FIRST_RUN_WINDOW_DAYS = 60

export async function buildIntakeSignal(sinceISO: string | null): Promise<string> {
  const since = sinceISO ? sinceISO.slice(0, 10) : shiftISO(todayISO(), -FIRST_RUN_WINDOW_DAYS)
  const windowLabel = sinceISO
    ? `since the last retro (${since})`
    : `last ${FIRST_RUN_WINDOW_DAYS} days (first retro for this area)`

  const { data: entries, error } = await supabase
    .from("entries")
    .select("id, entry_date, reflection")
    .gte("entry_date", since)
    .order("entry_date")
  if (error) throw error
  if (!entries?.length) return `(no journal data in the window: ${windowLabel})`

  const ids = entries.map((r) => r.id)
  const config = await loadConfig()
  const [
    { data: values, error: vErr },
    { data: habitRows, error: hErr },
    { data: scores, error: sErr },
  ] = await Promise.all([
    supabase.from("entry_metric_values").select("entry_id, metric_id, value").in("entry_id", ids),
    supabase.from("entry_habits").select("entry_id, habit_id, done").in("entry_id", ids),
    supabase.from("entry_wellness_scores").select("entry_id, wellness").in("entry_id", ids),
  ])
  if (vErr) throw vErr
  if (hErr) throw hErr
  if (sErr) throw sErr

  const lines: string[] = [`Journal signal, ${windowLabel} — ${entries.length} day(s) tracked.`]

  // Per-metric: overall average + trend (first half of the window vs second).
  const half = Math.floor(entries.length / 2)
  const firstIds = new Set(entries.slice(0, half).map((r) => r.id))
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
  lines.push("", "### Metrics (0-5 sliders, averaged over the window)")
  for (const m of config.metrics) {
    const rowId = config.metricRowId[m.id]
    const vals = (values ?? []).filter((v) => v.metric_id === rowId)
    if (!vals.length) continue
    const all = mean(vals.map((v) => v.value))!
    const early = mean(vals.filter((v) => firstIds.has(v.entry_id)).map((v) => v.value))
    const late = mean(vals.filter((v) => !firstIds.has(v.entry_id)).map((v) => v.value))
    let trend = ""
    if (early != null && late != null && Math.abs(late - early) >= 0.4) {
      trend = ` (trending ${late > early ? "up" : "down"}: ${early.toFixed(1)} -> ${late.toFixed(1)})`
    }
    const direction = m.higherIsBetter ? "" : " [0 is best]"
    lines.push(`- ${m.label}${direction}: avg ${all.toFixed(1)}/${m.scale}${trend}`)
  }

  // Days with no slider set have no wellness score (null). Leave them out
  // instead of averaging them in as 0.
  const scored = (scores ?? []).flatMap((x) =>
    x.entry_id !== null && x.wellness !== null
      ? [{ entryId: x.entry_id, wellness: x.wellness }]
      : [],
  )
  const wellnessVals = scored.map((x) => x.wellness)
  if (wellnessVals.length) {
    lines.push(`- Composite wellness: avg ${mean(wellnessVals)!.toFixed(1)}/5`)
  }

  lines.push("", "### Habits (days completed / days tracked)")
  for (const h of config.habits) {
    const rowId = config.habitRowId[h.id]
    const rows = (habitRows ?? []).filter((x) => x.habit_id === rowId)
    if (!rows.length) continue
    lines.push(`- ${h.label}: ${rows.filter((x) => x.done).length}/${rows.length}`)
  }

  const scoreById = new Map(scored.map((x) => [x.entryId, x.wellness]))
  const written = entries.filter((r) => (r.reflection ?? "").trim().length > 0)
  lines.push("", "### Written reflections")
  if (written.length) {
    for (const r of written) {
      const w = scoreById.get(r.id)
      lines.push(
        `- ${r.entry_date}${w != null ? ` (wellness ${w.toFixed(1)}/5)` : ""}: ${r.reflection}`,
      )
    }
    const sliderOnly = entries.length - written.length
    if (sliderOnly > 0)
      lines.push(`
(${sliderOnly} more day(s) had slider data only, included in the averages above)`)
  } else {
    lines.push("(none in this window - all signal is in the numbers above)")
  }

  return lines.join("\n")
}
