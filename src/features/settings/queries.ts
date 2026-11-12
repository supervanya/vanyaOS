import { queryOptions } from "@tanstack/react-query"
import { listGoalRows, listHabitRows, listMetricRows, loadMorningPrefs } from "./api"

// Under ["config"] so a settings edit refreshes the config every other screen
// reads (configQuery) along with these rows.
export const metricRowsQuery = queryOptions({
  queryKey: ["config", "rows", "metrics"],
  queryFn: listMetricRows,
})
export const habitRowsQuery = queryOptions({
  queryKey: ["config", "rows", "habits"],
  queryFn: listHabitRows,
})
export const goalRowsQuery = queryOptions({
  queryKey: ["config", "rows", "goals"],
  queryFn: listGoalRows,
})

/** When the morning closes and whether `/` opens on it. Rarely changes. */
export const morningPrefsQuery = queryOptions({
  queryKey: ["settings", "morning"],
  queryFn: loadMorningPrefs,
  staleTime: 5 * 60_000,
})
