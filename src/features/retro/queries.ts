import { queryOptions } from "@tanstack/react-query"
import { latestRetroDates, listRetroAreas } from "./api"

export const retroAreasQuery = queryOptions({
  queryKey: ["retro", "areas"],
  queryFn: listRetroAreas,
})

/** When the coach last ran, per area id — drives the "due" nudges. */
export const latestRetroDatesQuery = queryOptions({
  queryKey: ["retro", "latest-dates"],
  queryFn: latestRetroDates,
})
