import type { QueryClient } from "@tanstack/react-query"
import { Outlet, createRootRouteWithContext, redirect } from "@tanstack/react-router"

import { AppShell } from "@/components/AppShell"
import { Toaster } from "@/components/ui/sonner"
import { currentSession } from "@/lib/auth"

export type RouterContext = { queryClient: QueryClient }

export const Route = createRootRouteWithContext<RouterContext>()({
  // Solo-account guard, before anything renders or loads: signed out goes to
  // /login, signed in never sees it. main.tsx re-runs this on sign-in/out.
  beforeLoad: async ({ location }) => {
    const onLogin = location.pathname.endsWith("/login")
    const session = await currentSession()
    if (!session && !onLogin) throw redirect({ to: "/login", replace: true })
    if (session && onLogin) throw redirect({ to: "/", replace: true })
  },
  component: RootLayout,
})

function RootLayout() {
  return (
    <>
      <AppShell>
        <Outlet />
      </AppShell>
      <Toaster position="top-center" />
    </>
  )
}
