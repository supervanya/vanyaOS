import type { LoadedConfig } from "@/features/config/api"
import { describe, expect, it, vi } from "vitest"
import { loadTrendSeries } from "./api"

// Two reads of `entries`: the history with its child rows, and the dates whose
// reflection is written (selected without the text).
const history = [
  {
    entry_date: "2026-11-01",
    intention: "",
    intention_lived: null,
    entry_metric_values: [{ metric_id: "m-mood", value: 3 }],
    entry_habits: [{ habit_id: "h-walk", done: true }],
  },
  {
    entry_date: "2026-11-02",
    intention: "Rest",
    intention_lived: "yes",
    entry_metric_values: [{ metric_id: "m-sleep", value: 4 }],
    entry_habits: [],
  },
  {
    entry_date: "2026-11-03",
    intention: "  ",
    intention_lived: null,
    entry_metric_values: [{ metric_id: "m-archived", value: 1 }],
    entry_habits: [],
  },
]
const reflected = [{ entry_date: "2026-11-01" }]

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: () => ({
      select: (columns: string) => {
        const data = columns === "entry_date" ? reflected : history
        const result = Promise.resolve({ data, error: null })
        const builder = Object.assign(result, { order: () => result, neq: () => builder })
        return builder
      },
    }),
  },
}))

// Only the slug -> row-id maps are read.
const config: LoadedConfig = {
  activeTheme: "recovery",
  themes: [],
  metrics: [],
  habits: [],
  goals: [],
  metricRowId: { mood: "m-mood", sleep: "m-sleep" },
  habitRowId: { walk: "h-walk" },
}

describe("loadTrendSeries", () => {
  it("collects each item's points and which halves of each day were written", async () => {
    expect(await loadTrendSeries(config)).toEqual({
      firstDate: "2026-11-01",
      metrics: {
        mood: [{ date: "2026-11-01", value: 3 }],
        sleep: [{ date: "2026-11-02", value: 4 }],
      },
      habits: { walk: [{ date: "2026-11-01", value: 1 }] },
      intentionDates: ["2026-11-02"],
      writtenEveningDates: ["2026-11-01", "2026-11-02"],
    })
  })
})
