// Day entries (ADR-002 / ARCHITECTURE.md): one `entries` row per day with its
// metric values and habit checks in child tables, plus a local draft buffer
// (localStorage) so a dropped connection mid-edit can't lose an entry —
// Postgres is always the source of truth once a sync succeeds; the draft is a
// transient write-ahead copy, not a competing store.

import type { LoadedConfig } from "@/features/config/api"
import { currentUserId } from "@/lib/auth"
import { metricsAt } from "@/lib/config"
import { isOneOf, isRecord, oneOf } from "@/lib/parse"
import { supabase } from "@/lib/supabaseClient"
import { eveningStarted } from "./lock"

// The evening's answer to "did I live this morning's intention?" — pinned by a
// CHECK constraint on `entries.intention_lived`. Null until it's tapped.
export const INTENTION_LIVED = ["no", "partly", "yes"] as const
export type IntentionLived = (typeof INTENTION_LIVED)[number]

export type DayEntry = {
  date: string // YYYY-MM-DD
  theme: string
  metrics: Record<string, number> // only sliders you've set; untouched ones are absent
  habits: Record<string, boolean>
  reflection: string
  intention: string // the morning half's text; written only by saveMorning
  intentionLived: IntentionLived | null
  updatedAt: string
}

// The morning half of a day (ARCHITECTURE.md "One day, two halves"): what
// /morning edits and `save_morning` writes. `metrics` holds only morning-timed
// values. It lives on the same `entries` row as the evening, so `updatedAt` is
// that row's.
export type MorningEntry = {
  date: string // YYYY-MM-DD
  theme: string // only used when the morning creates the day's row
  intention: string
  metrics: Record<string, number>
  updatedAt: string
}

export async function listDayDates(): Promise<string[]> {
  const userId = await currentUserId()
  const { data, error } = await supabase
    .from("entries")
    .select("entry_date")
    .eq("user_id", userId)
    .order("entry_date")
  if (error) throw error
  return data.map((r) => r.entry_date)
}

// Null only when the day has no row. A failed read throws instead: taken for
// an empty day, it would open a blank editor whose first autosave overwrites
// the saved entry.
async function fetchEntryRow(userId: string, date: string) {
  const { data, error } = await supabase
    .from("entries")
    .select("*")
    .eq("user_id", userId)
    .eq("entry_date", date)
    .maybeSingle()
  if (error) throw error
  return data
}

// Hydrates an `entries` row into the same DayEntry shape the UI has always
// used, keyed by metric/habit *slug* (not the Postgres row uuid).
async function hydrateEntry(
  row: {
    id: string
    entry_date: string
    theme: string | null
    reflection: string | null
    intention: string
    intention_lived: string | null
    updated_at: string
  },
  config: LoadedConfig,
): Promise<DayEntry> {
  const [metricRes, habitRes] = await Promise.all([
    supabase.from("entry_metric_values").select("metric_id, value").eq("entry_id", row.id),
    supabase.from("entry_habits").select("habit_id, done").eq("entry_id", row.id),
  ])
  if (metricRes.error) throw metricRes.error
  if (habitRes.error) throw habitRes.error

  const metricKeyById = Object.fromEntries(
    Object.entries(config.metricRowId).map(([key, id]) => [id, key]),
  )
  const habitKeyById = Object.fromEntries(
    Object.entries(config.habitRowId).map(([key, id]) => [id, key]),
  )

  const metrics: Record<string, number> = {}
  for (const v of metricRes.data) {
    const key = metricKeyById[v.metric_id]
    if (key) metrics[key] = v.value
  }
  const habits: Record<string, boolean> = {}
  for (const h of habitRes.data) {
    const key = habitKeyById[h.habit_id]
    if (key) habits[key] = h.done
  }

  return {
    date: row.entry_date,
    theme: row.theme ?? config.activeTheme,
    metrics,
    habits,
    reflection: row.reflection ?? "",
    intention: row.intention,
    intentionLived:
      row.intention_lived === null
        ? null
        : oneOf(INTENTION_LIVED, row.intention_lived, "entries.intention_lived"),
    updatedAt: row.updated_at,
  }
}

export async function loadDay(date: string, config: LoadedConfig): Promise<DayEntry | null> {
  const userId = await currentUserId()
  const row = await fetchEntryRow(userId, date)
  return row ? hydrateEntry(row, config) : null
}

// A fresh entry for `date`. (Todos no longer roll forward — the living task
// list simply persists; see the tasks section below.)
async function newEntry(date: string, config: LoadedConfig): Promise<DayEntry> {
  return {
    date,
    theme: config.activeTheme,
    // No slider starts with a value: only the ones you set are saved, so a
    // habits-only day doesn't record a fake 0 on every metric.
    metrics: {},
    habits: Object.fromEntries(config.habits.map((h) => [h.id, false])),
    reflection: "",
    intention: "",
    intentionLived: null,
    updatedAt: new Date().toISOString(),
  }
}

// A day as the page should show it. `unsynced` means it came from a local
// draft that never reached Postgres, so it still needs saving.
export type LoadedDay = { entry: DayEntry; unsynced: boolean }

// Reconciles the remote entry with any local draft, preferring whichever is
// freshest by `updatedAt` — protects an in-progress edit from a dropped sync.
// An evening draft only speaks for the evening half: its morning half is a
// copy from when it was written, so the saved morning replaces it.
export async function loadOrInitDay(date: string, config: LoadedConfig): Promise<LoadedDay> {
  const [remote, draft] = await Promise.all([
    loadDay(date, config),
    Promise.resolve(loadDraft(date)),
  ])
  if (draft && (!remote || draft.updatedAt > remote.updatedAt))
    return { entry: withMorning(draft, remote ?? EMPTY_MORNING, config), unsynced: true }
  return { entry: remote ?? (await newEntry(date, config)), unsynced: false }
}

const EMPTY_MORNING = { intention: "", metrics: {} }

const morningIds = (config: LoadedConfig) =>
  new Set(metricsAt(config.metrics, "morning").map((m) => m.id))

/**
 * `day` with its morning half — the intention and every morning-timed metric
 * value — taken from `morning`. Each half owns its own fields of the shared
 * day, so whoever writes one half into it keeps the other half as it found it.
 */
export function withMorning(
  day: DayEntry,
  morning: Pick<MorningEntry, "intention" | "metrics">,
  config: LoadedConfig,
): DayEntry {
  const ids = morningIds(config)
  const metrics = Object.fromEntries([
    ...Object.entries(day.metrics).filter(([id]) => !ids.has(id)),
    ...Object.entries(morning.metrics).filter(([id]) => ids.has(id)),
  ])
  return { ...day, intention: morning.intention, metrics }
}

// The morning half of a loaded day.
function morningOf(day: DayEntry, config: LoadedConfig): MorningEntry {
  const ids = morningIds(config)
  return {
    date: day.date,
    theme: day.theme,
    intention: day.intention,
    metrics: Object.fromEntries(Object.entries(day.metrics).filter(([id]) => ids.has(id))),
    updatedAt: day.updatedAt,
  }
}

// A morning as /morning should show it. `unsynced`: from a local draft that
// never reached Postgres. `locked`: the day's evening was started when it was
// read, so `save_morning` refuses it and /morning shows it read-only.
export type LoadedMorning = { entry: MorningEntry; unsynced: boolean; locked: boolean }

// The morning's counterpart of loadOrInitDay: an unsynced morning draft, else
// the saved morning half, else a blank morning.
//
// Unlike the evening, a morning draft isn't weighed against the row's
// `updatedAt`: every evening save bumps that, habit taps on the dashboard
// included, so an unsynced intention would lose to a habit tapped after it. A
// morning draft only exists while it's unsynced (a save clears it), so it wins
// — unless the day's evening is started: `save_morning` would refuse it, so
// it's dropped and the saved morning shown.
export async function loadOrInitMorning(
  date: string,
  config: LoadedConfig,
): Promise<LoadedMorning> {
  const [remote, draft] = await Promise.all([
    loadDay(date, config),
    Promise.resolve(loadMorningDraft(date)),
  ])
  const locked = remote !== null && eveningStarted(remote, config.metrics)
  if (draft && locked) discardMorningDraft(date)
  else if (draft) return { entry: draft, unsynced: true, locked: false }
  const entry: MorningEntry = remote
    ? morningOf(remote, config)
    : {
        date,
        theme: config.activeTheme,
        intention: "",
        metrics: {},
        updatedAt: new Date().toISOString(),
      }
  return { entry, unsynced: false, locked }
}

// Saves the evening half — the entry row, evening metric values and habit
// checks — in one transaction (the `save_day` function), so a failure never
// leaves a half-saved day. `save_day` itself drops morning-timed metrics from
// `metric_values` and never touches `intention`, so this can't clobber the
// morning half.
export async function saveDay(entry: DayEntry, config: LoadedConfig): Promise<void> {
  // Every active metric is sent: set ones with their value, unset ones as null
  // so a slider reset to "no value" clears it. Archived or unknown metrics have
  // no row id and are skipped, so their history is left alone.
  const metricValues = Object.entries(config.metricRowId).map(([key, metricId]) => ({
    metric_id: metricId,
    value: entry.metrics[key] ?? null,
  }))
  const habitChecks = Object.entries(entry.habits).flatMap(([key, done]) => {
    const habitId = config.habitRowId[key]
    return habitId ? [{ habit_id: habitId, done }] : []
  })

  const { error } = await supabase.rpc("save_day", {
    entry_date: entry.date,
    theme: entry.theme,
    reflection: entry.reflection,
    // "" means "not rated": the generated types make every argument non-null.
    intention_lived: entry.intentionLived ?? "",
    metric_values: metricValues,
    habit_checks: habitChecks,
  })
  if (error) throw error
}

// Saves the morning half — the intention and morning-timed metric values — in
// one transaction (the `save_morning` function). Only morning metrics are sent,
// unset ones as null to clear them; `save_morning` filters by timing again in
// SQL. Once the day's evening is started the function refuses (see
// isMorningLocked) and nothing is saved.
export async function saveMorning(entry: MorningEntry, config: LoadedConfig): Promise<void> {
  const metricValues = metricsAt(config.metrics, "morning").flatMap((m) => {
    const metricId = config.metricRowId[m.id]
    return metricId ? [{ metric_id: metricId, value: entry.metrics[m.id] ?? null }] : []
  })
  const { error } = await supabase.rpc("save_morning", {
    entry_date: entry.date,
    theme: entry.theme,
    intention: entry.intention,
    metric_values: metricValues,
  })
  if (error) throw error
}

// `save_morning`'s refusal once the day's evening is started: SQLSTATE MLOCK,
// which PostgREST passes on as the error's `code`. Saving again can't help.
export const isMorningLocked = (err: unknown): boolean => isRecord(err) && err.code === "MLOCK"

// --- Local draft buffer -----------------------------------------------------
// Write-ahead cache only: instant on every keystroke, cleared once a Postgres
// sync succeeds. Never read as a source of truth on its own — only used to
// win a freshness comparison against the remote row in loadOrInitDay.

const DRAFT_PREFIX = "vanyaos:draft:"
const draftKey = (date: string) => `${DRAFT_PREFIX}${date}`
const hasWindow = () => typeof window !== "undefined"

export function saveDraft(entry: DayEntry): void {
  if (hasWindow()) localStorage.setItem(draftKey(entry.date), JSON.stringify(entry))
}

export function loadDraft(date: string): DayEntry | null {
  if (!hasWindow()) return null
  const raw = localStorage.getItem(draftKey(date))
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isStoredDraft(parsed)
      ? {
          ...parsed,
          intention: parsed.intention ?? "",
          intentionLived: parsed.intentionLived ?? null,
        }
      : null
  } catch {
    return null
  }
}

// A draft as it may sit in localStorage: written before M5, it has no
// `intention` or `intentionLived` at all. (Its intention is only a copy:
// loadOrInitDay replaces it with the saved morning.)
type StoredDraft = Omit<DayEntry, "intention" | "intentionLived"> & {
  intention?: string
  intentionLived?: IntentionLived | null
}

// Drafts come back from localStorage, which may hold an older shape — check
// before trusting it, and fall back to the remote entry if it doesn't match.
function isStoredDraft(value: unknown): value is StoredDraft {
  return (
    isRecord(value) &&
    typeof value.date === "string" &&
    typeof value.theme === "string" &&
    typeof value.reflection === "string" &&
    typeof value.updatedAt === "string" &&
    isRecord(value.metrics) &&
    Object.values(value.metrics).every((x) => typeof x === "number") &&
    isRecord(value.habits) &&
    Object.values(value.habits).every((x) => typeof x === "boolean") &&
    (value.intention === undefined || typeof value.intention === "string") &&
    (value.intentionLived === undefined ||
      value.intentionLived === null ||
      (typeof value.intentionLived === "string" && isOneOf(INTENTION_LIVED, value.intentionLived)))
  )
}

// Drops the draft once `saved` is in Postgres — unless a newer edit has
// replaced it since, which still needs its own sync.
export function clearDraft(saved: DayEntry): void {
  if (loadDraft(saved.date)?.updatedAt === saved.updatedAt)
    localStorage.removeItem(draftKey(saved.date))
}

// --- Morning drafts ---------------------------------------------------------
// The same write-ahead buffer for the morning half, under its own key so an
// unsynced morning edit and an unsynced evening edit can never overwrite each
// other. The evening reads only its exact key (`vanyaos:draft:<date>`), never
// by prefix, so it can't pick these up.

const morningDraftKey = (date: string) => `${DRAFT_PREFIX}morning:${date}`

export function saveMorningDraft(entry: MorningEntry): void {
  if (!hasWindow()) return
  const stored: StoredMorningDraft = { half: "morning", ...entry }
  localStorage.setItem(morningDraftKey(entry.date), JSON.stringify(stored))
}

export function loadMorningDraft(date: string): MorningEntry | null {
  if (!hasWindow()) return null
  const raw = localStorage.getItem(morningDraftKey(date))
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isStoredMorningDraft(parsed) || parsed.date !== date) return null
    // Only the morning's own fields, whatever else the record carries.
    const { theme, intention, metrics, updatedAt } = parsed
    return { date, theme, intention, metrics, updatedAt }
  } catch {
    return null
  }
}

// Tagged with its half, so an evening-shaped record (or anything older) is
// never taken for a morning.
type StoredMorningDraft = MorningEntry & { half: "morning" }

function isStoredMorningDraft(value: unknown): value is StoredMorningDraft {
  return (
    isRecord(value) &&
    value.half === "morning" &&
    typeof value.date === "string" &&
    typeof value.theme === "string" &&
    typeof value.intention === "string" &&
    typeof value.updatedAt === "string" &&
    isRecord(value.metrics) &&
    Object.values(value.metrics).every((x) => typeof x === "number")
  )
}

// Drops the morning draft once `saved` is in Postgres, unless a newer edit
// has replaced it since.
export function clearMorningDraft(saved: MorningEntry): void {
  if (loadMorningDraft(saved.date)?.updatedAt === saved.updatedAt) discardMorningDraft(saved.date)
}

// Drops the day's morning draft outright: it can never be saved, because the
// day's evening is started.
export function discardMorningDraft(date: string): void {
  if (hasWindow()) localStorage.removeItem(morningDraftKey(date))
}
