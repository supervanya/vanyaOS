import { useQuery } from "@tanstack/react-query"
import { useEffect } from "react"
import { appNameFor } from "./api"
import { nameQuery } from "./queries"

/**
 * The app's name for this account: "VanyaOS" for Vanya. Everything that shows
 * the app's name goes through this (or `<AppName />`), so a rename reaches it.
 */
function useAppName(): string {
  // The root route has loaded it before anything renders. If that failed
  // (offline), the default name is a fine stand-in, so no suspense here.
  const { data } = useQuery(nameQuery)
  return appNameFor(data ?? null)
}

/** The app's name as text, e.g. `<AppName />` → "VanyaOS". */
export function AppName() {
  return useAppName()
}

/**
 * Puts the app's name in the tab title and the iOS Home Screen title. Rendered
 * once, in the root layout. The web app manifest is a static file and keeps
 * the default name. iOS never renames an app already on the Home Screen.
 */
export function AppIdentity() {
  const name = useAppName()

  useEffect(() => {
    document.title = name
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute("content", name)
  }, [name])

  return null
}
