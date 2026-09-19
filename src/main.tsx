import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "@tanstack/react-router"

import { onSignInOrOut } from "@/lib/auth"
import { queryClient } from "@/lib/queryClient"
import { getRouter } from "./router"
import "./styles.css"

const router = getRouter()

// Signing in or out re-runs the root route's auth check (which redirects to or
// from /login); signing out also drops everything cached for that account.
onSignInOrOut((signedIn) => {
  if (!signedIn) queryClient.clear()
  void router.invalidate()
})

const root = document.getElementById("app")
if (!root) throw new Error("index.html is missing #app")

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
