import { queryOptions } from "@tanstack/react-query"
import { configQuery } from "@/features/config/queries"
import { listDayDates, loadDay, loadOrInitDay } from "./api"
import { wellness } from "./wellness"

// A day as the editor should start it: the saved entry, a newer unsynced local
// draft, or a fresh one. The autosave hook updates this cache after each sync.
export const dayQuery = (date: string) =>
  queryOptions({
    queryKey: ["day", date],
    queryFn: async ({ client }) => loadOrInitDay(date, await client.ensureQueryData(configQuery)),
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
