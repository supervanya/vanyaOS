// The account's tracked metrics, habits and goals (ADR-002 / ARCHITECTURE.md):
// Postgres rows scoped by RLS, seeded from the code defaults in lib/config.ts.

import { currentUserId } from "@/lib/auth"
import { DEFAULT_CONFIG, type Config, type Goal, type Habit, type Metric } from "@/lib/config"
import { supabase } from "@/lib/supabaseClient"

// Config rows keyed by their stable slug (`key` in Postgres, `id` in the UI
// shape) plus the slug -> row-uuid maps needed to write child tables.
export type LoadedConfig = Config & {
  metricRowId: Record<string, string>
  habitRowId: Record<string, string>
}

export async function loadConfig(): Promise<LoadedConfig> {
  await seedDefaultsOnce(await currentUserId())

  // Archived rows are invisible to the app but keep their uuid, so historical
  // entry values still join (and old wellness scores still include them).
  const [metricRes, habitRes, goalRes] = await Promise.all([
    supabase.from("metrics").select("*").eq("archived", false).order("sort_order"),
    supabase.from("habits").select("*").eq("archived", false).order("sort_order"),
    supabase.from("goals").select("*").eq("archived", false).order("sort_order"),
  ])
  if (metricRes.error) throw metricRes.error
  if (habitRes.error) throw habitRes.error
  if (goalRes.error) throw goalRes.error

  const metrics: Metric[] = metricRes.data.map((r) => ({
    id: r.key,
    label: r.label,
    group: r.group_name,
    higherIsBetter: r.higher_is_better,
    scale: r.scale,
  }))
  const habits: Habit[] = habitRes.data.map((r) => ({ id: r.key, label: r.label }))
  const goals: Goal[] = goalRes.data.map((r) => ({
    id: r.key,
    label: r.label,
    progress: r.progress,
    ...(r.note !== null && { note: r.note }),
  }))

  return {
    // Theme management stays deferred (REQUIREMENTS.md) — active_theme is
    // still a code default, just stamped onto each entry as before.
    activeTheme: DEFAULT_CONFIG.activeTheme,
    themes: DEFAULT_CONFIG.themes,
    metrics,
    habits,
    goals,
    metricRowId: Object.fromEntries(metricRes.data.map((r) => [r.key, r.id])),
    habitRowId: Object.fromEntries(habitRes.data.map((r) => [r.key, r.id])),
  }
}

// Seeding checks and writes rows, so it runs once per account per page load —
// not on every config read. A failure clears the memo so the next read retries.
const seeded = new Map<string, Promise<void>>()

function seedDefaultsOnce(userId: string): Promise<void> {
  let pending = seeded.get(userId)
  if (!pending) {
    pending = seedMissingDefaults(userId).catch((err: unknown) => {
      seeded.delete(userId)
      throw err
    })
    seeded.set(userId, pending)
  }
  return pending
}

// Seed any config.ts defaults this account doesn't have yet — first login gets
// everything, and a default added later (e.g. a new metric) reaches existing
// accounts on their next load. Keys are checked UNFILTERED by archived, so an
// archived default stays archived; existing rows are never touched, so edits
// to labels and ordering survive.
async function seedMissingDefaults(userId: string): Promise<void> {
  const [metricKeys, habitKeys, goalKeys] = await Promise.all([
    supabase.from("metrics").select("key"),
    supabase.from("habits").select("key"),
    supabase.from("goals").select("key"),
  ])
  if (metricKeys.error) throw metricKeys.error
  if (habitKeys.error) throw habitKeys.error
  if (goalKeys.error) throw goalKeys.error
  const has = (rows: { key: string }[]) => new Set(rows.map((r) => r.key))
  const [metricSet, habitSet, goalSet] = [
    has(metricKeys.data),
    has(habitKeys.data),
    has(goalKeys.data),
  ]

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

  const inserts = await Promise.all([
    missingMetrics.length ? supabase.from("metrics").insert(missingMetrics) : null,
    missingHabits.length ? supabase.from("habits").insert(missingHabits) : null,
    missingGoals.length ? supabase.from("goals").insert(missingGoals) : null,
  ])
  for (const result of inserts) if (result?.error) throw result.error
}
