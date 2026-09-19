import { queryOptions } from "@tanstack/react-query"
import { listGoalRows, listHabitRows, listMetricRows } from "./api"

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
