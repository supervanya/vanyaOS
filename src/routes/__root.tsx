import type { QueryClient } from "@tanstack/react-query"
import { Outlet, createRootRouteWithContext, redirect } from "@tanstack/react-router"

import { AppShell } from "@/components/AppShell"
import { Toaster } from "@/components/ui/sonner"
import { AppIdentity } from "@/features/identity/AppName"
import { nameQuery } from "@/features/identity/queries"
import { isSignedIn } from "@/lib/auth"

export type RouterContext = { queryClient: QueryClient }

export const Route = createRootRouteWithContext<RouterContext>()({
  // Solo-account guard, before anything renders or loads: signed out goes to
  // /login, signed in never sees it. main.tsx re-runs this on sign-in/out.
  beforeLoad: async ({ location, context: { queryClient } }) => {
    const onLogin = location.pathname.endsWith("/login")
    const signedIn = await isSignedIn()
    if (!signedIn && !onLogin) throw redirect({ to: "/login", replace: true })
    if (signedIn && onLogin) throw redirect({ to: "/", replace: true })
    // An account picks its name first (/welcome). A name that can't be read
    // (offline) isn't a missing one, so only a definite null redirects.
    if (signedIn && !location.pathname.endsWith("/welcome")) {
      const name = await queryClient.ensureQueryData(nameQuery).catch(() => undefined)
      if (name === null) throw redirect({ to: "/welcome", replace: true })
    }
  },
  component: RootLayout,
})

function RootLayout() {
  return (
    <>
      <AppIdentity />
      <AppShell>
        <Outlet />
      </AppShell>
      <Toaster position="top-center" />
    </>
  )
}
