import { queryOptions } from "@tanstack/react-query"
import { configQuery } from "@/features/config/queries"
import { loadTrendSeries } from "./api"

// All history in one request; every window is a slice of it, so switching
// windows is instant and a streak can count back past the window's start.
export const trendSeriesQuery = queryOptions({
  queryKey: ["trends"],
  queryFn: async ({ client }) => loadTrendSeries(await client.ensureQueryData(configQuery)),
})
