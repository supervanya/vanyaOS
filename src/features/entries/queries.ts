import { queryOptions } from "@tanstack/react-query"
import { configQuery } from "@/features/config/queries"
import { loadOrInitDay } from "./api"

// A day as the editor should start it: the saved entry, a newer unsynced local
// draft, or a fresh one. The autosave hook updates this cache after each sync.
export const dayQuery = (date: string) =>
  queryOptions({
    queryKey: ["day", date],
    queryFn: async ({ client }) => loadOrInitDay(date, await client.ensureQueryData(configQuery)),
  })
