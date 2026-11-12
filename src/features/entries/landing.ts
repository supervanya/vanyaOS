// Landing (ARCHITECTURE.md "One day, two halves"): before noon, `/` opens on
// /morning until today's morning is set, unless "Skip today" was tapped on this
// device.

import type { QueryClient } from "@tanstack/react-query"
import { configQuery } from "@/features/config/queries"
import { metricsAt, type Metric } from "@/lib/config"
import { DAY_CUTOFF_HOUR, todayISO } from "@/lib/dates"
import type { MorningEntry } from "./api"
import { eveningStarted } from "./lock"
import { dayQuery, morningQuery } from "./queries"

const NOON = 12

/**
 * Whether `now` falls in the morning `/` redirects in: from the hour the app's
 * day starts (before it, `defaultEntryDate` still means yesterday, and the
 * night's reflection is what's being written) up to, not including, 12:00.
 */
export const inMorningWindow = (now: Date): boolean =>
  now.getHours() >= DAY_CUTOFF_HOUR && now.getHours() < NOON

/**
 * A morning is set once its intention has any non-whitespace text, or any
 * morning-timed metric has a value. `metrics` is the configured list.
 */
export function morningIsSet(
  morning: Pick<MorningEntry, "intention" | "metrics">,
  metrics: Metric[],
): boolean {
  return (
    morning.intention.trim() !== "" ||
    metricsAt(metrics, "morning").some((m) => morning.metrics[m.id] !== undefined)
  )
}

/**
 * Whether loading `/` should open today's /morning instead. A locked morning
 * (the evening is started) has nothing left to set, so it never redirects.
 */
export function shouldOpenMorning({
  now,
  morning,
  locked,
  skipped,
  metrics,
}: {
  now: Date
  morning: Pick<MorningEntry, "intention" | "metrics">
  locked: boolean
  skipped: boolean
  metrics: Metric[]
}): boolean {
  return inMorningWindow(now) && !skipped && !locked && !morningIsSet(morning, metrics)
}

/**
 * The index route's check, run before it loads. Fetches nothing outside the
 * morning window or on a skipped day. If today's morning can't be loaded
 * (offline, an error), the answer is "no": this feature never keeps anyone
 * from the dashboard.
 */
export async function opensOnMorning(queryClient: QueryClient, now = new Date()): Promise<boolean> {
  const date = todayISO()
  if (!inMorningWindow(now) || morningSkipped(date)) return false
  try {
    const [config, loaded] = await Promise.all([
      queryClient.ensureQueryData(configQuery),
      queryClient.ensureQueryData(morningQuery(date)),
    ])
    // An evening started this session reaches the day's cache before the
    // morning's (see MorningDay); read it without fetching.
    const day = queryClient.getQueryData(dayQuery(date).queryKey)
    const locked = loaded.locked || (day !== undefined && eveningStarted(day.entry, config.metrics))
    return shouldOpenMorning({
      now,
      morning: loaded.entry,
      locked,
      skipped: false,
      metrics: config.metrics,
    })
  } catch {
    return false
  }
}

// --- "Skip today" -----------------------------------------------------------
// A per-date flag in localStorage, device-local on purpose. Also kept in
// memory, so Skip still works for the session when storage is unavailable
// (private mode, quota, disabled) — otherwise `/` would bounce straight back.

const SKIP_PREFIX = "vanyaos:morning-skip:"
const skippedThisSession = new Set<string>()

export function morningSkipped(date: string): boolean {
  if (skippedThisSession.has(date)) return true
  try {
    const raw: unknown = localStorage.getItem(SKIP_PREFIX + date)
    return raw === "1"
  } catch {
    return false
  }
}

/** Remembers "Skip today" for `date`, and drops the flags of other days. */
export function skipMorning(date: string): void {
  skippedThisSession.add(date)
  try {
    const stale: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(SKIP_PREFIX) && key !== SKIP_PREFIX + date) stale.push(key)
    }
    for (const key of stale) localStorage.removeItem(key)
    localStorage.setItem(SKIP_PREFIX + date, "1")
  } catch {
    // The in-memory flag covers this session.
  }
}
