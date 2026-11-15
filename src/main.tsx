import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "@tanstack/react-router"

import { trackLanding } from "@/features/entries/landing"
import { onSignInOrOut } from "@/lib/auth"
import { recoverFromPreloadError } from "@/lib/preloadRecovery"
import { queryClient } from "@/lib/queryClient"
import { initSentry, reportReactError } from "@/lib/sentry"
import { getRouter } from "./router"
import "./styles.css"

// A lazy chunk missing after a deploy: reload once onto the new build.
window.addEventListener("vite:preloadError", (event) => void recoverFromPreloadError(event))

const router = getRouter()
// Before anything renders, so the first page load is traced and its errors reported.
initSentry(router)
// `/` opens on /morning only on the app's first page, not on later visits.
trackLanding(router)

// Signing in or out re-runs the root route's auth check (which redirects to or
// from /login); signing out also drops everything cached for that account.
onSignInOrOut((signedIn) => {
  if (!signedIn) queryClient.clear()
  void router.invalidate()
})

const root = document.getElementById("app")
if (!root) throw new Error("index.html is missing #app")

createRoot(root, {
  // Each handler reports to Sentry, then logs. React unmounts the whole tree
  // after an uncaught error, leaving a blank page. The component stack says
  // which component threw, even when the thrown value (say, `undefined`) has no
  // stack of its own.
  onUncaughtError: reportReactError("Uncaught render error:"),
  // Already shown to the user by the router's RouteError; just keep the trace.
  onCaughtError: reportReactError("Caught render error:"),
  onRecoverableError: reportReactError("Recovered render error:"),
}).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
