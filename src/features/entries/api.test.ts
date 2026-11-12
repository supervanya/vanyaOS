// @vitest-environment jsdom
import type { LoadedConfig } from "@/features/config/api"
import type { Metric } from "@/lib/config"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  isMorningLocked,
  listDayDates,
  loadOrInitDay,
  loadOrInitMorning,
  saveDay,
  saveDraft,
  saveMorning,
  saveMorningDraft,
  type DayEntry,
  type MorningEntry,
} from "./api"

// What each table's next read returns, as Supabase shapes it: rows or an error.
type Result = { data: unknown; error: { message: string } | null }
const results: Record<string, Result> = {}

// A stand-in for supabase-js's query builder: filters chain, and awaiting the
// query (or `.maybeSingle()`) gives that table's result.
type Query = Promise<Result> & {
  select: () => Query
  eq: () => Query
  order: () => Query
  maybeSingle: () => Promise<Result>
}
function query(table: string): Query {
  const result = Promise.resolve(results[table] ?? { data: [], error: null })
  const builder: Query = Object.assign(result, {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    maybeSingle: () => result,
  })
  return builder
}

// Saves go through `rpc`; vi.mock is hoisted above this file, so it is too.
const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn<(fn: string, args: Record<string, unknown>) => Promise<Result>>(() =>
    Promise.resolve({ data: null, error: null }),
  ),
}))
vi.mock("@/lib/supabaseClient", () => ({ supabase: { from: query, rpc } }))
vi.mock("@/lib/auth", () => ({ currentUserId: () => Promise.resolve("user-1") }))

// Hydration only reads the slug -> row-id maps; a fresh day lists `habits`.
const config: LoadedConfig = {
  activeTheme: "recovery",
  themes: ["recovery"],
  metrics: [],
  habits: [{ id: "steps", label: "Steps" }],
  goals: [],
  metricRowId: { mood: "metric-mood" },
  habitRowId: { steps: "habit-steps" },
}

const date = "2026-09-24"
const savedRow = {
  id: "entry-1",
  entry_date: date,
  theme: "recovery",
  reflection: "long day",
  intention: "stay calm",
  intention_lived: "partly",
  updated_at: "2026-09-24T21:00:00.000Z",
}
const failure = { data: null, error: { message: "JWT expired" } }

afterEach(() => {
  for (const table of Object.keys(results)) delete results[table]
  localStorage.clear()
})

// A config with one metric in each half: mood at night, sleep in the morning.
const metric = (id: string, timing: Metric["timing"]): Metric => ({
  id,
  label: id,
  group: "Core",
  higherIsBetter: true,
  scale: 5,
  timing,
})
const split: LoadedConfig = {
  ...config,
  metrics: [metric("mood", "evening"), metric("sleep", "morning")],
  metricRowId: { mood: "metric-mood", sleep: "metric-sleep" },
}

// A saved day with both halves filled in.
function savedBothHalves() {
  results.entries = { data: savedRow, error: null }
  results.entry_metric_values = {
    data: [
      { metric_id: "metric-mood", value: 4 },
      { metric_id: "metric-sleep", value: 2 },
    ],
    error: null,
  }
}

describe("loadOrInitDay", () => {
  it("hydrates a saved day", async () => {
    results.entries = { data: savedRow, error: null }
    results.entry_metric_values = { data: [{ metric_id: "metric-mood", value: 4 }], error: null }
    results.entry_habits = { data: [{ habit_id: "habit-steps", done: true }], error: null }

    const { entry } = await loadOrInitDay(date, config)
    expect(entry).toMatchObject({
      reflection: "long day",
      intention: "stay calm",
      intentionLived: "partly",
      metrics: { mood: 4 },
      habits: { steps: true },
    })
  })

  it("starts a fresh entry only when the day has no row", async () => {
    results.entries = { data: null, error: null }

    const { entry } = await loadOrInitDay(date, config)
    expect(entry).toMatchObject({
      reflection: "",
      intention: "",
      intentionLived: null,
      metrics: {},
      habits: { steps: false },
    })
  })

  it("reads an unrated day as not rated", async () => {
    results.entries = { data: { ...savedRow, intention_lived: null }, error: null }

    const { entry } = await loadOrInitDay(date, config)
    expect(entry.intentionLived).toBeNull()
  })

  it("rejects a lived rating the app doesn't know", async () => {
    results.entries = { data: { ...savedRow, intention_lived: "mostly" }, error: null }
    await expect(loadOrInitDay(date, config)).rejects.toThrow("entries.intention_lived")
  })

  it("throws when the entry read fails, instead of opening an empty day", async () => {
    results.entries = failure
    await expect(loadOrInitDay(date, config)).rejects.toEqual(failure.error)
  })

  it.each(["entry_metric_values", "entry_habits"])(
    "throws when the %s read fails",
    async (table) => {
      results.entries = { data: savedRow, error: null }
      results[table] = failure
      await expect(loadOrInitDay(date, config)).rejects.toEqual(failure.error)
    },
  )
})

describe("loadOrInitDay with an evening draft", () => {
  it("takes the evening half from a newer draft but the morning half from Postgres", async () => {
    savedBothHalves()
    saveDraft({
      date,
      theme: "recovery",
      metrics: { mood: 1, sleep: 5 }, // sleep: a stale copy of the morning
      habits: { steps: false },
      reflection: "draft",
      intention: "old intention",
      intentionLived: null,
      updatedAt: "2026-09-24T22:00:00.000Z",
    })

    const { entry, unsynced } = await loadOrInitDay(date, split)
    expect(unsynced).toBe(true)
    expect(entry).toMatchObject({
      reflection: "draft",
      intention: "stay calm",
      metrics: { mood: 1, sleep: 2 },
    })
  })
})

describe("loadOrInitMorning", () => {
  it("loads the morning half of a saved day", async () => {
    savedBothHalves()
    expect(await loadOrInitMorning(date, split)).toEqual({
      entry: {
        date,
        theme: "recovery",
        intention: "stay calm",
        metrics: { sleep: 2 },
        updatedAt: savedRow.updated_at,
      },
      unsynced: false,
    })
  })

  it("starts a blank morning when the day has no row", async () => {
    results.entries = { data: null, error: null }
    const { entry, unsynced } = await loadOrInitMorning(date, split)
    expect(unsynced).toBe(false)
    expect(entry).toMatchObject({ date, theme: "recovery", intention: "", metrics: {} })
  })

  it("prefers a newer unsynced morning draft", async () => {
    savedBothHalves()
    const draft: MorningEntry = {
      date,
      theme: "recovery",
      intention: "typed offline",
      metrics: { sleep: 4 },
      updatedAt: "2026-09-24T22:00:00.000Z",
    }
    saveMorningDraft(draft)
    expect(await loadOrInitMorning(date, split)).toEqual({ entry: draft, unsynced: true })
  })

  it("prefers the saved morning over an older draft", async () => {
    savedBothHalves()
    saveMorningDraft({
      date,
      theme: "recovery",
      intention: "stale",
      metrics: {},
      updatedAt: "2026-09-24T06:00:00.000Z",
    })
    const { entry, unsynced } = await loadOrInitMorning(date, split)
    expect(unsynced).toBe(false)
    expect(entry.intention).toBe("stay calm")
  })

  it("never takes an evening draft for a morning", async () => {
    results.entries = { data: null, error: null }
    saveDraft({
      date,
      theme: "recovery",
      metrics: {},
      habits: {},
      reflection: "evening",
      intention: "copied",
      intentionLived: null,
      updatedAt: "2026-09-24T22:00:00.000Z",
    })
    const { entry, unsynced } = await loadOrInitMorning(date, split)
    expect(unsynced).toBe(false)
    expect(entry.intention).toBe("")
  })
})

describe("saveMorning", () => {
  const morning: MorningEntry = {
    date,
    theme: "recovery",
    intention: "stay calm",
    metrics: { sleep: 3, mood: 5 }, // mood is an evening metric: never sent
    updatedAt: "2026-09-24T07:00:00.000Z",
  }

  it("sends the intention and only the morning metrics", async () => {
    await saveMorning(morning, split)
    expect(rpc).toHaveBeenLastCalledWith("save_morning", {
      entry_date: date,
      theme: "recovery",
      intention: "stay calm",
      metric_values: [{ metric_id: "metric-sleep", value: 3 }],
    })
  })

  it("sends an unset morning metric as null, to clear it", async () => {
    await saveMorning({ ...morning, metrics: {} }, split)
    expect(rpc).toHaveBeenLastCalledWith(
      "save_morning",
      expect.objectContaining({ metric_values: [{ metric_id: "metric-sleep", value: null }] }),
    )
  })

  it("throws the refusal of a locked morning, recognisably", async () => {
    const locked = { message: "morning_locked", code: "MLOCK" }
    rpc.mockResolvedValueOnce({ data: null, error: locked })
    const err: unknown = await saveMorning(morning, split).catch((e: unknown) => e)
    expect(err).toBe(locked)
    expect(isMorningLocked(err)).toBe(true)
  })

  it("doesn't take other failures for a lock", () => {
    expect(isMorningLocked({ message: "JWT expired", code: "PGRST301" })).toBe(false)
    expect(isMorningLocked(new Error("offline"))).toBe(false)
    expect(isMorningLocked("MLOCK")).toBe(false)
  })
})

describe("saveDay", () => {
  const entry: DayEntry = {
    date,
    theme: "recovery",
    metrics: {},
    habits: { steps: true },
    reflection: "long day",
    intention: "stay calm",
    intentionLived: "yes",
    updatedAt: "2026-09-24T21:00:00.000Z",
  }

  it("sends the lived rating with the evening half", async () => {
    await saveDay(entry, config)
    expect(rpc).toHaveBeenLastCalledWith("save_day", {
      entry_date: date,
      theme: "recovery",
      reflection: "long day",
      intention_lived: "yes",
      metric_values: [{ metric_id: "metric-mood", value: null }],
      habit_checks: [{ habit_id: "habit-steps", done: true }],
    })
  })

  it("sends an unrated day as an empty rating", async () => {
    await saveDay({ ...entry, intentionLived: null }, config)
    expect(rpc).toHaveBeenLastCalledWith(
      "save_day",
      expect.objectContaining({ intention_lived: "" }),
    )
  })
})

describe("listDayDates", () => {
  it("throws when the read fails, instead of listing no days", async () => {
    results.entries = failure
    await expect(listDayDates()).rejects.toEqual(failure.error)
  })
})
