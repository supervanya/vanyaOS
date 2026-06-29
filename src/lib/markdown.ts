// Serializes a day entry to the canonical day-file markdown (frontmatter + body)
// documented in docs/ARCHITECTURE.md. This is BOTH the export-to-notes format and
// the exact shape we'll later commit to the git repo — so there's no rework when
// the GitHub storage layer lands. It's also the clean input you paste into an AI
// to get action items / goal progress.

import type { Config } from './config'
import type { DayEntry, TodoItem } from './storage'

// Composite wellness: mean of metrics, with symptoms inverted via (max - value).
// On the 0-5 scale that's 5 - value (0 = best symptom day -> contributes 5).
export function wellness(entry: DayEntry, config: Config): number {
  const vals = config.metrics.map((m) => {
    const v = entry.metrics[m.id] ?? 0
    return m.higherIsBetter ? v : m.scale - v
  })
  if (!vals.length) return 0
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

const todoYaml = (items: TodoItem[]): string =>
  items.map((t) => `    - { text: ${JSON.stringify(t.text)}, done: ${t.done} }`).join('\n')

export function dayToMarkdown(entry: DayEntry, config: Config): string {
  const lines: string[] = ['---']
  lines.push(`date: ${entry.date}`)
  lines.push(`theme: ${entry.theme}`)
  lines.push(`wellness: ${wellness(entry, config).toFixed(1)}`)

  lines.push('metrics:')
  for (const m of config.metrics) lines.push(`  ${m.id}: ${entry.metrics[m.id] ?? ''}`)

  const doneHabits = config.habits.filter((h) => entry.habits[h.id])
  lines.push(doneHabits.length ? 'habits:' : 'habits: {}')
  for (const h of doneHabits) lines.push(`  ${h.id}: true`)

  lines.push('todos:')
  lines.push(entry.todos.today.length ? '  today:' : '  today: []')
  if (entry.todos.today.length) lines.push(todoYaml(entry.todos.today))
  lines.push(entry.todos.week.length ? '  week:' : '  week: []')
  if (entry.todos.week.length) lines.push(todoYaml(entry.todos.week))

  lines.push('---')
  lines.push('')
  lines.push('## Reflection')
  lines.push(entry.reflection?.trim() || '(no reflection)')
  lines.push('')
  return lines.join('\n')
}

// All entries, newest first — one markdown blob for backup or feeding to an AI.
export function exportAll(entries: DayEntry[], config: Config): string {
  return entries
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((e) => dayToMarkdown(e, config))
    .join('\n\n')
}
