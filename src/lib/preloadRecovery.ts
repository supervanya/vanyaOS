// A lazy route chunk that fails to load almost always means a stale deploy:
// this tab's HTML points at hashed files the new deploy replaced. Reloading
// once picks up the new build. A reload already in the last RELOAD_GUARD_MS
// means reloading didn't help, so let the error surface instead of looping.

export const RELOAD_GUARD_MS = 30_000
const STORAGE_KEY = "vanyaos:preload-reload-at"

type Deps = {
  storage: () => Pick<Storage, "getItem" | "setItem">
  reload: () => void
  now: () => number
}

const browserDeps: Deps = {
  storage: () => sessionStorage,
  reload: () => location.reload(),
  now: () => Date.now(),
}

/** Handles Vite's `vite:preloadError`. Returns whether it reloaded the page. */
export function recoverFromPreloadError(event: Event, deps: Deps = browserDeps): boolean {
  const now = deps.now()
  try {
    const storage = deps.storage()
    const last = Number(storage.getItem(STORAGE_KEY))
    if (Number.isFinite(last) && last > 0 && now - last < RELOAD_GUARD_MS) return false
    storage.setItem(STORAGE_KEY, String(now))
  } catch {
    // No storage means no loop guard: don't risk a reload loop.
    return false
  }
  // Stop Vite from rethrowing the error; the reload replaces this page.
  event.preventDefault()
  deps.reload()
  return true
}
