import { useQuery } from "@tanstack/react-query"
import { useEffect } from "react"
import { appNameFor } from "./api"
import { manifestFor } from "./manifest"
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
 * Puts the app's name where the browser reads it on install: the tab title,
 * the iOS Home Screen title, and the web app manifest. Rendered once, in the
 * root layout.
 *
 * Only new installs pick up a new name. iOS never renames a Home Screen app;
 * Chrome may, after its own periodic manifest check.
 */
export function AppIdentity() {
  const name = useAppName()

  useEffect(() => {
    document.title = name
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute("content", name)

    // The manifest is a static file on GitHub Pages, so swap the <link> to a
    // per-account copy. Absent in tests, where vite-plugin-pwa doesn't run.
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    if (!link) return
    const staticHref = link.href
    const appUrl = new URL(import.meta.env.BASE_URL, location.origin).href
    const blob = new Blob([JSON.stringify(manifestFor(name, appUrl))], {
      type: "application/manifest+json",
    })
    const blobHref = URL.createObjectURL(blob)
    link.href = blobHref
    return () => {
      link.href = staticHref
      URL.revokeObjectURL(blobHref)
    }
  }, [name])

  return null
}
