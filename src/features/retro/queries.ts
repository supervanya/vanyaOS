import { queryOptions } from "@tanstack/react-query"
import { latestRetro, latestRetroDates, listRetroAreas } from "./api"

export const retroAreasQuery = queryOptions({
  queryKey: ["retro", "areas"],
  queryFn: listRetroAreas,
})

/** When the coach last ran, per area id — drives the "due" nudges. */
export const latestRetroDatesQuery = queryOptions({
  queryKey: ["retro", "latest-dates"],
  queryFn: latestRetroDates,
})

/** The area's current state-of-affairs doc (newest version), or null. */
export const latestRetroQuery = (areaId: string) =>
  queryOptions({ queryKey: ["retro", "latest", areaId], queryFn: () => latestRetro(areaId) })
