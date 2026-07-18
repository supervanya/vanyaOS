// Supabase-backed store (ADR-002 / ARCHITECTURE.md). Config (metrics/habits/
// goals) and day entries live in Postgres, scoped to the logged-in account
// via RLS. A local draft buffer (localStorage) still exists purely so a
// dropped connection mid-edit can't lose an entry — Postgres is always the
// source of truth once a sync succeeds; the draft is a transient write-ahead
// copy, not a competing store.

import { supabase } from './supabaseClient'
import { DEFAULT_CONFIG, type Config, type Metric, type Habit, type Goal } from './config'

export type DayEntry = {
  date: string // YYYY-MM-DD
  theme: string
  metrics: Record<string, number>
  habits: Record<string, boolean>
  reflection: string
  updatedAt: string
}

// The living task list (M2): tasks belong to no day. scope today/week counts
// toward the weekly 1-3-5 commitment; someday is the parking lot.
export type TaskScope = 'today' | 'week' | 'someday'
export type TaskSize = 'big' | 'medium' | 'small'
export type Task = {
  id: string
  scope: TaskScope
  size: TaskSize
  text: string
  completedAt: string | null
  sortOrder: number
}

export type ProjectStatus = 'in_progress' | 'parking_lot'
export type Project = {
  id: string
  name: string
  emoji: string | null
  status: ProjectStatus
  sortOrder: number
}

// The 1-3-5 rule: weekly caps per size, counted over scope today+week,
// including completed items (done work still occupied its slot this week).
export const CAPS: Record<TaskSize, number> = { big: 1, medium: 3, small: 5 }

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

// Hydrates an `entries` row into the same DayEntry shape the UI has always
// used, keyed by metric/habit *slug* (not the Postgres row uuid).
async function hydrateEntry(
  row: { id: string; entry_date: string; theme: string | null; reflection: string | null; updated_at: string },
  config: LoadedConfig,
): Promise<DayEntry> {
  const [{ data: metricVals }, { data: habitVals }] = await Promise.all([
    supabase.from('entry_metric_values').select('metric_id, value').eq('entry_id', row.id),
    supabase.from('entry_habits').select('habit_id, done').eq('entry_id', row.id),
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

  return {
    date: row.entry_date,
    theme: row.theme ?? config.activeTheme,
    metrics,
    habits,
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

// A fresh entry for `date`. (Todos no longer roll forward — the living task
// list simply persists; see the tasks section below.)
export async function newEntry(date: string, config: LoadedConfig): Promise<DayEntry> {
  return {
    date,
    theme: config.activeTheme,
    // start every slider at 0 so untouched days don't masquerade as a flat
    // baseline (they'd otherwise seed at the mid-point and look like real data)
    metrics: Object.fromEntries(config.metrics.map((m) => [m.id, 0])),
    habits: Object.fromEntries(config.habits.map((h) => [h.id, false])),
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

// --- Tasks (the living 1-3-5 list) ------------------------------------------
// Direct row ops with optimistic UI at the callsite — no debounced blob sync;
// each mutation is one small write.

type TaskRow = {
  id: string
  scope: TaskScope
  size: TaskSize
  text: string
  completed_at: string | null
  sort_order: number
}

const taskFromRow = (r: TaskRow): Task => ({
  id: r.id,
  scope: r.scope,
  size: r.size,
  text: r.text,
  completedAt: r.completed_at,
  sortOrder: r.sort_order,
})

// Open tasks plus recently completed ones (completed stay visible on the board
// for the week they occupied — done work still counts toward the caps).
export async function listTasks(): Promise<Task[]> {
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString()
  const { data, error } = await supabase
    .from('tasks')
    .select('id, scope, size, text, completed_at, sort_order')
    .eq('archived', false)
    .or(`completed_at.is.null,completed_at.gte.${weekAgo}`)
    .order('sort_order')
    .order('created_at')
  if (error) throw error
  return (data ?? []).map(taskFromRow)
}

export async function addTask(text: string, scope: TaskScope, size: TaskSize): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({ text, scope, size })
    .select('id, scope, size, text, completed_at, sort_order')
    .single()
  if (error || !data) throw error ?? new Error('Failed to add task')
  return taskFromRow(data as TaskRow)
}

export async function setTaskDone(id: string, done: boolean): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({ completed_at: done ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) throw error
}

export async function moveTask(id: string, scope: TaskScope): Promise<void> {
  const { error } = await supabase.from('tasks').update({ scope }).eq('id', id)
  if (error) throw error
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}

// --- Projects (WIP limit: one) ----------------------------------------------

type ProjectRow = {
  id: string
  name: string
  emoji: string | null
  status: ProjectStatus
  sort_order: number
}

const projectFromRow = (r: ProjectRow): Project => ({
  id: r.id,
  name: r.name,
  emoji: r.emoji,
  status: r.status,
  sortOrder: r.sort_order,
})

export async function listProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, emoji, status, sort_order')
    .order('sort_order')
    .order('created_at')
  if (error) throw error
  return (data ?? []).map(projectFromRow)
}

export async function addProject(name: string, emoji?: string): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert({ name, emoji: emoji ?? null })
    .select('id, name, emoji, status, sort_order')
    .single()
  if (error || !data) throw error ?? new Error('Failed to add project')
  return projectFromRow(data as ProjectRow)
}

// Swap which project is in progress. Demote first, then promote — the partial
// unique index (one in_progress per user) rejects the other order.
export async function setActiveProject(id: string): Promise<void> {
  const { error: demoteErr } = await supabase
    .from('projects')
    .update({ status: 'parking_lot' })
    .eq('status', 'in_progress')
  if (demoteErr) throw demoteErr
  const { error } = await supabase.from('projects').update({ status: 'in_progress' }).eq('id', id)
  if (error) throw error
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) throw error
}
