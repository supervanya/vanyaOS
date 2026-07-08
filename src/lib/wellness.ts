// Composite wellness: mean of metrics, with symptoms inverted via (max - value).
// On the 0-5 scale that's 5 - value (0 = best symptom day -> contributes 5).
// Mirrors the `entry_wellness_scores` SQL view (docs/ARCHITECTURE.md) so the
// live client-side score and the AI coach's server-side view agree — this
// copy exists because the slider needs a value before anything is saved.

import type { Config } from './config'
import type { DayEntry } from './storage'

export function wellness(entry: DayEntry, config: Config): number {
  const vals = config.metrics.map((m) => {
    const v = entry.metrics[m.id] ?? 0
    return m.higherIsBetter ? v : m.scale - v
  })
  if (!vals.length) return 0
  return vals.reduce((a, b) => a + b, 0) / vals.length
}
