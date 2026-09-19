import { QueryClient } from "@tanstack/react-query"

// One client for the app, shared with the router through its context so
// loaders can prefetch into the same cache the components read from.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Single user, data only changes through this app: reuse for 30s, then
      // refetch when the screen comes back into focus.
      staleTime: 30_000,
      retry: 1,
    },
  },
})
