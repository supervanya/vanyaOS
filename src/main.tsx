import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "@tanstack/react-router"

import { trackLanding } from "@/features/entries/landing"
import { onSignInOrOut } from "@/lib/auth"
import { recoverFromPreloadError } from "@/lib/preloadRecovery"
import { queryClient } from "@/lib/queryClient"
import { getRouter } from "./router"
import "./styles.css"

// A lazy chunk missing after a deploy: reload once onto the new build.
window.addEventListener("vite:preloadError", (event) => void recoverFromPreloadError(event))

const router = getRouter()
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
  // React unmounts the whole tree after this. Hand the error and the component
  // that threw to the fatal screen in index.html, so the blank page explains itself.
  onUncaughtError(error, errorInfo) {
    console.error("Uncaught render error:", error, errorInfo.componentStack)
    window.__vanyaFatal?.(error, { source: "react", componentStack: errorInfo.componentStack })
  },
  // Already shown to the user by the router's RouteError; just keep the trace.
  onCaughtError(error, errorInfo) {
    console.error("Caught render error:", error, errorInfo.componentStack)
  },
}).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
