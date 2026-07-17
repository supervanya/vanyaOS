// Supabase-backed store (ADR-002 / ARCHITECTURE.md). Config (metrics/habits/
// goals) and day entries live in Postgres, scoped to the logged-in account
// via RLS. A local draft buffer (localStorage) still exists purely so a
// dropped connection mid-edit can't lose an entry — Postgres is always the
// source of truth once a sync succeeds; the draft is a transient write-ahead
// copy, not a competing store.

import { supabase } from './supabaseClient'
import { DEFAULT_CONFIG, type Config, type Metric, type Habit, type Goal } from './config'

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

// Config rows keyed by their stable slug (`key` in Postgres, `id` in the UI
// shape) plus the slug -> row-uuid maps needed to write child tables.
export type LoadedConfig = Config & {
  metricRowId: Record<string, string>
  habitRowId: Record<string, string>
}

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

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Not authenticated')
  return data.user.id
}

// Seed any config.ts defaults this account doesn't have yet — first login gets
// everything, and a default added later (e.g. a new metric) reaches existing
// accounts on their next load. Existing rows are never touched, so DB-side
// edits to labels/ordering survive.
async function seedMissingDefaults(userId: string): Promise<void> {
  const [{ data: metricKeys }, { data: habitKeys }, { data: goalKeys }] = await Promise.all([
    supabase.from('metrics').select('key'),
    supabase.from('habits').select('key'),
    supabase.from('goals').select('key'),
  ])
  const has = (rows: { key: string }[] | null) => new Set((rows ?? []).map((r) => r.key))
  const [metricSet, habitSet, goalSet] = [has(metricKeys), has(habitKeys), has(goalKeys)]

  const missingMetrics = DEFAULT_CONFIG.metrics
    .map((m, i) => ({
      user_id: userId,
      key: m.id,
      label: m.label,
      group_name: m.group,
      higher_is_better: m.higherIsBetter,
      scale: m.scale,
      sort_order: i,
    }))
    .filter((r) => !metricSet.has(r.key))
  const missingHabits = DEFAULT_CONFIG.habits
    .map((h, i) => ({ user_id: userId, key: h.id, label: h.label, sort_order: i }))
    .filter((r) => !habitSet.has(r.key))
  const missingGoals = DEFAULT_CONFIG.goals
    .map((g, i) => ({
      user_id: userId,
      key: g.id,
      label: g.label,
      progress: g.progress,
      note: g.note ?? null,
      sort_order: i,
    }))
    .filter((r) => !goalSet.has(r.key))

  await Promise.all([
    missingMetrics.length ? supabase.from('metrics').insert(missingMetrics) : null,
    missingHabits.length ? supabase.from('habits').insert(missingHabits) : null,
    missingGoals.length ? supabase.from('goals').insert(missingGoals) : null,
  ])
}

export async function loadConfig(): Promise<LoadedConfig> {
  const userId = await currentUserId()
  await seedMissingDefaults(userId)

  const [{ data: metricRows }, { data: habitRows }, { data: goalRows }] = await Promise.all([
    supabase.from('metrics').select('*').order('sort_order'),
    supabase.from('habits').select('*').order('sort_order'),
    supabase.from('goals').select('*').order('sort_order'),
  ])

  const metrics: Metric[] = (metricRows ?? []).map((r) => ({
    id: r.key,
    label: r.label,
    group: r.group_name,
    higherIsBetter: r.higher_is_better,
    scale: r.scale,
  }))
  const habits: Habit[] = (habitRows ?? []).map((r) => ({ id: r.key, label: r.label }))
  const goals: Goal[] = (goalRows ?? []).map((r) => ({
    id: r.key,
    label: r.label,
    progress: Number(r.progress),
    note: r.note ?? undefined,
  }))

  return {
    // Theme management stays deferred (REQUIREMENTS.md) — active_theme is
    // still a code default, just stamped onto each entry as before.
    activeTheme: DEFAULT_CONFIG.activeTheme,
    themes: DEFAULT_CONFIG.themes,
    metrics,
    habits,
    goals,
    metricRowId: Object.fromEntries((metricRows ?? []).map((r) => [r.key, r.id as string])),
    habitRowId: Object.fromEntries((habitRows ?? []).map((r) => [r.key, r.id as string])),
  }
}

export async function listDayDates(): Promise<string[]> {
  const userId = await currentUserId()
  const { data } = await supabase
    .from('entries')
    .select('entry_date')
    .eq('user_id', userId)
    .order('entry_date')
  return (data ?? []).map((r) => r.entry_date as string)
}

async function fetchEntryRow(userId: string, date: string) {
  const { data } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .eq('entry_date', date)
    .maybeSingle()
  return data
}

async function fetchMostRecentPriorEntryRow(userId: string, beforeDate: string) {
  const { data } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .lt('entry_date', beforeDate)
    .order('entry_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

// Hydrates an `entries` row into the same DayEntry shape the UI has always
// used, keyed by metric/habit *slug* (not the Postgres row uuid).
async function hydrateEntry(
  row: { id: string; entry_date: string; theme: string | null; reflection: string | null; updated_at: string },
  config: LoadedConfig,
): Promise<DayEntry> {
  const [{ data: metricVals }, { data: habitVals }, { data: todoRows }] = await Promise.all([
    supabase.from('entry_metric_values').select('metric_id, value').eq('entry_id', row.id),
    supabase.from('entry_habits').select('habit_id, done').eq('entry_id', row.id),
    supabase.from('todos').select('scope, text, done').eq('entry_id', row.id).order('sort_order'),
  ])

  const metricKeyById = Object.fromEntries(
    Object.entries(config.metricRowId).map(([key, id]) => [id, key]),
  )
  const habitKeyById = Object.fromEntries(
    Object.entries(config.habitRowId).map(([key, id]) => [id, key]),
  )

  const metrics: Record<string, number> = {}
  for (const v of metricVals ?? []) {
    const key = metricKeyById[v.metric_id as string]
    if (key) metrics[key] = Number(v.value)
  }
  const habits: Record<string, boolean> = {}
  for (const h of habitVals ?? []) {
    const key = habitKeyById[h.habit_id as string]
    if (key) habits[key] = h.done
  }

  const todos: { tomorrow: TodoItem[]; week: TodoItem[] } = { tomorrow: [], week: [] }
  for (const t of todoRows ?? []) {
    const item: TodoItem = { text: t.text, done: t.done }
    if (t.scope === 'tomorrow') todos.tomorrow.push(item)
    else todos.week.push(item)
  }

  return {
    date: row.entry_date,
    theme: row.theme ?? config.activeTheme,
    metrics,
    habits,
    todos,
    reflection: row.reflection ?? '',
    updatedAt: row.updated_at,
  }
}

export async function loadDay(date: string, config: LoadedConfig): Promise<DayEntry | null> {
  const userId = await currentUserId()
  const row = await fetchEntryRow(userId, date)
  return row ? hydrateEntry(row, config) : null
}

export async function loadAllDays(config: LoadedConfig): Promise<DayEntry[]> {
  const dates = await listDayDates()
  const entries = await Promise.all(dates.map((d) => loadDay(d, config)))
  return entries.filter((d): d is DayEntry => d !== null)
}

const carryForward = (items: TodoItem[] = []): TodoItem[] =>
  items.filter((t) => !t.done).map((t) => ({ text: t.text, done: false }))

// A fresh entry for `date`. Unfinished todos roll forward from the most recent
// prior day (not strictly yesterday, so skipped days don't drop pending items).
export async function newEntry(date: string, config: LoadedConfig): Promise<DayEntry> {
  const userId = await currentUserId()
  const priorRow = await fetchMostRecentPriorEntryRow(userId, date)
  const prev = priorRow ? await hydrateEntry(priorRow, config) : null
  return {
    date,
    theme: config.activeTheme,
    // start every slider at 0 so untouched days don't masquerade as a flat
    // baseline (they'd otherwise seed at the mid-point and look like real data)
    metrics: Object.fromEntries(config.metrics.map((m) => [m.id, 0])),
    habits: Object.fromEntries(config.habits.map((h) => [h.id, false])),
    todos: {
      tomorrow: prev ? carryForward(prev.todos.tomorrow) : [],
      week: prev ? carryForward(prev.todos.week) : [],
    },
    reflection: '',
    updatedAt: new Date().toISOString(),
  }
}

// Reconciles the remote entry with any local draft, preferring whichever is
// freshest by `updatedAt` — protects an in-progress edit from a dropped sync.
export async function loadOrInitDay(date: string, config: LoadedConfig): Promise<DayEntry> {
  const [remote, draft] = await Promise.all([loadDay(date, config), Promise.resolve(loadDraft(date))])
  if (draft && (!remote || draft.updatedAt > remote.updatedAt)) return draft
  return remote ?? newEntry(date, config)
}

export async function saveDay(entry: DayEntry, config: LoadedConfig): Promise<void> {
  const userId = await currentUserId()

  const { data: entryRow, error } = await supabase
    .from('entries')
    .upsert(
      { user_id: userId, entry_date: entry.date, theme: entry.theme, reflection: entry.reflection },
      { onConflict: 'user_id,entry_date' },
    )
    .select()
    .single()
  if (error || !entryRow) throw error ?? new Error('Failed to save entry')

  const entryId = entryRow.id as string

  const metricRows = Object.entries(entry.metrics)
    .filter(([key]) => config.metricRowId[key])
    .map(([key, value]) => ({ entry_id: entryId, metric_id: config.metricRowId[key], value }))
  if (metricRows.length) {
    const { error: mErr } = await supabase
      .from('entry_metric_values')
      .upsert(metricRows, { onConflict: 'entry_id,metric_id' })
    if (mErr) throw mErr
  }

  const habitRows = Object.entries(entry.habits)
    .filter(([key]) => config.habitRowId[key])
    .map(([key, done]) => ({ entry_id: entryId, habit_id: config.habitRowId[key], done }))
  if (habitRows.length) {
    const { error: hErr } = await supabase
      .from('entry_habits')
      .upsert(habitRows, { onConflict: 'entry_id,habit_id' })
    if (hErr) throw hErr
  }

  // Todos: replace-all is simplest and correct here — the list is short and
  // fully re-derived from client state on every save; no ids to reconcile.
  const { error: delErr } = await supabase.from('todos').delete().eq('entry_id', entryId)
  if (delErr) throw delErr
  const todoRows = [
    ...entry.todos.tomorrow.map((t, i) => ({
      user_id: userId,
      entry_id: entryId,
      scope: 'tomorrow',
      text: t.text,
      done: t.done,
      sort_order: i,
    })),
    ...entry.todos.week.map((t, i) => ({
      user_id: userId,
      entry_id: entryId,
      scope: 'week',
      text: t.text,
      done: t.done,
      sort_order: i,
    })),
  ]
  if (todoRows.length) {
    const { error: tErr } = await supabase.from('todos').insert(todoRows)
    if (tErr) throw tErr
  }
}

// --- Local draft buffer -----------------------------------------------------
// Write-ahead cache only: instant on every keystroke, cleared once a Postgres
// sync succeeds. Never read as a source of truth on its own — only used to
// win a freshness comparison against the remote row in loadOrInitDay.

const DRAFT_PREFIX = 'vanyaos:draft:'
const draftKey = (date: string) => `${DRAFT_PREFIX}${date}`
const hasWindow = () => typeof window !== 'undefined'

export function saveDraft(entry: DayEntry): void {
  if (hasWindow()) localStorage.setItem(draftKey(entry.date), JSON.stringify(entry))
}

export function loadDraft(date: string): DayEntry | null {
  if (!hasWindow()) return null
  const raw = localStorage.getItem(draftKey(date))
  if (!raw) return null
  try {
    return JSON.parse(raw) as DayEntry
  } catch {
    return null
  }
}

export function clearDraft(date: string): void {
  if (hasWindow()) localStorage.removeItem(draftKey(date))
}
