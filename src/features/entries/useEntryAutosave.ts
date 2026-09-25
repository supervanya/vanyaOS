import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { LoadedConfig } from "@/features/config/api"
import { errorMessage } from "@/lib/errors"
import { clearDraft, saveDay, saveDraft, type DayEntry, type LoadedDay } from "./api"
import { trendSeriesQuery } from "@/features/trends/queries"
import { dayQuery } from "./queries"

// How long to wait after the last edit before syncing to Postgres. The local
// draft is written on every change, instantly — this only debounces the
// network round-trip.
const SYNC_DEBOUNCE_MS = 800

/**
 * A day's entry that saves itself as you edit it. Each edit writes the local
 * draft and the day's cache at once (so a dropped connection can't lose it,
 * and reopening the day shows it), then syncs to Postgres after a short
 * debounce. Leaving the screen sends a sync still waiting on the debounce.
 *
 * Starts from `loaded` and owns the entry from then on, so a background
 * refetch never replaces edits in progress — key the component by date to
 * switch days. Loading saves nothing: saving starts only once the entry
 * changes. The exception is a draft that never reached Postgres, which syncs
 * straight away.
 */
export function useEntryAutosave(config: LoadedConfig, loaded: LoadedDay) {
  const queryClient = useQueryClient()
  const [entry, setEntry] = useState(loaded.entry)
  const baseline = useRef<DayEntry | null>(loaded.unsynced ? null : loaded.entry)
  // The sync waiting on the debounce, if any.
  const pending = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (entry === baseline.current) return
    saveDraft(entry)
    queryClient.setQueryData(dayQuery(entry.date).queryKey, { entry, unsynced: true })
    const sync = () => {
      pending.current = null
      syncDay(entry, config, queryClient)
    }
    pending.current = sync
    const timer = setTimeout(sync, SYNC_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [entry, config, queryClient])

  // Unmounting clears the timer above; send its sync now instead of losing it.
  useEffect(() => () => pending.current?.(), [])

  return { entry, setEntry }
}

// The tail of the sync queue. Syncs run one at a time, in the order they were
// made, so a slow save can't finish after a newer one and overwrite it. It's
// shared by every editor, so one that unmounts mid-save still goes first.
let syncing = Promise.resolve()

function syncDay(entry: DayEntry, config: LoadedConfig, queryClient: QueryClient) {
  syncing = syncing
    .then(() => saveDay(entry, config))
    .then(() => {
      clearDraft(entry)
      // Other screens showing this day pick up the saved version, unless the
      // cache has already moved on to a newer edit. Later days' "vs last"
      // deltas and the Trends history recompute.
      queryClient.setQueryData(dayQuery(entry.date).queryKey, (day) =>
        day?.entry.updatedAt === entry.updatedAt ? { entry, unsynced: false } : day,
      )
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[2] === "previous-wellness",
      })
      void queryClient.invalidateQueries({ queryKey: trendSeriesQuery.queryKey })
    })
    .catch((err: unknown) => {
      toast.error(`Sync failed, kept locally: ${errorMessage(err)}`)
    })
}
