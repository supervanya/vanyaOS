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
  todos: { tomorrow: TodoItem[]; week: TodoItem[] }
  reflection: string
  updatedAt: string
}

const DAY_PREFIX = 'vanyaos:day:'
const dayKey = (date: string) => `${DAY_PREFIX}${date}`
const hasWindow = () => typeof window !== 'undefined'

export function todayISO(): string {
  const d = new Date()
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

// Shift a YYYY-MM-DD by whole days (noon anchor avoids DST/tz edge cases).
export function shiftISO(dateISO: string, deltaDays: number): string {
  const d = new Date(dateISO + "T12:00:00")
  d.setDate(d.getDate() + deltaDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

// An evening reflection done in the early hours after midnight is really about
// the previous day, so before `cutoffHour` (local) we default to yesterday.
export function defaultEntryDate(cutoffHour = 4): string {
  return new Date().getHours() < cutoffHour ? shiftISO(todayISO(), -1) : todayISO()
}

// Config lives in code (config.ts). There's no in-app settings UI, so reading
// it straight from DEFAULT_CONFIG means edits to config.ts show up immediately
// (no stale localStorage copy shadowing your changes).
export function loadConfig(): Config {
  return DEFAULT_CONFIG
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

// Back-compat: an earlier build keyed tomorrow's todos as `today`.
function normalizeDay(e: DayEntry): DayEntry {
  const todos = (e.todos ?? {}) as { tomorrow?: TodoItem[]; today?: TodoItem[]; week?: TodoItem[] }
  return {
    ...e,
    todos: {
      tomorrow: todos.tomorrow ?? todos.today ?? [],
      week: todos.week ?? [],
    },
  }
}

export function loadDay(date: string): DayEntry | null {
  if (!hasWindow()) return null
  const raw = localStorage.getItem(dayKey(date))
  if (!raw) return null
  try {
    return normalizeDay(JSON.parse(raw) as DayEntry)
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
      tomorrow: prev ? carryForward(prev.todos?.tomorrow) : [],
      week: prev ? carryForward(prev.todos?.week) : [],
    },
    reflection: '',
    updatedAt: new Date().toISOString(),
  }
}

export function loadOrInitDay(date: string, config: Config): DayEntry {
  return loadDay(date) ?? newEntry(date, config)
}
