import type { LoadedConfig } from "@/features/config/api"
import { afterEach, describe, expect, it, vi } from "vitest"
import { listDayDates, loadOrInitDay, saveDay, type DayEntry } from "./api"

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
  intention_lived: "partly",
  updated_at: "2026-09-24T21:00:00.000Z",
}
const failure = { data: null, error: { message: "JWT expired" } }

afterEach(() => {
  for (const table of Object.keys(results)) delete results[table]
})

describe("loadOrInitDay", () => {
  it("hydrates a saved day", async () => {
    results.entries = { data: savedRow, error: null }
    results.entry_metric_values = { data: [{ metric_id: "metric-mood", value: 4 }], error: null }
    results.entry_habits = { data: [{ habit_id: "habit-steps", done: true }], error: null }

    const { entry } = await loadOrInitDay(date, config)
    expect(entry).toMatchObject({
      reflection: "long day",
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

describe("saveDay", () => {
  const entry: DayEntry = {
    date,
    theme: "recovery",
    metrics: {},
    habits: { steps: true },
    reflection: "long day",
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
