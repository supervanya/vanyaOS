import { queryOptions } from "@tanstack/react-query"
import { configQuery } from "@/features/config/queries"
import { listDayDates, loadDay, loadOrInitDay, loadOrInitMorning } from "./api"
import { wellness } from "./wellness"

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

// Wellness of the most recent entry before `date`, for Reflect's "vs last".
export const previousWellnessQuery = (date: string) =>
  queryOptions({
    queryKey: ["day", date, "previous-wellness"],
    queryFn: async ({ client }) => {
      const config = await client.ensureQueryData(configQuery)
      // Dates come back sorted, so the last one before `date` is the latest.
      const previous = (await listDayDates()).findLast((d) => d < date)
      const day = previous ? await loadDay(previous, config) : null
      return day ? wellness(day, config) : null
    },
  })
