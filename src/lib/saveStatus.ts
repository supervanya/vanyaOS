import { useSyncExternalStore } from "react"

/**
 * - `idle`: nothing to report.
 * - `saving`: a write is waiting to go out or in flight.
 * - `saved`: everything just landed; turns back to `idle` after a moment.
 * - `failed`: the last round of writes had a failure; stays until the next
 *   round succeeds.
 */
export type SaveState = "idle" | "saving" | "saved" | "failed"

/** Ends one tracked write. Calling it again does nothing. */
export type SettleSave = (outcome: "saved" | "failed") => void

// How long "saved" shows before the indicator goes quiet.
export const SAVED_VISIBLE_MS = 2000

/**
 * Counts the app's unsaved writes so one indicator can show them all. Every
 * cloud write either wraps its promise in `track` or, when it starts before
 * its request does (a debounced autosave), holds a `begin` token until it
 * lands. A round ends when the count reaches zero: `saved` if every write in
 * it succeeded, `failed` if any didn't.
 */
export function createSaveTracker() {
  let state: SaveState = "idle"
  let unsaved = 0
  let roundFailed = false
  let quietTimer: ReturnType<typeof setTimeout> | undefined
  const listeners = new Set<() => void>()

  const set = (next: SaveState) => {
    if (next === state) return
    state = next
    for (const listener of listeners) listener()
  }

  const begin = (): SettleSave => {
    clearTimeout(quietTimer)
    unsaved += 1
    set("saving")
    let settled = false
    return (outcome) => {
      if (settled) return
      settled = true
      unsaved -= 1
      if (outcome === "failed") roundFailed = true
      if (unsaved > 0) return
      const failed = roundFailed
      roundFailed = false
      set(failed ? "failed" : "saved")
      if (!failed) quietTimer = setTimeout(() => set("idle"), SAVED_VISIBLE_MS)
    }
  }

  const track = <T>(write: Promise<T>): Promise<T> => {
    const settle = begin()
    return write.then(
      (value) => {
        settle("saved")
        return value
      },
      (err: unknown) => {
        settle("failed")
        throw err
      },
    )
  }

  return {
    begin,
    track,
    get: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

const tracker = createSaveTracker()

/** Marks a write as started; call the returned function when it lands. */
export const beginSave = tracker.begin
/** Tracks a write's promise, passing its result or error through. */
export const trackSave = tracker.track
/** The app-wide save state, outside React. */
export const getSaveState = tracker.get

/** The app-wide save state, for the indicator in the top bar. */
export function useSaveState(): SaveState {
  return useSyncExternalStore(tracker.subscribe, tracker.get)
}
