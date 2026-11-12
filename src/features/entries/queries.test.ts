import type { LoadedConfig } from "@/features/config/api"
import type { TrendSeries } from "@/features/trends/api"
import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"
import { configQuery } from "@/features/config/queries"
import { trendSeriesQuery } from "@/features/trends/queries"
import { previousWellnessQuery } from "./queries"

vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }))

const config = {
  metrics: [
    { id: "mood", label: "Mood", group: "G", higherIsBetter: true, scale: 5, timing: "evening" },
    { id: "sleep", label: "Sleep", group: "G", higherIsBetter: true, scale: 5, timing: "morning" },
  ],
} as LoadedConfig

function previousWellness(date: string, series: TrendSeries) {
  // Cached data stays fresh, so nothing here reaches Supabase.
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } })
  client.setQueryData(configQuery.queryKey, config)
  client.setQueryData(trendSeriesQuery.queryKey, series)
  return client.fetchQuery(previousWellnessQuery(date))
}

const series = (overrides: Partial<TrendSeries>): TrendSeries => ({
  firstDate: "2026-11-01",
  metrics: {},
  habits: {},
  intentionDates: [],
  writtenEveningDates: [],
  ...overrides,
})

describe("previousWellnessQuery", () => {
  it("scores the latest day before the date", async () => {
    const history = series({
      metrics: {
        mood: [
          { date: "2026-11-01", value: 2 },
          { date: "2026-11-03", value: 4 },
          { date: "2026-11-05", value: 1 },
        ],
      },
    })
    expect(await previousWellness("2026-11-05", history)).toBe(4)
  })

  it("skips a day that has only its morning", async () => {
    const history = series({
      metrics: {
        mood: [{ date: "2026-11-03", value: 4 }],
        sleep: [
          { date: "2026-11-03", value: 2 },
          { date: "2026-11-04", value: 5 },
        ],
      },
      intentionDates: ["2026-11-05"],
    })
    expect(await previousWellness("2026-11-06", history)).toBe(3)
  })

  it("is null with no earlier day", async () => {
    expect(await previousWellness("2026-11-01", series({}))).toBeNull()
  })
})
