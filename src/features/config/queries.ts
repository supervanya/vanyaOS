import { queryOptions } from "@tanstack/react-query"
import { loadConfig } from "./api"

// Every screen reads the config; Settings invalidates it after an edit.
export const configQuery = queryOptions({
  queryKey: ["config"],
  queryFn: loadConfig,
})
