import { queryOptions } from "@tanstack/react-query"
import { loadName } from "./api"

/**
 * The account's name. Read from the stored session, so it only changes when
 * this app saves it (which sets the cache) or another account signs in
 * (main.tsx resets it).
 */
export const nameQuery = queryOptions({
  queryKey: ["identity", "name"],
  queryFn: loadName,
  staleTime: Infinity,
})
