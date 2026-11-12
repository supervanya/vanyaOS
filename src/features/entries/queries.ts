import { queryOptions } from "@tanstack/react-query"
import { configQuery } from "@/features/config/queries"
import { trendSeriesQuery } from "@/features/trends/queries"
import { loadOrInitDay, loadOrInitMorning } from "./api"
import { morningOnlyDates, wellnessByDate } from "./wellness"

// A day as the editor should start it: the saved entry, a newer unsynced local
// draft, or a fresh one. The autosave hook keeps this cache in step with its
// edits.
export const dayQuery = (date: string) =>
  queryOptions({
    queryKey: ["day", date],
    queryFn: async ({ client }) => loadOrInitDay(date, await client.ensureQueryData(configQuery)),
  })

// A day's morning half as /morning should start it: the saved morning, a newer
// unsynced morning draft, or a blank one. Nested under the day, so refreshing a
// day refreshes its morning too. The morning autosave keeps this cache in step
// with its edits, and copies each saved morning into `dayQuery` as well.
export const morningQuery = (date: string) =>
  queryOptions({
    queryKey: ["day", date, "morning"],
    queryFn: async ({ client }) =>
      loadOrInitMorning(date, await client.ensureQueryData(configQuery)),
  })

// Wellness of the most recent day before `date`, for Reflect's "vs last". A
// day with only its morning is skipped: its score rests on a slider or two, and
// the morning creates the row before any evening happens. Read from the Trends
// history; `fetchQuery` reuses it unless it's stale, as it is right after a
// save invalidates both.
export const previousWellnessQuery = (date: string) =>
  queryOptions({
    queryKey: ["day", date, "previous-wellness"],
    queryFn: async ({ client }) => {
      const [config, series] = await Promise.all([
        client.ensureQueryData(configQuery),
        client.fetchQuery(trendSeriesQuery),
      ])
      const partial = morningOnlyDates(series, config.metrics)
      // Sorted by date, so the last one before `date` is the latest.
      const previous = [...wellnessByDate(series, config)].findLast(
        ([d]) => d < date && !partial.has(d),
      )
      return previous?.[1] ?? null
    },
  })
