// The shapes of an account's tracked metrics, habits and goals (Postgres rows,
// edited in Settings), plus the active life-theme.

/** Which half of the day asks for a metric (`metrics.timing`, ARCHITECTURE.md "One day, two halves"). */
export const METRIC_TIMINGS = ["morning", "evening"] as const
export type MetricTiming = (typeof METRIC_TIMINGS)[number]

export type Metric = {
  id: string
  label: string
  group: string
  higherIsBetter: boolean // symptoms are false -> inverted in the wellness score
  scale: number // max value; sliders run 0..scale (we use 0-5)
  timing: MetricTiming // where the slider is asked; wellness counts both halves
}

/** The metrics asked in one half of the day, in their configured order. */
export const metricsAt = (metrics: Metric[], timing: MetricTiming): Metric[] =>
  metrics.filter((m) => m.timing === timing)

export type MetricGroup = { group: string; metrics: Metric[] }

/** Metrics bucketed by `group`, with groups in order of first appearance. */
export function groupMetrics(metrics: Metric[]): MetricGroup[] {
  const groups = new Map<string, Metric[]>()
  for (const m of metrics) {
    const members = groups.get(m.group)
    if (members) members.push(m)
    else groups.set(m.group, [m])
  }
  return [...groups].map(([group, members]) => ({ group, metrics: members }))
}

export type Habit = { id: string; label: string }

export type Goal = { id: string; label: string; progress: number; note?: string }

export type Config = {
  activeTheme: string
  themes: string[]
  metrics: Metric[]
  habits: Habit[]
  goals: Goal[]
}

// Theme management is deferred (REQUIREMENTS.md): the theme is still a code
// default, stamped onto each entry.
export const THEME_DEFAULTS = {
  activeTheme: "recovery",
  themes: ["recovery", "deep-work"],
} satisfies Pick<Config, "activeTheme" | "themes">
