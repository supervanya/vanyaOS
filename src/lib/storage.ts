// localStorage-backed store. This is the ONLY persistence in the prototype phase,
// so the markdown export (see markdown.ts) is the real backup. Everything here is
// deliberately behind small functions so the storage layer can later be swapped
// for the GitHub Contents API (see docs/adr/ADR-001) without touching the UI.

import { DEFAULT_CONFIG, type Config } from './config'

export type TodoItem = { text: string; done: boolean }

export type DayEntry = {
  date: string // YYYY-MM-DD
  theme: string
  metrics: Record<string, number>
  habits: Record<string, boolean>
  todos: { today: TodoItem[]; week: TodoItem[] }
  reflection: string
  updatedAt: string
}

const CONFIG_KEY = 'vanyaos:config'
const DAY_PREFIX = 'vanyaos:day:'
const dayKey = (date: string) => `${DAY_PREFIX}${date}`
const hasWindow = () => typeof window !== 'undefined'

export function todayISO(): string {
  const d = new Date()
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

export function loadConfig(): Config {
  if (!hasWindow()) return DEFAULT_CONFIG
  const raw = localStorage.getItem(CONFIG_KEY)
  if (!raw) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(DEFAULT_CONFIG))
    return DEFAULT_CONFIG
  }
  try {
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<Config>) }
  } catch {
    return DEFAULT_CONFIG
  }
}

export function saveConfig(c: Config): void {
  if (hasWindow()) localStorage.setItem(CONFIG_KEY, JSON.stringify(c))
}

export function listDayDates(): string[] {
  if (!hasWindow()) return []
  const dates: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(DAY_PREFIX)) dates.push(k.slice(DAY_PREFIX.length))
  }
  return dates.sort() // ascending
}

export function loadDay(date: string): DayEntry | null {
  if (!hasWindow()) return null
  const raw = localStorage.getItem(dayKey(date))
  if (!raw) return null
  try {
    return JSON.parse(raw) as DayEntry
  } catch {
    return null
  }
}

export function saveDay(entry: DayEntry): void {
  if (hasWindow()) localStorage.setItem(dayKey(entry.date), JSON.stringify(entry))
}

export function loadAllDays(): DayEntry[] {
  return listDayDates()
    .map(loadDay)
    .filter((d): d is DayEntry => d !== null)
}

const carryForward = (items: TodoItem[] = []): TodoItem[] =>
  items.filter((t) => !t.done).map((t) => ({ text: t.text, done: false }))

// A fresh entry for `date`. Unfinished todos roll forward from the most recent
// prior day (see docs/ARCHITECTURE.md — "most recent prior day", not strictly
// yesterday, so skipped days don't drop pending items).
export function newEntry(date: string, config: Config): DayEntry {
  const priors = listDayDates().filter((d) => d < date)
  const prev = priors.length ? loadDay(priors[priors.length - 1]) : null
  return {
    date,
    theme: config.activeTheme,
    metrics: Object.fromEntries(config.metrics.map((m) => [m.id, Math.ceil(m.scale / 2)])),
    habits: Object.fromEntries(config.habits.map((h) => [h.id, false])),
    todos: {
      today: prev ? carryForward(prev.todos?.today) : [],
      week: prev ? carryForward(prev.todos?.week) : [],
    },
    reflection: '',
    updatedAt: new Date().toISOString(),
  }
}

export function loadOrInitDay(date: string, config: Config): DayEntry {
  return loadDay(date) ?? newEntry(date, config)
}
