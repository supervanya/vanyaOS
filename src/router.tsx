import { QueryClientProvider } from "@tanstack/react-query"
import { createRouter as createTanStackRouter } from "@tanstack/react-router"
import { PageSkeleton, RouteError } from "@/components/RouteStates"
import { queryClient } from "@/lib/queryClient"
import { routeTree } from "./routeTree.gen"

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
    // Matches the Vite base so routing works under the GitHub Pages subpath
    // (/vanyaOS in prod, / in dev).
    basepath: import.meta.env.BASE_URL.replace(/\/$/, "") || "/",
    scrollRestoration: true,
    defaultPreload: "intent",
    // TanStack Query owns caching; the router re-runs loaders and lets the
    // query cache decide what's fresh.
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: PageSkeleton,
    // Show the skeleton only when loading is slow enough to notice.
    defaultPendingMs: 200,
    defaultErrorComponent: RouteError,
  })

  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
